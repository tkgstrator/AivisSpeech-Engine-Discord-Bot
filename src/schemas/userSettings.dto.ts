import { z } from 'zod'

/**
 * 話者ごとの詳細設定のスキーマ
 */
export const SpeakerConfigSchema = z.object({
  /** 話速（0.5〜2.0、デフォルト: 1.0） */
  speed: z.number().min(0.5).max(2.0).default(1.0),
  /** 音高（-0.15〜0.15、デフォルト: 0.0） */
  pitch: z.number().min(-0.15).max(0.15).default(0.0),
  /** 音量（0.0〜2.0、デフォルト: 1.0） */
  volume: z.number().min(0.0).max(2.0).default(1.0),
  /** 抑揚（0.0〜2.0、デフォルト: 1.0） */
  intonation: z.number().min(0.0).max(2.0).default(1.0)
})

/**
 * 話者設定の部分更新用のスキーマ
 */
export const SpeakerConfigUpdateSchema = SpeakerConfigSchema.partial()

/**
 * ユーザー設定のスキーマ定義
 */
export const UserSettingsSchema = z.object({
  speaker: z.object({
    currentId: z.number().int().positive(),
    settings: z.record(z.coerce.number().int().positive(), SpeakerConfigSchema).default({})
  })
})

/**
 * 話者ごとの詳細設定の型
 */
export type SpeakerConfig = z.infer<typeof SpeakerConfigSchema>

/**
 * 話者設定の部分更新用の型
 */
export type SpeakerConfigUpdate = z.infer<typeof SpeakerConfigUpdateSchema>

/**
 * ユーザー設定の型
 */
export type UserSettings = z.infer<typeof UserSettingsSchema>
