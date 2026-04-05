import { z } from "zod";

const processorEnvSchema = z.object({
  PORT: z.coerce.number().default(3002),
  API_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  CLICKHOUSE_URL: z.string().url(),
  CLICKHOUSE_USER: z.string().min(1).default("tracking"),
  CLICKHOUSE_PASSWORD: z.string().default(""),
});

export type ProcessorEnv = z.infer<typeof processorEnvSchema>;

export function getProcessorEnv(): ProcessorEnv {
  return processorEnvSchema.parse(process.env);
}
