import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EventLogRecordInput } from "@sst/shared";
import { sha256Hex } from "../common/crypto";
import { PrismaService } from "../common/prisma.service";

/* ---------- Retry configuration ---------- */

const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000]; // 5s, 30s, 2m, 10m, 30m

interface DeliveryAttempt {
  provider: string;
  attemptNumber: number;
  timestamp: string;
  statusCode: number | null;
  latencyMs: number;
  error: string | null;
  outcome: "success" | "retrying" | "failed";
}

/* ---------- Service ---------- */

@Injectable()
export class DestinationService {
  private readonly logger = new Logger(DestinationService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async deliver(event: EventLogRecordInput) {
    if (!event.accountId) return;

    const configs = await this.prisma.gatewayConfig.findMany({
      where: {
        accountId: event.accountId,
        enabled: true,
        OR: [
          { containerId: event.containerId },
          { containerId: null },
        ],
      },
    });

    if (configs.length === 0) {
      this.logger.warn(`No enabled destinations configured for account ${event.accountId}`);
      return;
    }

    const deliveryPromises: Promise<void>[] = [];

    for (const config of configs) {
      if (config.provider === "meta" && event.destinations.includes("meta")) {
        deliveryPromises.push(this.deliverWithRetry("meta", () => this.deliverToMeta(event, config)));
      } else if (config.provider === "ga4" && (event.destinations.includes("ga4") || event.destinations.includes("google"))) {
        deliveryPromises.push(this.deliverWithRetry("ga4", () => this.deliverToGa4(event, config)));
      } else if (config.provider === "tiktok" && event.destinations.includes("tiktok")) {
        deliveryPromises.push(this.deliverWithRetry("tiktok", () => this.deliverToTikTok(event, config)));
      }
    }

    await Promise.allSettled(deliveryPromises);
  }

  /* ---------- Retry wrapper with exponential backoff ---------- */

  private async deliverWithRetry(
    provider: string,
    deliverFn: () => Promise<{ success: boolean; statusCode?: number; error?: string }>,
  ): Promise<void> {
    const attempts: DeliveryAttempt[] = [];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const start = Date.now();
      try {
        const result = await deliverFn();
        const latencyMs = Date.now() - start;

        attempts.push({
          provider,
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          statusCode: result.statusCode ?? null,
          latencyMs,
          error: result.error ?? null,
          outcome: result.success ? "success" : attempt < MAX_RETRIES ? "retrying" : "failed",
        });

        if (result.success) {
          if (attempt > 1) {
            this.logger.log(`${provider} delivery succeeded on attempt ${attempt} after ${attempts.length} tries`);
          }
          return;
        }

        // Non-retryable errors (auth failures, invalid payload)
        if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) {
          this.logger.error(`${provider} delivery failed with non-retryable status ${result.statusCode}: ${result.error}`);
          return;
        }

      } catch (error) {
        const latencyMs = Date.now() - start;
        const errMsg = error instanceof Error ? error.message : String(error);

        attempts.push({
          provider,
          attemptNumber: attempt,
          timestamp: new Date().toISOString(),
          statusCode: null,
          latencyMs,
          error: errMsg,
          outcome: attempt < MAX_RETRIES ? "retrying" : "failed",
        });
      }

      // Wait before retrying (except on last attempt)
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        // Use a capped delay in dev to avoid long waits: max 5s
        const cappedDelay = Math.min(delay, 5_000);
        this.logger.warn(`${provider} delivery attempt ${attempt} failed, retrying in ${cappedDelay}ms`);
        await new Promise((resolve) => setTimeout(resolve, cappedDelay));
      }
    }

    this.logger.error(`${provider} delivery FAILED after ${MAX_RETRIES} attempts. Attempts: ${JSON.stringify(attempts.map((a) => ({ attempt: a.attemptNumber, status: a.statusCode, error: a.error })))}`);
  }

  /* ---------- Meta CAPI ---------- */

  private async deliverToMeta(event: EventLogRecordInput, config: any): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const { pixelId, accessToken } = config.credentials as any;
    const { testEventCode } = (config.settings ?? {}) as any;
    if (!pixelId || !accessToken) {
      return { success: false, statusCode: 400, error: "Missing pixelId or accessToken" };
    }

    const metaUserData = this.buildMetaUserData(event);
    const fbEvent = {
      event_name: this.mapEventName(event.eventName, "meta"),
      event_time: Math.floor(new Date(event.timestamp).getTime() / 1000),
      event_id: event.eventId,
      event_source_url: event.pageUrl,
      action_source: "website",
      user_data: metaUserData,
      custom_data: this.buildMetaCustomData(event),
    };

    const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [fbEvent],
        access_token: accessToken,
        ...(typeof testEventCode === "string" && testEventCode.length > 0
          ? { test_event_code: testEventCode }
          : {}),
      }),
    });

    const responseText = await response.text();
    const statusCode = response.status;

    if (!response.ok) {
      this.logger.error(
        `Meta CAPI error for event ${event.eventId} and pixel ${this.maskValue(pixelId)}: ${responseText}`,
      );
      return { success: false, statusCode, error: responseText };
    }

    this.logger.log(
      `Meta CAPI delivered event ${event.eventId} to pixel ${this.maskValue(pixelId)} with status ${statusCode}${testEventCode ? " (test mode)" : ""} using ${Object.keys(metaUserData).length} user data fields`,
    );
    return { success: true, statusCode };
  }

  /* ---------- Google GA4 Measurement Protocol ---------- */

  private async deliverToGa4(event: EventLogRecordInput, config: any): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const { measurementId, apiSecret } = config.credentials as any;
    const debugMode = Boolean((config.settings ?? {}).debugMode);
    if (!measurementId || !apiSecret) {
      return { success: false, statusCode: 400, error: "Missing measurementId or apiSecret" };
    }

    const gaPayload = this.buildGa4Payload(event, debugMode);
    const endpoint = debugMode
      ? "https://www.google-analytics.com/debug/mp/collect"
      : "https://www.google-analytics.com/mp/collect";
    const response = await fetch(
      `${endpoint}?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gaPayload),
      },
    );
    const responseText = await response.text();
    const statusCode = response.status;

    if (!response.ok) {
      this.logger.error(
        `GA4 error for event ${event.eventId} and measurement ${this.maskValue(measurementId)}: ${responseText}`,
      );
      return { success: false, statusCode, error: responseText };
    }

    const validationMessageCount = this.getGa4ValidationMessageCount(responseText);
    if (debugMode && validationMessageCount > 0) {
      this.logger.warn(
        `GA4 debug validation warnings for event ${event.eventId}: ${responseText}`,
      );
    }

    this.logger.log(
      `GA4 delivered event ${event.eventId} to measurement ${this.maskValue(measurementId)} with status ${statusCode}${debugMode ? ` (${validationMessageCount} validation msgs)` : ""}`,
    );
    return { success: true, statusCode };
  }

  /* ---------- TikTok Events API ---------- */

  private async deliverToTikTok(event: EventLogRecordInput, config: any): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const { pixelCode, accessToken } = config.credentials as any;
    const { testEventCode } = (config.settings ?? {}) as any;
    if (!pixelCode || !accessToken) {
      return { success: false, statusCode: 400, error: "Missing pixelCode or accessToken" };
    }

    const properties = this.toRecord(event.properties);
    const tiktokEvent = {
      event_source: "web",
      event_source_id: pixelCode,
      ...(typeof testEventCode === "string" && testEventCode.length > 0
        ? { test_event_code: testEventCode }
        : {}),
      data: [
        {
          event: this.mapEventName(event.eventName, "tiktok"),
          event_id: event.eventId,
          event_time: Math.floor(new Date(event.timestamp).getTime() / 1000),
          context: {
            page: {
              url: event.pageUrl,
              referrer: event.referrer,
            },
            user: {
              ...this.buildTikTokUserData(event),
              ip: event.ip,
              user_agent: event.userAgent,
            },
            ad: {
              callback: readStringProp(properties, ["ttclid", "_ttclid"]),
            },
          },
          properties: this.buildTikTokCustomData(event),
        },
      ],
    };

    const response = await fetch(
      "https://business-api.tiktok.com/open_api/v1.3/event/track/",
      {
        method: "POST",
        headers: {
          "Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tiktokEvent),
      },
    );

    const responseText = await response.text();
    const statusCode = response.status;

    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      // Non-JSON response
    }

    if (result.code !== 0) {
      this.logger.error(
        `TikTok error for event ${event.eventId} and pixel ${this.maskValue(pixelCode)}: ${responseText}`,
      );
      return { success: false, statusCode, error: responseText };
    }

    this.logger.log(
      `TikTok delivered event ${event.eventId} to pixel ${this.maskValue(pixelCode)} with code ${result.code}`,
    );
    return { success: true, statusCode };
  }

  private buildTikTokUserData(event: EventLogRecordInput): Record<string, string | undefined> {
    const properties = this.toRecord(event.properties);
    return compactStringRecord({
      email: this.readString(properties, ["em_hashed", "em"]) ?? this.hashField(this.readString(properties, ["email"]), "email"),
      phone: this.readString(properties, ["ph_hashed", "ph"]) ?? this.hashField(this.readString(properties, ["phone"]), "phone"),
      external_id: this.readString(properties, ["external_id", "externalId", "user_id", "userId"]) ?? event.clientId,
      ttclid: this.readString(properties, ["ttclid", "_ttclid"]),
    });
  }

  private buildTikTokCustomData(event: EventLogRecordInput): Record<string, unknown> | undefined {
    if (!event.revenue && !event.currency) return undefined;
    const properties = this.toRecord(event.properties);
    return this.compactRecord({
      value: event.revenue,
      currency: event.currency,
      order_id: this.readString(properties, ["order_id", "orderId", "transaction_id", "transactionId"]),
      content_type: this.readString(properties, ["content_type", "contentType"]) ?? "product",
      contents: this.readArray(properties, ["contents", "items"])?.map((item: any) => ({
        content_name: item.item_name ?? item.name ?? item.content_name,
        quantity: item.quantity ?? 1,
        price: item.price ?? item.item_price,
        content_id: item.item_id ?? item.id ?? item.content_id,
      })),
    });
  }

  private hashField(value: string | undefined, mode: "email" | "phone"): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
    const normalized = mode === "email" ? trimmed.toLowerCase() : trimmed.replace(/[\s\-()]+/g, "");
    return sha256Hex(normalized);
  }

  /* ---------- Meta data builders ---------- */

  private buildMetaUserData(event: EventLogRecordInput): Record<string, string> {
    const properties = this.toRecord(event.properties);
    const fbc = this.readString(properties, ["fbc", "_fbc"]);
    const fbp = this.readString(properties, ["fbp", "_fbp"]);
    const email = this.readString(properties, ["em_hashed"]) ?? this.hashMetaField(this.readString(properties, ["email", "em"]), "email");
    const phone = this.readString(properties, ["ph_hashed"]) ?? this.hashMetaField(this.readString(properties, ["phone", "ph"]), "phone");
    const firstName = this.readString(properties, ["fn_hashed"]) ?? this.hashMetaField(this.readString(properties, ["first_name", "firstName", "fn"]), "text");
    const lastName = this.readString(properties, ["ln_hashed"]) ?? this.hashMetaField(this.readString(properties, ["last_name", "lastName", "ln"]), "text");
    const city = this.hashMetaField(this.readString(properties, ["city", "ct"]), "text");
    const state = this.hashMetaField(this.readString(properties, ["state", "region", "st"]), "text");
    const zip = this.hashMetaField(this.readString(properties, ["zip", "postal_code", "postalCode", "zp"]), "postal");
    const country = this.hashMetaField(
      this.readString(properties, ["country", "country_code", "countryCode"]),
      "country",
    );
    const externalId = this.hashMetaField(
      this.readString(properties, ["external_id", "externalId", "user_id", "userId"]) ?? event.clientId,
      "external_id",
    );

    return this.compactStringRecord({
      client_ip_address: event.ip,
      client_user_agent: event.userAgent,
      fbc,
      fbp,
      em: email,
      ph: phone,
      fn: firstName,
      ln: lastName,
      ct: city,
      st: state,
      zp: zip,
      country,
      external_id: externalId,
    });
  }

  private buildMetaCustomData(event: EventLogRecordInput): Record<string, unknown> {
    const properties = this.toRecord(event.properties);
    const sanitizedProperties = this.stripMetaUserData(properties);

    return this.compactRecord({
      currency: event.currency,
      value: event.revenue,
      order_id: this.readString(properties, ["order_id", "orderId"]),
      content_name: this.readString(properties, ["content_name", "contentName"]),
      content_category: this.readString(properties, ["content_category", "contentCategory"]),
      content_type: this.readString(properties, ["content_type", "contentType"]),
      search_string: this.readString(properties, ["search_string", "searchString"]),
      content_ids: this.readStringArray(properties, ["content_ids", "contentIds"]),
      contents: this.readArray(properties, ["contents"]),
      num_items: this.readNumber(properties, ["num_items", "numItems"]),
      predicted_ltv: this.readNumber(properties, ["predicted_ltv", "predictedLtv"]),
      ...sanitizedProperties,
    });
  }

  /* ---------- GA4 data builders ---------- */

  private buildGa4Payload(
    event: EventLogRecordInput,
    debugMode: boolean,
  ) {
    const properties = this.toRecord(event.properties);
    const sessionId = this.parseGa4SessionId(event.sessionId ?? this.readString(properties, ["ga_session_id", "session_id"]));
    const userId = this.readString(properties, ["user_id", "userId", "external_id", "externalId"]);
    const nonPersonalizedAds = this.readBoolean(properties, ["non_personalized_ads", "nonPersonalizedAds"]);
    const params = this.buildGa4EventParams(event, properties, sessionId, debugMode);

    return this.compactRecord({
      client_id: event.clientId,
      timestamp_micros: this.toGa4TimestampMicros(event.timestamp),
      user_id: userId,
      non_personalized_ads: nonPersonalizedAds,
      events: [
        {
          name: this.mapEventName(event.eventName, "ga4"),
          params,
        },
      ],
    });
  }

  private buildGa4EventParams(
    event: EventLogRecordInput,
    properties: Record<string, unknown>,
    sessionId: number | undefined,
    debugMode: boolean,
  ): Record<string, unknown> {
    const sanitizedProperties = this.stripGa4RestrictedProperties(properties);
    const items = this.buildGa4Items(properties);
    const currency = this.resolveGa4Currency(event, properties);
    const value = this.resolveGa4Value(event, properties, items);
    const numItems = this.readNumber(properties, ["num_items", "numItems"]) ?? this.countGa4Items(items);

    return this.compactRecord({
      page_location: event.pageUrl,
      page_referrer: event.referrer,
      page_title: this.readString(properties, ["page_title", "pageTitle", "title", "document_title", "documentTitle"]),
      session_id: sessionId,
      engagement_time_msec: this.readNumber(properties, ["engagement_time_msec", "engagementTimeMsec"]) ?? 1,
      currency,
      value,
      transaction_id: this.readString(properties, ["transaction_id", "transactionId", "order_id", "orderId"]),
      coupon: this.readString(properties, ["coupon"]),
      shipping: this.readNumber(properties, ["shipping"]),
      tax: this.readNumber(properties, ["tax"]),
      shipping_tier: this.readString(properties, ["shipping_tier", "shippingTier"]),
      payment_type: this.readString(properties, ["payment_type", "paymentType"]),
      affiliation: this.readString(properties, ["affiliation"]),
      item_list_id: this.readString(properties, ["item_list_id", "itemListId"]),
      item_list_name: this.readString(properties, ["item_list_name", "itemListName"]),
      promotion_id: this.readString(properties, ["promotion_id", "promotionId"]),
      promotion_name: this.readString(properties, ["promotion_name", "promotionName"]),
      creative_name: this.readString(properties, ["creative_name", "creativeName"]),
      creative_slot: this.readString(properties, ["creative_slot", "creativeSlot"]),
      location_id: this.readString(properties, ["location_id", "locationId"]),
      item_id: this.readString(properties, ["item_id", "itemId"]),
      item_name: this.readString(properties, ["item_name", "itemName", "content_name", "contentName"]),
      item_category: this.readString(properties, ["item_category", "itemCategory", "content_category", "contentCategory"]),
      item_category2: this.readString(properties, ["item_category2", "itemCategory2"]),
      item_category3: this.readString(properties, ["item_category3", "itemCategory3"]),
      item_category4: this.readString(properties, ["item_category4", "itemCategory4"]),
      item_category5: this.readString(properties, ["item_category5", "itemCategory5"]),
      item_brand: this.readString(properties, ["item_brand", "itemBrand"]),
      item_variant: this.readString(properties, ["item_variant", "itemVariant", "variant"]),
      content_type: this.readString(properties, ["content_type", "contentType"]),
      search_term: this.readString(properties, ["search_term", "searchTerm", "search_string", "searchString"]),
      method: this.readString(properties, ["method"]),
      num_items: numItems,
      items,
      debug_mode: debugMode ? 1 : undefined,
      ...sanitizedProperties,
    });
  }

  private buildGa4Items(properties: Record<string, unknown>): Array<Record<string, unknown>> | undefined {
    const existingItems = this.readArray(properties, ["items"]);
    if (existingItems && existingItems.every((item) => item && typeof item === "object" && !Array.isArray(item))) {
      const normalizedItems = existingItems
        .map((item, index) => this.normalizeGa4Item(this.toRecord(item), index))
        .filter((item) => Object.keys(item).length > 0);
      return normalizedItems.length > 0 ? normalizedItems : undefined;
    }

    const contentIds = this.readStringArray(properties, ["content_ids", "contentIds"]);
    if (contentIds && contentIds.length > 0) {
      const normalizedItems = contentIds
        .map((itemId, index) =>
          this.normalizeGa4Item(
            {
              item_id: itemId,
              item_name: this.readString(properties, ["item_name", "itemName", "content_name", "contentName"]),
              item_category: this.readString(properties, ["item_category", "itemCategory", "content_category", "contentCategory"]),
              item_brand: this.readString(properties, ["item_brand", "itemBrand"]),
              item_variant: this.readString(properties, ["item_variant", "itemVariant", "variant"]),
              price: this.readNumber(properties, ["price", "item_price", "itemPrice"]),
              quantity: this.readNumber(properties, ["quantity", "qty"]),
            },
            index,
          ),
        )
        .filter((item) => Object.keys(item).length > 0);
      return normalizedItems.length > 0 ? normalizedItems : undefined;
    }

    const singleItemId = this.readString(properties, ["item_id", "itemId", "sku", "product_id", "productId"]);
    if (!singleItemId) return undefined;

    return [
      this.normalizeGa4Item(
        {
          item_id: singleItemId,
          item_name: this.readString(properties, ["item_name", "itemName", "content_name", "contentName"]),
          item_category: this.readString(properties, ["item_category", "itemCategory", "content_category", "contentCategory"]),
          item_brand: this.readString(properties, ["item_brand", "itemBrand"]),
          item_variant: this.readString(properties, ["item_variant", "itemVariant", "variant"]),
          price: this.readNumber(properties, ["price", "item_price", "itemPrice"]),
          quantity: this.readNumber(properties, ["quantity", "qty"]),
        },
        0,
      ),
    ].filter((item) => Object.keys(item).length > 0);
  }

  private normalizeGa4Item(item: Record<string, unknown>, fallbackIndex: number): Record<string, unknown> {
    return this.compactRecord({
      item_id: this.readString(item, ["item_id", "itemId", "id", "sku", "product_id", "productId"]),
      item_name: this.readString(item, ["item_name", "itemName", "name", "product_name", "productName"]),
      item_brand: this.readString(item, ["item_brand", "itemBrand", "brand"]),
      item_category: this.readString(item, ["item_category", "itemCategory", "category"]),
      item_category2: this.readString(item, ["item_category2", "itemCategory2", "category2"]),
      item_category3: this.readString(item, ["item_category3", "itemCategory3", "category3"]),
      item_category4: this.readString(item, ["item_category4", "itemCategory4", "category4"]),
      item_category5: this.readString(item, ["item_category5", "itemCategory5", "category5"]),
      item_variant: this.readString(item, ["item_variant", "itemVariant", "variant"]),
      price: this.readNumber(item, ["price", "item_price", "itemPrice"]),
      quantity: this.readNumber(item, ["quantity", "qty"]) ?? 1,
      discount: this.readNumber(item, ["discount"]),
      coupon: this.readString(item, ["coupon"]),
      affiliation: this.readString(item, ["affiliation"]),
      item_list_id: this.readString(item, ["item_list_id", "itemListId"]),
      item_list_name: this.readString(item, ["item_list_name", "itemListName"]),
      index: this.readNumber(item, ["index"]) ?? fallbackIndex,
      location_id: this.readString(item, ["location_id", "locationId"]),
      promotion_id: this.readString(item, ["promotion_id", "promotionId"]),
      promotion_name: this.readString(item, ["promotion_name", "promotionName"]),
      creative_name: this.readString(item, ["creative_name", "creativeName"]),
      creative_slot: this.readString(item, ["creative_slot", "creativeSlot"]),
    });
  }

  private resolveGa4Currency(event: EventLogRecordInput, properties: Record<string, unknown>): string {
    return this.readString(properties, ["currency"]) ?? event.currency;
  }

  private resolveGa4Value(
    event: EventLogRecordInput,
    properties: Record<string, unknown>,
    items: Array<Record<string, unknown>> | undefined,
  ): number | undefined {
    if (typeof event.revenue === "number") return event.revenue;
    const explicitValue = this.readNumber(properties, ["value", "revenue"]);
    if (typeof explicitValue === "number") return explicitValue;
    if (!items || items.length === 0) return undefined;
    const itemTotal = items.reduce((total, item) => {
      const price = typeof item.price === "number" ? item.price : 0;
      const quantity = typeof item.quantity === "number" ? item.quantity : 1;
      return total + price * quantity;
    }, 0);
    return itemTotal > 0 ? Number(itemTotal.toFixed(2)) : undefined;
  }

  private countGa4Items(items: Array<Record<string, unknown>> | undefined): number | undefined {
    if (!items || items.length === 0) return undefined;
    return items.reduce((count, item) => {
      const quantity = typeof item.quantity === "number" ? item.quantity : 1;
      return count + quantity;
    }, 0);
  }

  /* ---------- Property stripping ---------- */

  private stripMetaUserData(properties: Record<string, unknown>): Record<string, unknown> {
    const userDataKeys = new Set([
      "_fbc", "_fbp", "city", "country", "countryCode", "country_code", "ct",
      "email", "em", "em_hashed", "externalId", "external_id", "fbc", "fbp",
      "firstName", "first_name", "fn", "fn_hashed", "lastName", "last_name",
      "ln", "ln_hashed", "ph", "ph_hashed", "phone", "postalCode", "postal_code",
      "region", "st", "state", "userId", "user_id", "zip", "zp",
    ]);
    return Object.fromEntries(Object.entries(properties).filter(([key]) => !userDataKeys.has(key)));
  }

  private stripGa4RestrictedProperties(properties: Record<string, unknown>): Record<string, unknown> {
    const restrictedKeys = new Set([
      "_fbc", "_fbp", "city", "country", "countryCode", "country_code", "ct",
      "email", "em", "em_hashed", "externalId", "external_id", "fbc", "fbp",
      "firstName", "first_name", "fn", "fn_hashed", "lastName", "last_name",
      "ln", "ln_hashed", "ph", "ph_hashed", "phone", "postalCode", "postal_code",
      "region", "st", "state", "userId", "user_id", "zip", "zp",
      "contentIds", "content_ids", "contentCategory", "contentName",
      "content_category", "content_name", "creativeName", "creativeSlot",
      "creative_name", "creative_slot", "coupon", "engagementTimeMsec",
      "engagement_time_msec", "ga_session_id", "index", "itemBrand",
      "itemCategory", "itemCategory2", "itemCategory3", "itemCategory4",
      "itemCategory5", "itemId", "itemListId", "itemListName", "itemName",
      "itemPrice", "itemVariant", "item_brand", "item_category",
      "item_category2", "item_category3", "item_category4", "item_category5",
      "item_id", "item_list_id", "item_list_name", "item_name", "item_price",
      "item_variant", "items", "locationId", "location_id", "method",
      "nonPersonalizedAds", "non_personalized_ads", "numItems", "num_items",
      "orderId", "order_id", "paymentType", "payment_type", "price",
      "productId", "productName", "product_id", "product_name", "promotionId",
      "promotionName", "promotion_id", "promotion_name", "qty", "quantity",
      "searchString", "searchTerm", "search_string", "search_term",
      "session_id", "shipping", "shippingTier", "shipping_tier", "sku", "tax",
      "title", "transactionId", "transaction_id", "value", "variant", "source",
      "ttclid", "_ttclid",
    ]);
    return Object.fromEntries(Object.entries(properties).filter(([key]) => !restrictedKeys.has(key)));
  }

  /* ---------- Utility methods ---------- */

  private maskValue(value: string): string {
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  private readString(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string") {
        const normalized = value.trim();
        if (normalized.length > 0) return normalized;
      }
    }
    return undefined;
  }

  private readBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
      }
    }
    return undefined;
  }

  private readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string" && value.trim().length > 0) {
        const coerced = Number(value);
        if (Number.isFinite(coerced)) return coerced;
      }
    }
    return undefined;
  }

  private readArray(record: Record<string, unknown>, keys: string[]): unknown[] | undefined {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value) && value.length > 0) return value;
    }
    return undefined;
  }

  private readStringArray(record: Record<string, unknown>, keys: string[]): string[] | undefined {
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) {
        const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
        if (normalized.length > 0) return normalized.map((item) => item.trim());
      }
    }
    return undefined;
  }

  private hashMetaField(
    value: string | undefined,
    mode: "country" | "email" | "external_id" | "phone" | "postal" | "text",
  ): string | undefined {
    if (!value) return undefined;
    const normalized = this.normalizeMetaField(value, mode);
    if (!normalized) return undefined;
    if (/^[a-f0-9]{64}$/i.test(normalized)) return normalized.toLowerCase();
    return sha256Hex(normalized);
  }

  private normalizeMetaField(
    value: string,
    mode: "country" | "email" | "external_id" | "phone" | "postal" | "text",
  ): string | undefined {
    const trimmed = value.trim();
    if (trimmed.length === 0) return undefined;
    if (mode === "email") return trimmed.toLowerCase();
    if (mode === "phone") return trimmed.replace(/\D+/g, "");
    if (mode === "country") return trimmed.toLowerCase().replace(/\s+/g, "");
    if (mode === "postal") return trimmed.toLowerCase().replace(/\s+/g, "");
    if (mode === "external_id") return trimmed;
    return trimmed.toLowerCase().replace(/\s+/g, "");
  }

  private compactRecord<T extends Record<string, unknown>>(record: T): T {
    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => value !== undefined && value !== null),
    ) as T;
  }

  private compactStringRecord(record: Record<string, string | undefined>): Record<string, string> {
    return Object.entries(record).reduce<Record<string, string>>((result, [key, value]) => {
      if (typeof value === "string" && value.length > 0) result[key] = value;
      return result;
    }, {});
  }

  private parseGa4SessionId(value?: string): number | undefined {
    if (!value) return undefined;
    const digitsOnly = value.replace(/\D+/g, "");
    if (digitsOnly.length === 0) return undefined;
    const parsed = Number(digitsOnly);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  private toGa4TimestampMicros(timestamp: string): string {
    const date = new Date(timestamp);
    const epochMillis = date.getTime();
    const safeMillis = Number.isNaN(epochMillis) ? Date.now() : epochMillis;
    return String(safeMillis * 1000);
  }

  private getGa4ValidationMessageCount(responseText: string): number {
    try {
      const parsed = JSON.parse(responseText) as { validationMessages?: unknown[] };
      return Array.isArray(parsed.validationMessages) ? parsed.validationMessages.length : 0;
    } catch {
      return 0;
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private mapEventName(name: string, provider: "meta" | "ga4" | "tiktok"): string {
    const common = name.toLowerCase().trim();

    if (provider === "meta") {
      if (common === "purchase") return "Purchase";
      if (common === "addtocart" || common === "add_to_cart") return "AddToCart";
      if (common === "begincheckout" || common === "begin_checkout") return "InitiateCheckout";
      if (common === "viewcontent" || common === "view_item") return "ViewContent";
      if (common === "page_view" || common === "pageview") return "PageView";
      if (common === "complete_registration" || common === "completeregistration") return "CompleteRegistration";
      if (common === "search") return "Search";
      if (common === "lead") return "Lead";
      if (common === "add_payment_info" || common === "addpaymentinfo") return "AddPaymentInfo";
      return name;
    }

    if (provider === "tiktok") {
      if (common === "purchase") return "CompletePayment";
      if (common === "add_to_cart" || common === "addtocart") return "AddToCart";
      if (common === "begin_checkout" || common === "begincheckout") return "InitiateCheckout";
      if (common === "page_view" || common === "pageview") return "PageView";
      if (common === "viewcontent" || common === "view_item") return "ViewContent";
      if (common === "complete_registration" || common === "sign_up") return "CompleteRegistration";
      if (common === "search") return "Search";
      if (common === "lead") return "SubmitForm";
      if (common === "add_payment_info") return "AddPaymentInfo";
      return name;
    }

    if (provider === "ga4") {
      if (common === "purchase") return "purchase";
      if (common === "add_to_cart" || common === "addtocart") return "add_to_cart";
      if (common === "begin_checkout" || common === "begincheckout") return "begin_checkout";
      if (common === "add_shipping_info" || common === "addshippinginfo") return "add_shipping_info";
      if (common === "add_payment_info" || common === "addpaymentinfo") return "add_payment_info";
      if (common === "page_view" || common === "pageview") return "page_view";
      if (common === "generate_lead" || common === "lead") return "generate_lead";
      if (common === "remove_from_cart" || common === "removefromcart") return "remove_from_cart";
      if (common === "search") return "search";
      if (common === "sign_up" || common === "signup") return "sign_up";
      if (common === "login" || common === "log_in") return "login";
      if (common === "view_cart" || common === "viewcart") return "view_cart";
      if (common === "view_item" || common === "viewcontent") return "view_item";
      if (common === "view_item_list" || common === "viewitemlist") return "view_item_list";
      if (common === "select_item" || common === "selectitem") return "select_item";
      if (common === "refund") return "refund";
      return name.replace(/\s+/g, "_").toLowerCase();
    }

    return name;
  }
}

/* ---------- Module-level utility ---------- */

function readStringProp(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

function compactStringRecord(record: Record<string, string | undefined>): Record<string, string> {
  return Object.entries(record).reduce<Record<string, string>>((result, [key, value]) => {
    if (typeof value === "string" && value.length > 0) result[key] = value;
    return result;
  }, {});
}
