CREATE DATABASE IF NOT EXISTS tracking;

CREATE TABLE IF NOT EXISTS tracking.events
(
  event_id UUID,
  account_id UUID,
  container_id UUID,
  event_name String,
  event_time DateTime64(3),
  client_id String,
  session_id String,
  ip IPv4,
  country LowCardinality(String),
  city String,
  device_type LowCardinality(String),
  os LowCardinality(String),
  browser LowCardinality(String),
  page_url String,
  referrer String,
  utm_source LowCardinality(String),
  utm_medium LowCardinality(String),
  utm_campaign String,
  revenue Decimal(18, 2),
  currency LowCardinality(String) DEFAULT 'USD',
  properties String,
  destinations Array(String),
  status LowCardinality(String) DEFAULT 'sent',
  server_time DateTime DEFAULT now()
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (account_id, container_id, event_time)
TTL toDateTime(event_time) + INTERVAL 90 DAY;
