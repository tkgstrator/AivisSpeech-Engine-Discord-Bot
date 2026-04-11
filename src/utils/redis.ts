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
  speed: 1.0,
  pitch: 0.0,
  volume: 1.0,
  intonation: 1.0
})

/**
 * デフォルトのユーザー設定を生成する
 * @returns デフォルト設定
 */
const createDefaultUserSettings = (): UserSettings => ({
  speaker: {
    currentId: config.DEFAULT_SPEAKER_ID,
    settings: {}
  }
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
  return settings.speaker.currentId
}

/**
 * 現在の話者IDを設定する
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 */
export const setCurrentSpeakerId = async (userId: string, speakerId: number): Promise<void> => {
  const settings = await getUserSettings(userId)
  settings.speaker.currentId = speakerId
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
  return settings.speaker.settings[speakerId] ?? createDefaultSpeakerConfig()
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
  const current = settings.speaker.settings[speakerId] ?? createDefaultSpeakerConfig()
  const updated = { ...current, ...update }

  // バリデーション
  const parseResult = SpeakerConfigSchema.safeParse(updated)
  if (!parseResult.success) {
    throw new Error(`Invalid speaker config: ${parseResult.error.message}`)
  }

  settings.speaker.settings[speakerId] = parseResult.data
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
  return getSpeakerConfig(userId, settings.speaker.currentId)
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
  return updateSpeakerConfig(userId, settings.speaker.currentId, update)
}

/**
 * ユーザー設定を削除する（デフォルトに戻す）
 * @param userId DiscordユーザーID
 */
export const deleteUserSettings = async (userId: string): Promise<void> => {
  await redis.del(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
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
