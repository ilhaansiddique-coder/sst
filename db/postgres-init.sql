CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Plan') THEN
    CREATE TYPE "Plan" AS ENUM ('hobby', 'starter', 'growth', 'scale', 'enterprise');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('owner', 'admin', 'member');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContainerRegion') THEN
    CREATE TYPE "ContainerRegion" AS ENUM ('global', 'eu', 'us', 'apac');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContainerStatus') THEN
    CREATE TYPE "ContainerStatus" AS ENUM ('active', 'paused', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GatewayProvider') THEN
    CREATE TYPE "GatewayProvider" AS ENUM ('meta', 'tiktok', 'snap', 'ga4', 'google_ads');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'past_due', 'canceled', 'trialing');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuthTokenType') THEN
    CREATE TYPE "AuthTokenType" AS ENUM ('email_verification', 'password_reset');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan "Plan" NOT NULL DEFAULT 'hobby',
  event_quota BIGINT NOT NULL DEFAULT 500000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role "UserRole" NOT NULL DEFAULT 'member',
  oauth_provider TEXT,
  oauth_id TEXT,
  email_verified_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gtm_id TEXT,
  server_url TEXT,
  custom_domain TEXT,
  region "ContainerRegion" NOT NULL DEFAULT 'global',
  status "ContainerStatus" NOT NULL DEFAULT 'active',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kv_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  collection TEXT NOT NULL DEFAULT 'default',
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  ttl TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, collection, key)
);

CREATE TABLE IF NOT EXISTS gateway_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  container_id UUID REFERENCES containers(id) ON DELETE SET NULL,
  provider "GatewayProvider" NOT NULL,
  credentials JSONB NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  stripe_sub_id TEXT UNIQUE,
  plan "Plan" NOT NULL,
  status "SubscriptionStatus" NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS usage_monthly (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  events_total BIGINT NOT NULL DEFAULT 0,
  events_meta BIGINT NOT NULL DEFAULT 0,
  events_tiktok BIGINT NOT NULL DEFAULT 0,
  events_google BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, month)
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type "AuthTokenType" NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kv_lookup ON kv_store (account_id, collection, key);
CREATE INDEX IF NOT EXISTS idx_kv_ttl ON kv_store (ttl) WHERE ttl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup ON user_sessions (user_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_account_user ON user_sessions (account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_lookup ON auth_tokens (user_id, type, consumed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_account_type ON auth_tokens (account_id, type);
CREATE INDEX IF NOT EXISTS idx_auth_audit_account_created ON auth_audit_events (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_user_created ON auth_audit_events (user_id, created_at DESC);

ALTER TABLE containers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'containers'
      AND policyname = 'containers_isolation'
  ) THEN
    CREATE POLICY containers_isolation ON containers
      USING (
        current_setting('app.current_account_id', true) IS NOT NULL
        AND account_id = current_setting('app.current_account_id', true)::UUID
      );
  END IF;
END $$;
