import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  AUTH_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().default(""),
  DEFAULT_LOCALE: z.enum(["en", "ar", "fr"]).default("en"),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(
  source: Record<string, string | undefined> = process.env,
): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }
  return result.data;
}
