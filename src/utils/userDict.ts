import type { UserDictWord, WordTypes } from '../schemas/aivis.dto'
import { aivisClient } from './client'

/**
 * ユーザー辞書の単語一覧を取得する
 * @returns 単語一覧（UUIDをキーとしたオブジェクト）
 */
export const getUserDict = async (): Promise<Record<string, UserDictWord>> => {
  return await aivisClient.getUserDict({ queries: { enable_compound_accent: true } })
}

/**
 * 単語追加のパラメータ
 */
export type AddWordParams = {
  /** 単語の表層形 */
  surface: string
  /** 単語の発音（カタカナ） */
  pronunciation: string
  /** アクセント型（0: 平板型、1以上: アクセント位置） */
  accentType: number
  /** 品詞（デフォルト: 固有名詞） */
  wordType?: WordTypes
  /** 優先度（1〜9推奨、デフォルト: 5） */
  priority?: number
}

/**
 * ユーザー辞書に単語を追加する
 * @param params 単語情報
 * @returns 追加した単語のUUID
 */
export const addUserDictWord = async (params: AddWordParams): Promise<string> => {
  const { surface, pronunciation, accentType, wordType, priority } = params
  return await aivisClient.addUserDictWord(undefined, {
    queries: {
      surface: [surface],
      pronunciation: [pronunciation],
      accent_type: [accentType],
      word_type: wordType,
      priority,
    },
  })
}

/**
 * ユーザー辞書から単語を削除する
 * @param wordUuid 削除する単語のUUID
 */
export const deleteUserDictWord = async (wordUuid: string): Promise<void> => {
  await aivisClient.deleteUserDictWord(undefined, { params: { word_uuid: wordUuid } })
}
