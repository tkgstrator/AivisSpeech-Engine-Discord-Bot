import { Readable } from 'node:stream'
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  StreamType,
  type VoiceConnection,
  VoiceConnectionStatus
} from '@discordjs/voice'

/**
 * ギルドごとのAudioPlayerとキューを管理するマップ
 */
const guildPlayers = new Map<
  string,
  {
    player: ReturnType<typeof createAudioPlayer>
    queue: Buffer[]
    isPlaying: boolean
  }
>()

/**
 * ギルドのプレイヤーを取得または作成する
 * @param guildId ギルドID
 * @param connection VoiceConnection
 */
const getOrCreatePlayer = (guildId: string, connection: VoiceConnection) => {
  let guildPlayer = guildPlayers.get(guildId)

  if (!guildPlayer) {
    const player = createAudioPlayer()

    // 全ての状態変化をログ出力
    player.on('stateChange', (oldState, newState) => {
      console.debug(`Player state changed: ${oldState.status} -> ${newState.status}`)
    })

    // 再生完了時に次のキューを処理
    player.on(AudioPlayerStatus.Idle, () => {
      console.debug('Player became idle')
      const gp = guildPlayers.get(guildId)
      if (gp && gp.queue.length > 0) {
        const nextBuffer = gp.queue.shift()
        if (nextBuffer) {
          void playBuffer(guildId, nextBuffer, connection)
        }
      } else if (gp) {
        gp.isPlaying = false
      }
    })

    player.on('error', (error) => {
      console.error(`Audio player error in guild ${guildId}:`, error)
      const gp = guildPlayers.get(guildId)
      if (gp) {
        gp.isPlaying = false
        // エラー時は次のキューを試行
        if (gp.queue.length > 0) {
          const nextBuffer = gp.queue.shift()
          if (nextBuffer) {
            void playBuffer(guildId, nextBuffer, connection)
          }
        }
      }
    })

    connection.subscribe(player)

    guildPlayer = {
      player,
      queue: [],
      isPlaying: false
    }
    guildPlayers.set(guildId, guildPlayer)
  }

  return guildPlayer
}

/**
 * Bufferを再生する（内部用）
 */
const playBuffer = async (guildId: string, buffer: Buffer, connection: VoiceConnection): Promise<void> => {
  console.debug('Playing buffer for guild:', guildId, 'size:', buffer.length)

  // VoiceConnectionがReadyになるまで待機
  if (connection.state.status !== VoiceConnectionStatus.Ready) {
    console.debug('Waiting for connection to be ready...')
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000)
    } catch {
      console.error('Connection failed to become ready')
      return
    }
  }

  const guildPlayer = getOrCreatePlayer(guildId, connection)
  const stream = Readable.from(buffer)
  const resource = createAudioResource(stream, {
    inputType: StreamType.Arbitrary,
    inlineVolume: false
  })
  guildPlayer.player.play(resource)
  guildPlayer.isPlaying = true
}

/**
 * 音声をキューに追加して再生する
 * @param guildId ギルドID
 * @param buffer 音声バッファ
 * @param connection VoiceConnection
 */
export const enqueueAudio = async (guildId: string, buffer: Buffer, connection: VoiceConnection): Promise<void> => {
  const guildPlayer = getOrCreatePlayer(guildId, connection)

  if (guildPlayer.isPlaying) {
    // 再生中ならキューに追加
    guildPlayer.queue.push(buffer)
  } else {
    // 再生中でなければ即座に再生
    await playBuffer(guildId, buffer, connection)
  }
}

/**
 * ギルドの再生キューをクリアする
 * @param guildId ギルドID
 */
export const clearQueue = (guildId: string): void => {
  const guildPlayer = guildPlayers.get(guildId)
  if (guildPlayer) {
    guildPlayer.queue = []
    guildPlayer.player.stop()
    guildPlayer.isPlaying = false
  }
}

/**
 * ギルドのプレイヤーを破棄する
 * @param guildId ギルドID
 */
export const destroyPlayer = (guildId: string): void => {
  const guildPlayer = guildPlayers.get(guildId)
  if (guildPlayer) {
    guildPlayer.player.stop()
    guildPlayers.delete(guildId)
  }
}
