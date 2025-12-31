import {
  type VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice'
import type { VoiceBasedChannel } from 'discord.js'

/**
 * ボイスチャンネルに接続する
 * @param channel 接続先のボイスチャンネル
 * @returns VoiceConnection
 */
export const connectToChannel = async (channel: VoiceBasedChannel): Promise<VoiceConnection> => {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  })

  try {
    // 接続が確立されるまで待機（最大30秒）
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
    console.log(`Connected to voice channel: ${channel.name}`)
    return connection
  } catch (error) {
    connection.destroy()
    throw error
  }
}

/**
 * ギルドのボイス接続を取得する
 * @param guildId ギルドID
 * @returns VoiceConnection | undefined
 */
export const getConnection = (guildId: string): VoiceConnection | undefined => {
  return getVoiceConnection(guildId)
}

/**
 * ボイスチャンネルから切断する
 * @param guildId ギルドID
 */
export const disconnectFromChannel = (guildId: string): void => {
  const connection = getVoiceConnection(guildId)
  if (connection) {
    connection.destroy()
    console.log(`Disconnected from voice channel in guild: ${guildId}`)
  }
}
