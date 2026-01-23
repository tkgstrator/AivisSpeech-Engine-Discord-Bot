import { type GuildSettings, GuildSettingsSchema, type GuildSettingsUpdate } from '../schemas/guildSettings.dto'
import { redis } from './redis'

/**
 * デフォルトのギルド設定
 */
const defaultGuildSettings: GuildSettings = {
  readNonVcUsers: true,
  announceJoin: true,
  announceLeave: true,
  readChannels: []
}

/**
 * ギルド設定を取得する
 * @param guildId - ギルドID
 * @returns ギルド設定
 */
export const getGuildSettings = async (guildId: string): Promise<GuildSettings> => {
  const key = `guild:${guildId}:settings`
  const data = await redis.get(key)

  if (!data) {
    return defaultGuildSettings
  }

  const parsed = GuildSettingsSchema.safeParse(JSON.parse(data))
  if (!parsed.success) {
    console.error('Invalid guild settings data:', parsed.error)
    return defaultGuildSettings
  }

  return parsed.data
}

/**
 * ギルド設定を保存する
 * @param guildId - ギルドID
 * @param settings - ギルド設定
 */
export const setGuildSettings = async (guildId: string, settings: GuildSettings): Promise<void> => {
  const key = `guild:${guildId}:settings`
  await redis.set(key, JSON.stringify(settings))
}

/**
 * ギルド設定を部分的に更新する
 * @param guildId - ギルドID
 * @param updates - 更新する設定項目
 */
export const updateGuildSettings = async (guildId: string, updates: GuildSettingsUpdate): Promise<void> => {
  const current = await getGuildSettings(guildId)
  const updated = { ...current, ...updates }
  await setGuildSettings(guildId, updated)
}

/**
 * ギルド設定を削除する（デフォルトに戻す）
 * @param guildId - ギルドID
 */
export const deleteGuildSettings = async (guildId: string): Promise<void> => {
  const key = `guild:${guildId}:settings`
  await redis.del(key)
}
