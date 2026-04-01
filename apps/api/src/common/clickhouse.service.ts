import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { createClient, type ClickHouseClient } from "@clickhouse/client";

import { getApiEnv } from "./env";

type RecentEventRow = {
  eventId: string;
  accountId: string;
  containerId: string;
  eventName: string;
  timestamp: string;
  clientId: string;
  sessionId: string;
  ip: string;
  pageUrl: string;
  referrer: string;
  revenue: number;
  currency: string;
  destinations: string[];
  status: string;
  source: "processor";
  receivedAt: string;
};

type AnalyticsSummaryRow = {
  totalEvents: string;
  uniqueClients: string;
  totalRevenue: number;
  deliveredEvents: string;
  failedEvents: string;
};

type TimeseriesRow = {
  bucket: string;
  totalEvents: string;
  revenue: number;
  uniqueClients: string;
};

@Injectable()
export class ClickHouseService implements OnModuleDestroy {
  private readonly client: ClickHouseClient = createClient({
    url: getApiEnv().CLICKHOUSE_URL,
  });

  async ping(): Promise<boolean> {
    const result = await this.client.ping();
    return result.success;
  }

  async listRecentEvents(params: {
    limit: number;
    accountId?: string;
    containerId?: string;
  }): Promise<RecentEventRow[]> {
    const conditions = ["1 = 1"];

    if (params.accountId) {
      conditions.push("account_id = toUUID({accountId:String})");
    }

    if (params.containerId) {
      conditions.push("container_id = toUUID({containerId:String})");
    }

    const result = await this.client.query({
      query: `
        SELECT
          toString(event_id) AS eventId,
          toString(account_id) AS accountId,
          toString(container_id) AS containerId,
          event_name AS eventName,
          formatDateTime(event_time, '%FT%TZ') AS timestamp,
          client_id AS clientId,
          session_id AS sessionId,
          toString(ip) AS ip,
          page_url AS pageUrl,
          referrer,
          toFloat64(revenue) AS revenue,
          currency,
          destinations,
          status,
          'processor' AS source,
          formatDateTime(server_time, '%FT%TZ') AS receivedAt
        FROM tracking.events
        WHERE ${conditions.join(" AND ")}
        ORDER BY event_time DESC
        LIMIT {limit:UInt32}
      `,
      format: "JSON",
      query_params: {
        accountId: params.accountId,
        containerId: params.containerId,
        limit: params.limit,
      },
    });

    const json = (await result.json()) as unknown as { data: RecentEventRow[] };
    return json.data;
  }

  async getAnalyticsSummary(params: {
    days: number;
    accountId?: string;
    containerId?: string;
  }): Promise<AnalyticsSummaryRow> {
    const conditions = ["event_time >= now() - toIntervalDay({days:UInt32})"];

    if (params.accountId) {
      conditions.push("account_id = toUUID({accountId:String})");
    }

    if (params.containerId) {
      conditions.push("container_id = toUUID({containerId:String})");
    }

    const result = await this.client.query({
      query: `
        SELECT
          count() AS totalEvents,
          uniqExact(client_id) AS uniqueClients,
          sum(revenue) AS totalRevenue,
          countIf(status = 'delivered') AS deliveredEvents,
          countIf(status = 'failed') AS failedEvents
        FROM tracking.events
        WHERE ${conditions.join(" AND ")}
      `,
      format: "JSON",
      query_params: {
        days: params.days,
        accountId: params.accountId,
        containerId: params.containerId,
      },
    });

    const json = (await result.json()) as unknown as { data: AnalyticsSummaryRow[] };
    return (
      json.data[0] ?? {
        totalEvents: "0",
        uniqueClients: "0",
        totalRevenue: 0,
        deliveredEvents: "0",
        failedEvents: "0",
      }
    );
  }

  async getEventTimeseries(params: {
    days: number;
    accountId?: string;
    containerId?: string;
  }): Promise<TimeseriesRow[]> {
    const conditions = ["event_time >= now() - toIntervalDay({days:UInt32})"];

    if (params.accountId) {
      conditions.push("account_id = toUUID({accountId:String})");
    }

    if (params.containerId) {
      conditions.push("container_id = toUUID({containerId:String})");
    }

    const result = await this.client.query({
      query: `
        SELECT
          formatDateTime(toStartOfDay(event_time), '%Y-%m-%d') AS bucket,
          count() AS totalEvents,
          sum(revenue) AS revenue,
          uniqExact(client_id) AS uniqueClients
        FROM tracking.events
        WHERE ${conditions.join(" AND ")}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      format: "JSON",
      query_params: {
        days: params.days,
        accountId: params.accountId,
        containerId: params.containerId,
      },
    });

    const json = (await result.json()) as unknown as { data: TimeseriesRow[] };
    return json.data;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
