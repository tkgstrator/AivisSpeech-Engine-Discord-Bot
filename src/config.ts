import { z } from 'zod'

/**
 * 環境変数のスキーマ定義
 */
const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  AIVIS_BASE_URL: z.string().url().default('http://aivis:10101'),
  DEFAULT_SPEAKER_ID: z.coerce.number().int().default(1633968992),
  REDIS_URL: z.string().default('redis://redis:6379')
})

/**
 * 環境変数のバリデーション結果
 */
const env = EnvSchema.safeParse(process.env)

if (!env.success) {
  console.error('Environment validation failed:', env.error.format())
  process.exit(1)
}

/**
 * バリデーション済みの設定値
 */
export const config = env.data
