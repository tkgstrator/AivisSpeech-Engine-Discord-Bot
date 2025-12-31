import { z } from 'zod'

/**
 * ユーザー設定のスキーマ定義
 */
export const UserSettingsSchema = z.object({
  /** 話者ID（スタイルID） */
  speakerId: z.number().int(),
  /** 話速（0.5〜2.0） */
  speedScale: z.number().min(0.5).max(2.0).default(1.0),
  /** 音高（-0.15〜0.15） */
  pitchScale: z.number().min(-0.15).max(0.15).default(0.0),
  /** 音量（0.0〜2.0） */
  volumeScale: z.number().min(0.0).max(2.0).default(1.0),
  /** 抑揚（0.0〜2.0） */
  intonationScale: z.number().min(0.0).max(2.0).default(1.0),
})

/**
 * ユーザー設定の型
 */
export type UserSettings = z.infer<typeof UserSettingsSchema>

/**
 * ユーザー設定の部分更新用の型
 */
export type UserSettingsUpdate = Partial<UserSettings>
