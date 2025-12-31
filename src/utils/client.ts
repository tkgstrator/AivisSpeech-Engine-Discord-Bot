import { Zodios } from '@zodios/core'
import { z } from 'zod'
import { AudioQuerySchema, SpeakersResponseSchema, UserDictResponseSchema, WordTypesSchema } from '../schemas/aivis.dto'

/**
 * AivisSpeech Engine APIのベースURL
 */
const AIVIS_BASE_URL = process.env.AIVIS_BASE_URL ?? 'http://aivis:10101'

/**
 * AivisSpeech Engine APIクライアント
 */
export const aivisClient = new Zodios(AIVIS_BASE_URL, [
  {
    method: 'get',
    path: '/speakers',
    alias: 'getSpeakers',
    description: '話者情報の一覧を取得する',
    response: SpeakersResponseSchema
  },
  {
    method: 'post',
    path: '/audio_query',
    alias: 'createAudioQuery',
    description: '音声合成用のクエリを作成する',
    parameters: [
      {
        name: 'text',
        type: 'Query',
        schema: z.string()
      },
      {
        name: 'speaker',
        type: 'Query',
        schema: z.number()
      }
    ],
    response: AudioQuerySchema
  },
  {
    method: 'post',
    path: '/synthesis',
    alias: 'synthesis',
    description: '音声合成する',
    parameters: [
      {
        name: 'speaker',
        type: 'Query',
        schema: z.number()
      },
      {
        name: 'body',
        type: 'Body',
        schema: AudioQuerySchema
      }
    ],
    // WAVバイナリを返すため、ArrayBufferとして受け取る
    response: z.instanceof(ArrayBuffer),
    responseType: 'blob'
  },
  {
    method: 'get',
    path: '/user_dict',
    alias: 'getUserDict',
    description: 'ユーザー辞書に登録されている単語の一覧を取得する',
    parameters: [
      {
        name: 'enable_compound_accent',
        type: 'Query',
        schema: z.boolean().optional()
      }
    ],
    response: UserDictResponseSchema
  },
  {
    method: 'post',
    path: '/user_dict_word',
    alias: 'addUserDictWord',
    description: 'ユーザー辞書に単語を追加する',
    parameters: [
      {
        name: 'surface',
        type: 'Query',
        schema: z.array(z.string())
      },
      {
        name: 'pronunciation',
        type: 'Query',
        schema: z.array(z.string())
      },
      {
        name: 'accent_type',
        type: 'Query',
        schema: z.array(z.number().int())
      },
      {
        name: 'word_type',
        type: 'Query',
        schema: WordTypesSchema.optional()
      },
      {
        name: 'priority',
        type: 'Query',
        schema: z.number().int().min(0).max(10).optional()
      }
    ],
    response: z.string()
  },
  {
    method: 'delete',
    path: '/user_dict_word/:word_uuid',
    alias: 'deleteUserDictWord',
    description: 'ユーザー辞書に登録されている単語を削除する',
    response: z.void()
  }
])

export type AivisClient = typeof aivisClient
