import axios from 'axios'
import { z } from 'zod'
import { config } from '../config'
import type { AudioQuery, Speaker } from '../schemas/aivis.dto'
import type { SpeakerConfig } from '../schemas/userSettings.dto'
import { aivisClient } from './client'
import { notifyError } from './notifier'

/**
 * 話者一覧を取得する
 * @returns 話者一覧
 */
export const getSpeakers = async (): Promise<Speaker[]> => {
  return await aivisClient.getSpeakers()
}

/**
 * テキストから音声合成用クエリを作成する
 * @param text 合成するテキスト
 * @param speakerId 話者ID（スタイルID）
 * @returns AudioQuery
 */
export const createAudioQuery = async (text: string, speakerId: number): Promise<AudioQuery> => {
  return await aivisClient.createAudioQuery(undefined, { queries: { text, speaker: speakerId } })
}

/**
 * AudioQueryから音声を合成する
 * @param audioQuery 音声合成クエリ
 * @param speakerId 話者ID（スタイルID）
 * @returns WAV音声データ
 */
export const synthesize = async (audioQuery: AudioQuery, speakerId: number): Promise<Buffer> => {
  // Zodiosではarraybufferが正しく処理されないため、直接axiosを使用
  const response = await axios.post<ArrayBuffer>(`${config.AIVIS_BASE_URL}/synthesis`, audioQuery, {
    params: { speaker: speakerId },
    responseType: 'arraybuffer'
  })
  return Buffer.from(response.data)
}

/**
 * テキストから直接音声を合成する（audio_query + synthesis を一括実行）
 * @param text 合成するテキスト
 * @param speakerId 話者ID（スタイルID）
 * @returns WAV音声データのReadable Stream
 */
export const textToSpeech = async (text: string, speakerId: number): Promise<Buffer> => {
  const audioQuery = await createAudioQuery(text, speakerId)
  return await synthesize(audioQuery, speakerId)
}

/**
 * ユーザー設定を適用してテキストを音声合成する
 * @param text 合成するテキスト
 * @param speakerId 話者ID
 * @param config 話者設定
 * @returns WAV音声データのReadable Stream
 */
export const textToSpeechWithSettings = async (
  text: string,
  speakerId: number,
  config: SpeakerConfig
): Promise<Buffer> => {
  console.debug('TTS request:', { text, speakerId })

  // AudioQueryを作成
  const audioQuery = await createAudioQuery(text, speakerId)

  // ユーザー設定を適用（デフォルト値と異なる場合のみ）
  if (config.speed !== 1.0) {
    audioQuery.speedScale = config.speed
  }
  if (config.pitch !== 0.0) {
    audioQuery.pitchScale = config.pitch
  }
  if (config.volume !== 1.0) {
    audioQuery.volumeScale = config.volume
  }
  if (config.intonation !== 1.0) {
    audioQuery.intonationScale = config.intonation
  }

  // 音声合成
  return await synthesize(audioQuery, speakerId)
}

/**
 * AIVMモデル情報のスキーマ
 */
const AivmModelSchema = z.object({
  is_loaded: z.boolean(),
  is_default_model: z.boolean().optional(),
  manifest: z.object({
    name: z.string(),
    uuid: z.string()
  })
})

/**
 * インストール済みのモデルを事前にロードする
 * デフォルトモデルはアンロードし、ユーザーがインストールしたモデルのみロードする
 * Bot起動時に呼び出すことで、初回の音声合成レイテンシを削減する
 */
export const preloadModels = async (): Promise<void> => {
  console.log('Preloading AivisSpeech models...')
  try {
    const res = await axios.get<Record<string, unknown>>(`${config.AIVIS_BASE_URL}/aivm_models`)
    const models = res.data

    for (const [uuid, raw] of Object.entries(models)) {
      const parsed = AivmModelSchema.safeParse(raw)
      if (!parsed.success) {
        console.warn(`Skipping invalid model entry: ${uuid}`)
        continue
      }
      const model = parsed.data

      // デフォルトモデルはアンロード
      if (model.is_default_model) {
        if (model.is_loaded) {
          console.log(`  Unloading default model: ${model.manifest.name} ...`)
          await axios.post(`${config.AIVIS_BASE_URL}/aivm_models/${uuid}/unload`)
          console.log(`  Unloaded: ${model.manifest.name}`)
        } else {
          console.log(`  Skipping default model: ${model.manifest.name}`)
        }
        continue
      }

      if (model.is_loaded) {
        console.log(`  Already loaded: ${model.manifest.name}`)
        continue
      }
      console.log(`  Loading: ${model.manifest.name} ...`)
      await axios.post(`${config.AIVIS_BASE_URL}/aivm_models/${uuid}/load`)
      console.log(`  Loaded: ${model.manifest.name}`)
    }

    console.log('All models preloaded successfully')
  } catch (error) {
    await notifyError('Failed to preload models', error)
  }
}
