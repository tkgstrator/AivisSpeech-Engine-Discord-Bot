import Redis from 'ioredis'
import { config } from '../config'
import {
  type SpeakerConfig,
  SpeakerConfigSchema,
  type SpeakerConfigUpdate,
  type UserSettings,
  UserSettingsSchema
} from '../schemas/userSettings.dto'

/**
 * Redisクライアント
 */
export const redis = new Redis(config.REDIS_URL)

/**
 * ユーザー設定のキープレフィックス
 */
const USER_SETTINGS_KEY_PREFIX = 'user:settings:'

/**
 * デフォルトの話者設定を生成する
 * @returns デフォルト設定
 */
const createDefaultSpeakerConfig = (): SpeakerConfig => ({
  speedScale: 1.0,
  pitchScale: 0.0,
  volumeScale: 1.0,
  intonationScale: 1.0
})

/**
 * デフォルトのユーザー設定を生成する
 * @returns デフォルト設定
 */
const createDefaultUserSettings = (): UserSettings => ({
  currentSpeakerId: config.DEFAULT_SPEAKER_ID,
  speakerSettings: {}
})

/**
 * ユーザー設定を取得する
 * @param userId DiscordユーザーID
 * @returns ユーザー設定（未設定の場合はデフォルト値）
 */
export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  const data = await redis.get(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
  if (data === null) {
    return createDefaultUserSettings()
  }

  const parseResult = UserSettingsSchema.safeParse(JSON.parse(data))
  if (!parseResult.success) {
    console.warn(`Invalid user settings for ${userId}, resetting to default:`, parseResult.error)
    // パースエラー時は既存データを削除してデフォルトを返す
    await redis.del(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
    return createDefaultUserSettings()
  }

  return parseResult.data
}

/**
 * ユーザー設定を保存する
 * @param userId DiscordユーザーID
 * @param settings ユーザー設定
 */
export const setUserSettings = async (userId: string, settings: UserSettings): Promise<void> => {
  const parseResult = UserSettingsSchema.safeParse(settings)
  if (!parseResult.success) {
    throw new Error(`Invalid settings: ${parseResult.error.message}`)
  }
  await redis.set(`${USER_SETTINGS_KEY_PREFIX}${userId}`, JSON.stringify(parseResult.data))
}

/**
 * 現在の話者IDを取得する
 * @param userId DiscordユーザーID
 * @returns 現在の話者ID
 */
export const getCurrentSpeakerId = async (userId: string): Promise<number> => {
  const settings = await getUserSettings(userId)
  return settings.currentSpeakerId
}

/**
 * 現在の話者IDを設定する
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 */
export const setCurrentSpeakerId = async (userId: string, speakerId: number): Promise<void> => {
  const settings = await getUserSettings(userId)
  settings.currentSpeakerId = speakerId
  await setUserSettings(userId, settings)
}

/**
 * 特定の話者の設定を取得する
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 * @returns 話者設定（未設定の場合はデフォルト値）
 */
export const getSpeakerConfig = async (userId: string, speakerId: number): Promise<SpeakerConfig> => {
  const settings = await getUserSettings(userId)
  const speakerKey = speakerId.toString()
  return settings.speakerSettings[speakerKey] ?? createDefaultSpeakerConfig()
}

/**
 * 特定の話者の設定を更新する
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 * @param update 更新する設定（部分的でOK）
 * @returns 更新後の話者設定
 */
export const updateSpeakerConfig = async (
  userId: string,
  speakerId: number,
  update: SpeakerConfigUpdate
): Promise<SpeakerConfig> => {
  const settings = await getUserSettings(userId)
  const speakerKey = speakerId.toString()
  const current = settings.speakerSettings[speakerKey] ?? createDefaultSpeakerConfig()
  const updated = { ...current, ...update }

  // バリデーション
  const parseResult = SpeakerConfigSchema.safeParse(updated)
  if (!parseResult.success) {
    throw new Error(`Invalid speaker config: ${parseResult.error.message}`)
  }

  settings.speakerSettings[speakerKey] = parseResult.data
  await setUserSettings(userId, settings)
  return parseResult.data
}

/**
 * 現在の話者の設定を取得する
 * @param userId DiscordユーザーID
 * @returns 現在の話者設定
 */
export const getCurrentSpeakerConfig = async (userId: string): Promise<SpeakerConfig> => {
  const settings = await getUserSettings(userId)
  return getSpeakerConfig(userId, settings.currentSpeakerId)
}

/**
 * 現在の話者の設定を更新する
 * @param userId DiscordユーザーID
 * @param update 更新する設定（部分的でOK）
 * @returns 更新後の話者設定
 */
export const updateCurrentSpeakerConfig = async (
  userId: string,
  update: SpeakerConfigUpdate
): Promise<SpeakerConfig> => {
  const settings = await getUserSettings(userId)
  return updateSpeakerConfig(userId, settings.currentSpeakerId, update)
}

/**
 * ユーザー設定を削除する（デフォルトに戻す）
 * @param userId DiscordユーザーID
 */
export const deleteUserSettings = async (userId: string): Promise<void> => {
  await redis.del(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
}

/**
 * ユーザーの話者IDを取得する（後方互換性のため残す）
 * @param userId DiscordユーザーID
 * @returns 話者ID
 * @deprecated getCurrentSpeakerIdを使用してください
 */
export const getUserSpeakerId = async (userId: string): Promise<number> => {
  return getCurrentSpeakerId(userId)
}

/**
 * ユーザーの話者IDを設定する（後方互換性のため残す）
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 * @deprecated setCurrentSpeakerIdを使用してください
 */
export const setUserSpeakerId = async (userId: string, speakerId: number): Promise<void> => {
  await setCurrentSpeakerId(userId, speakerId)
}

/**
 * Redisへの接続確認
 */
export const pingRedis = async (): Promise<boolean> => {
  try {
    const result = await redis.ping()
    return result === 'PONG'
  } catch {
    return false
  }
}
