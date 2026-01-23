import { z } from 'zod'

/**
 * ギルド設定のスキーマ定義
 */
export const GuildSettingsSchema = z.object({
  /** VCに参加していないユーザーのチャットを読み上げるか */
  readNonVcUsers: z.boolean().default(true),
  /** ユーザーのVC参加時に「XXが参加しました」と読み上げるか */
  announceJoin: z.boolean().default(true),
  /** ユーザーのVC退出時に「XXが退席しました」と読み上げるか */
  announceLeave: z.boolean().default(true),
  /** 読み上げ対象のチャンネルIDリスト（空の場合は全チャンネル） */
  readChannels: z.array(z.string()).default([])
})

/**
 * ギルド設定の型
 */
export type GuildSettings = z.infer<typeof GuildSettingsSchema>

/**
 * ギルド設定の部分更新用の型
 */
export type GuildSettingsUpdate = Partial<GuildSettings>
