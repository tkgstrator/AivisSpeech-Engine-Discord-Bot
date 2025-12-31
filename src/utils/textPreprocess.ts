/**
 * TTS用テキスト前処理
 * URL、メンション、カスタム絵文字などを除去・変換する
 */

/** 最大読み上げ文字数 */
const MAX_TEXT_LENGTH = 200

/**
 * URLを除去する
 */
const removeUrls = (text: string): string => {
  return text.replace(/https?:\/\/[^\s]+/g, 'URL省略')
}

/**
 * メンションを除去する
 */
const removeMentions = (text: string): string => {
  // ユーザーメンション
  let result = text.replace(/<@!?\d+>/g, '')
  // ロールメンション
  result = result.replace(/<@&\d+>/g, '')
  // チャンネルメンション
  result = result.replace(/<#\d+>/g, '')
  return result
}

/**
 * カスタム絵文字を絵文字名に変換する
 */
const convertCustomEmoji = (text: string): string => {
  // <:emoji_name:123456789> または <a:emoji_name:123456789> 形式
  return text.replace(/<a?:(\w+):\d+>/g, '$1')
}

/**
 * コードブロックを除去する
 */
const removeCodeBlocks = (text: string): string => {
  // マルチラインコードブロック
  let result = text.replace(/```[\s\S]*?```/g, 'コード省略')
  // インラインコード
  result = result.replace(/`[^`]+`/g, '')
  return result
}

/**
 * スポイラーを除去する
 */
const removeSpoilers = (text: string): string => {
  return text.replace(/\|\|[\s\S]*?\|\|/g, 'ネタバレ')
}

/**
 * 連続する空白を整理する
 */
const normalizeWhitespace = (text: string): string => {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * テキストを最大長で切り詰める
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength)}、以下省略`
}

/**
 * TTS用にテキストを前処理する
 * @param text 元のテキスト
 * @returns 前処理後のテキスト（空文字の場合はnull）
 */
export const preprocessForTts = (text: string): string | null => {
  let processed = text

  // 各種除去・変換処理
  processed = removeCodeBlocks(processed)
  processed = removeSpoilers(processed)
  processed = removeUrls(processed)
  processed = removeMentions(processed)
  processed = convertCustomEmoji(processed)
  processed = normalizeWhitespace(processed)

  // 空になった場合はnullを返す
  if (!processed) {
    return null
  }

  // 長すぎる場合は切り詰める
  processed = truncateText(processed, MAX_TEXT_LENGTH)

  return processed
}
