import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus
} from '@discordjs/voice'
import type { VoiceBasedChannel } from 'discord.js'
import { notifyError } from '../utils/notifier'
import { destroyPlayer } from './player'

/**
 * ボイスチャンネルに接続する
 * 接続後、切断時のリカバリ処理を自動で登録する
 * @param channel 接続先のボイスチャンネル
 * @returns VoiceConnection
 */
export const connectToChannel = async (channel: VoiceBasedChannel): Promise<VoiceConnection> => {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  })

  try {
    // 接続が確立されるまで待機（最大30秒）
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
    console.log(`Connected to voice channel: ${channel.name}`)
    setupConnectionRecovery(connection, channel.guild.id)
    return connection
  } catch (error) {
    connection.destroy()
    throw error
  }
}

/**
 * 接続切断時のリカバリ処理を設定する
 * - WebSocket切断（コード4014）: Discordによる強制切断のため再接続しない
 * - それ以外の切断: 再接続を試行する（最大5秒待機）
 * - Destroyed状態: プレイヤーをクリーンアップする
 * @param connection VoiceConnection
 * @param guildId ギルドID
 */
const setupConnectionRecovery = (connection: VoiceConnection, guildId: string): void => {
  connection.on(VoiceConnectionStatus.Disconnected, async (_oldState, newState) => {
    // WebSocket close code 4014: サーバー側からの切断（チャンネル移動やキック）
    if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
      try {
        // Signalling状態への遷移を待つ（Botがチャンネル移動された場合）
        await entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
      } catch {
        // タイムアウト → 完全に切断されたのでクリーンアップ
        console.log(`Connection forcefully closed in guild: ${guildId}`)
        destroyPlayer(guildId)
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy()
        }
      }
      return
    }

    // それ以外の切断理由はリカバリを試行
    try {
      console.log(`Connection disconnected in guild: ${guildId}, attempting recovery...`)
      await entersState(connection, VoiceConnectionStatus.Ready, 10_000)
      console.log(`Connection recovered in guild: ${guildId}`)
    } catch {
      // リカバリ失敗 → クリーンアップ
      console.error(`Connection recovery failed in guild: ${guildId}`)
      destroyPlayer(guildId)
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy()
      }
      await notifyError('Voice connection recovery failed', new Error('Could not reconnect to voice channel'), {
        guildId
      })
    }
  })

  // Destroyed状態: プレイヤーをクリーンアップ
  connection.on(VoiceConnectionStatus.Destroyed, () => {
    console.log(`Connection destroyed in guild: ${guildId}`)
    destroyPlayer(guildId)
  })
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
