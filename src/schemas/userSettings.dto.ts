import { z } from 'zod'

/**
 * 話者ごとの詳細設定のスキーマ
 */
export const SpeakerConfigSchema = z.object({
  /** 話速（0.5〜2.0） */
  speedScale: z.number().min(0.5).max(2.0).default(1.0),
  /** 音高（-0.15〜0.15） */
  pitchScale: z.number().min(-0.15).max(0.15).default(0.0),
  /** 音量（0.0〜2.0） */
  volumeScale: z.number().min(0.0).max(2.0).default(1.0),
  /** 抑揚（0.0〜2.0） */
  intonationScale: z.number().min(0.0).max(2.0).default(1.0)
})

/**
 * ユーザー設定のスキーマ定義
 */
export const UserSettingsSchema = z.object({
  /** 現在選択中の話者ID（スタイルID） */
  currentSpeakerId: z.number().int(),
  /** 話者ごとの設定（話者IDをキーとする） */
  speakerSettings: z.record(z.string(), SpeakerConfigSchema).default({})
})

/**
 * 話者ごとの詳細設定の型
 */
export type SpeakerConfig = z.infer<typeof SpeakerConfigSchema>

/**
 * ユーザー設定の型
 */
export type UserSettings = z.infer<typeof UserSettingsSchema>

/**
 * 話者設定の部分更新用の型
 */
export type SpeakerConfigUpdate = Partial<SpeakerConfig>
