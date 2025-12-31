import Redis from 'ioredis'
import { config } from '../config'
import { type UserSettings, UserSettingsSchema, type UserSettingsUpdate } from '../schemas/userSettings.dto'

/**
 * Redisクライアント
 */
export const redis = new Redis(config.REDIS_URL)

/**
 * ユーザー設定のキープレフィックス
 */
const USER_SETTINGS_KEY_PREFIX = 'user:settings:'

/**
 * デフォルトのユーザー設定を生成する
 * @returns デフォルト設定
 */
const createDefaultSettings = (): UserSettings => ({
  speakerId: config.DEFAULT_SPEAKER_ID,
  speedScale: 1.0,
  pitchScale: 0.0,
  volumeScale: 1.0,
  intonationScale: 1.0,
})

/**
 * ユーザー設定を取得する
 * @param userId DiscordユーザーID
 * @returns ユーザー設定（未設定の場合はデフォルト値）
 */
export const getUserSettings = async (userId: string): Promise<UserSettings> => {
  const data = await redis.get(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
  if (data === null) {
    return createDefaultSettings()
  }

  const parseResult = UserSettingsSchema.safeParse(JSON.parse(data))
  if (!parseResult.success) {
    console.error(`Invalid user settings for ${userId}:`, parseResult.error)
    return createDefaultSettings()
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
 * ユーザー設定を部分更新する
 * @param userId DiscordユーザーID
 * @param update 更新する設定（部分的でOK）
 * @returns 更新後の設定
 */
export const updateUserSettings = async (userId: string, update: UserSettingsUpdate): Promise<UserSettings> => {
  const current = await getUserSettings(userId)
  const updated = { ...current, ...update }
  await setUserSettings(userId, updated)
  return updated
}

/**
 * ユーザー設定を削除する（デフォルトに戻す）
 * @param userId DiscordユーザーID
 */
export const deleteUserSettings = async (userId: string): Promise<void> => {
  await redis.del(`${USER_SETTINGS_KEY_PREFIX}${userId}`)
}

/**
 * ユーザーの話者IDを取得する（ショートカット）
 * @param userId DiscordユーザーID
 * @returns 話者ID
 */
export const getUserSpeakerId = async (userId: string): Promise<number> => {
  const settings = await getUserSettings(userId)
  return settings.speakerId
}

/**
 * ユーザーの話者IDを設定する（ショートカット）
 * @param userId DiscordユーザーID
 * @param speakerId 話者ID
 */
export const setUserSpeakerId = async (userId: string, speakerId: number): Promise<void> => {
  await updateUserSettings(userId, { speakerId })
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
