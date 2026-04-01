export type EventLogStatus = "received" | "processed" | "failed" | "delivered";

export interface EventLogRecord {
  eventId: string;
  accountId?: string;
  containerId?: string;
  eventName: string;
  timestamp: string;
  clientId: string;
  pageUrl?: string;
  destinations: string[];
  status: EventLogStatus;
  source: "processor";
  receivedAt: string;
}

export class EventsStore {
  private readonly events: EventLogRecord[] = [];

  add(record: EventLogRecord): EventLogRecord {
    this.events.unshift(record);

    if (this.events.length > 100) {
      this.events.length = 100;
    }

    return record;
  }

  list(limit = 50): EventLogRecord[] {
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    return this.events.slice(0, normalizedLimit);
  }
}
