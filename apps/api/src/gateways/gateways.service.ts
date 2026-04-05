import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { CreateGatewayConfigInput, UpdateGatewayConfigInput } from "@sst/shared";

import { PrismaService } from "../common/prisma.service";

type GatewayVerificationState = {
  checkedAt: string;
  message: string;
  mode: "ga4_debug" | "meta_live";
  status: "failed" | "verified";
};

@Injectable()
export class GatewaysService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(accountId: string) {
    return this.prisma.gatewayConfig.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(accountId: string, input: CreateGatewayConfigInput) {
    if (input.containerId) {
      const container = await this.prisma.container.findFirst({
        where: { id: input.containerId, accountId },
      });

      if (!container) {
        throw new NotFoundException("Container not found for this account.");
      }
    }

    return this.prisma.gatewayConfig.create({
      data: {
        accountId,
        containerId: input.containerId,
        provider: input.provider,
        credentials: input.credentials,
        settings: input.settings,
        enabled: input.enabled,
      },
    });
  }

  async testConnection(id: string, accountId: string) {
    const existing = await this.prisma.gatewayConfig.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      throw new NotFoundException("Gateway config not found.");
    }

    if (existing.provider !== "meta" && existing.provider !== "ga4") {
      throw new BadRequestException("Test Connection is only available for Meta and GA4 right now.");
    }

    const verification =
      existing.provider === "meta"
        ? await this.testMetaConnection(existing)
        : await this.testGa4Connection(existing);

    const settings = this.toRecord(existing.settings);
    const updated = await this.prisma.gatewayConfig.update({
      where: { id },
      data: {
        settings: {
          ...settings,
          verification,
        },
      },
    });

    return {
      ok: verification.status === "verified",
      item: updated,
      message: verification.message,
    };
  }

  async update(id: string, accountId: string, input: UpdateGatewayConfigInput) {
    const existing = await this.prisma.gatewayConfig.findFirst({
      where: { id, accountId },
    });

    if (!existing) {
      throw new NotFoundException("Gateway config not found.");
    }

    if (input.containerId) {
      const container = await this.prisma.container.findFirst({
        where: { id: input.containerId, accountId },
      });

      if (!container) {
        throw new NotFoundException("Container not found for this account.");
      }
    }

    return this.prisma.gatewayConfig.update({
      where: { id },
      data: {
        containerId: input.containerId,
        provider: input.provider,
        credentials: input.credentials,
        settings: input.settings,
        enabled: input.enabled,
      },
    });
  }

  private async testMetaConnection(config: {
    credentials: unknown;
    settings: unknown;
  }): Promise<GatewayVerificationState> {
    const credentials = this.toRecord(config.credentials);
    const settings = this.toRecord(config.settings);
    const pixelId = this.readString(credentials.pixelId);
    const accessToken = this.readString(credentials.accessToken);
    const testEventCode = this.readString(settings.testEventCode);
    const checkedAt = new Date().toISOString();

    if (!pixelId || !accessToken) {
      return {
        checkedAt,
        message: "Meta Pixel ID and access token must both be present before testing.",
        mode: "meta_live",
        status: "failed",
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/v17.0/${pixelId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: [
            {
              event_name: "PageView",
              event_time: Math.floor(Date.now() / 1000),
              event_id: `gateway-test-${Date.now()}`,
              action_source: "website",
              event_source_url: "https://sst.local/gateway-test",
              user_data: {
                client_ip_address: "127.0.0.1",
                client_user_agent: "SSTGatewayTest/1.0",
              },
            },
          ],
          access_token: accessToken,
          ...(testEventCode ? { test_event_code: testEventCode } : {}),
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          checkedAt,
          message: this.extractProviderError(
            responseText,
            "Meta rejected the test request. Check the pixel ID, access token, and test event code.",
          ),
          mode: "meta_live",
          status: "failed",
        };
      }

      return {
        checkedAt,
        message: testEventCode
          ? "Meta accepted a live test event using your test event code."
          : "Meta accepted a live event with the saved pixel ID and access token.",
        mode: "meta_live",
        status: "verified",
      };
    } catch (error) {
      return {
        checkedAt,
        message: this.toErrorMessage(error, "Meta test connection failed before a response came back."),
        mode: "meta_live",
        status: "failed",
      };
    }
  }

  private async testGa4Connection(config: {
    credentials: unknown;
  }): Promise<GatewayVerificationState> {
    const credentials = this.toRecord(config.credentials);
    const measurementId = this.readString(credentials.measurementId);
    const apiSecret = this.readString(credentials.apiSecret);
    const checkedAt = new Date().toISOString();

    if (!measurementId || !apiSecret) {
      return {
        checkedAt,
        message: "GA4 Measurement ID and API secret must both be present before testing.",
        mode: "ga4_debug",
        status: "failed",
      };
    }

    try {
      const response = await fetch(
        `https://www.google-analytics.com/debug/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: `${Date.now()}.${Date.now() + 1}`,
            validation_behavior: "ENFORCE_RECOMMENDATIONS",
            events: [
              {
                name: "page_view",
                params: {
                  page_location: "https://sst.local/gateway-test",
                  engagement_time_msec: 1,
                  session_id: Number(String(Date.now()).slice(-10)),
                  debug_mode: 1,
                },
              },
            ],
          }),
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        return {
          checkedAt,
          message: this.extractProviderError(
            responseText,
            "GA4 rejected the debug validation request. Check the measurement ID and API secret.",
          ),
          mode: "ga4_debug",
          status: "failed",
        };
      }

      const validationMessages = this.extractGa4ValidationMessages(responseText);
      if (validationMessages.length > 0) {
        return {
          checkedAt,
          message: `GA4 returned validation feedback: ${validationMessages[0]}`,
          mode: "ga4_debug",
          status: "failed",
        };
      }

      return {
        checkedAt,
        message:
          "GA4 accepted a live debug validation event with zero validation messages. This verifies the request shape, though Google does not expose a stronger credential handshake here.",
        mode: "ga4_debug",
        status: "verified",
      };
    } catch (error) {
      return {
        checkedAt,
        message: this.toErrorMessage(error, "GA4 test connection failed before a response came back."),
        mode: "ga4_debug",
        status: "failed",
      };
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private extractProviderError(responseText: string, fallback: string): string {
    try {
      const parsed = JSON.parse(responseText) as {
        error?: { message?: string };
      };
      const message = parsed.error?.message;
      return typeof message === "string" && message.trim().length > 0 ? message : fallback;
    } catch {
      return responseText.trim().length > 0 ? responseText.trim() : fallback;
    }
  }

  private extractGa4ValidationMessages(responseText: string): string[] {
    try {
      const parsed = JSON.parse(responseText) as {
        validationMessages?: Array<{ description?: string }>;
      };

      return Array.isArray(parsed.validationMessages)
        ? parsed.validationMessages
            .map((message) => message.description)
            .filter((message): message is string => typeof message === "string" && message.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  }
}
