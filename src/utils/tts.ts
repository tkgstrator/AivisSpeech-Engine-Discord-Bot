import axios from 'axios'
import { config } from '../config'
import type { AudioQuery, Speaker } from '../schemas/aivis.dto'
import type { UserSettings } from '../schemas/userSettings.dto'
import { aivisClient } from './client'

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
 * @param settings ユーザー設定
 * @returns WAV音声データのReadable Stream
 */
export const textToSpeechWithSettings = async (text: string, settings: UserSettings): Promise<Buffer> => {
  console.debug('TTS request:', { text, speakerId: settings.speakerId })

  // AudioQueryを作成
  const audioQuery = await createAudioQuery(text, settings.speakerId)

  // ユーザー設定を適用（デフォルト値と異なる場合のみ）
  if (settings.speedScale !== 1.0) {
    audioQuery.speedScale = settings.speedScale
  }
  if (settings.pitchScale !== 0.0) {
    audioQuery.pitchScale = settings.pitchScale
  }
  if (settings.volumeScale !== 1.0) {
    audioQuery.volumeScale = settings.volumeScale
  }
  if (settings.intonationScale !== 1.0) {
    audioQuery.intonationScale = settings.intonationScale
  }

  // 音声合成
  return await synthesize(audioQuery, settings.speakerId)
}
