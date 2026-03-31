import { z } from "zod";

const apiEnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  CLICKHOUSE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16),
  REFRESH_TOKEN_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(32),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function getApiEnv(): ApiEnv {
  return apiEnvSchema.parse(process.env);
}
