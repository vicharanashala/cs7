// Centralized, validated environment configuration.
// Fail fast at startup if required variables are missing or malformed.
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  LLM_PROVIDER: z.enum(['mock', 'gemini', 'local-llama', 'ollama', 'groq']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['mock', 'gemini', 'ollama']).default('mock'),
  // LLM server (rag/llm-server) — used when LLM_PROVIDER=local-llama
  LLM_BASE_URL: z.string().url().optional(),
  LLM_INTERNAL_SECRET: z.string().optional(),
  // Ollama — used when LLM_PROVIDER=ollama (no API key needed)
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('gemma3:4b'),
  // Groq — used when LLM_PROVIDER=groq. Free tier: 14,400 req/day, 30 req/min.
  // Models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768.
  // Get a free key at https://console.groq.com
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Print human-readable validation errors and exit. Do this before logger init.
  console.error('❌ Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
} as const;
