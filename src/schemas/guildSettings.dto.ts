import { z } from 'zod'

/**
 * ギルド設定のスキーマ定義
 */
export const GuildSettingsSchema = z.object({
  /** VCに参加していないユーザーのチャットを読み上げるか */
  readNonVcUsers: z.boolean().default(false),
  /** ユーザーのVC参加時に「XXが参加しました」と読み上げるか */
  announceJoin: z.boolean().default(false),
  /** ユーザーのVC退出時に「XXが退席しました」と読み上げるか */
  announceLeave: z.boolean().default(false)
})

/**
 * ギルド設定の型
 */
export type GuildSettings = z.infer<typeof GuildSettingsSchema>

/**
 * ギルド設定の部分更新用の型
 */
export type GuildSettingsUpdate = Partial<GuildSettings>
