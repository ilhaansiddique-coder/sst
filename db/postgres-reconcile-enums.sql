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
END $$;

ALTER TABLE accounts
  ALTER COLUMN plan DROP DEFAULT,
  ALTER COLUMN plan TYPE "Plan" USING plan::"Plan",
  ALTER COLUMN plan SET DEFAULT 'hobby'::"Plan";

ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE "UserRole" USING role::"UserRole",
  ALTER COLUMN role SET DEFAULT 'member'::"UserRole";

ALTER TABLE containers
  ALTER COLUMN region DROP DEFAULT,
  ALTER COLUMN region TYPE "ContainerRegion" USING region::"ContainerRegion",
  ALTER COLUMN region SET DEFAULT 'global'::"ContainerRegion",
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE "ContainerStatus" USING status::"ContainerStatus",
  ALTER COLUMN status SET DEFAULT 'active'::"ContainerStatus";

ALTER TABLE gateway_configs
  ALTER COLUMN provider TYPE "GatewayProvider" USING provider::"GatewayProvider";

ALTER TABLE subscriptions
  ALTER COLUMN plan TYPE "Plan" USING plan::"Plan",
  ALTER COLUMN status TYPE "SubscriptionStatus" USING status::"SubscriptionStatus";
