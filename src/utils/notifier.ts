import dayjs from 'dayjs'
import { config } from '../config'

/**
 * Discordにエラー通知を送信する
 * ERROR_WEBHOOK_URLが未設定の場合はコンソールログのみ出力する
 * @param title エラーの概要
 * @param error エラーオブジェクトまたはメッセージ
 * @param context 追加のコンテキスト情報
 */
export const notifyError = async (title: string, error: unknown, context?: Record<string, string>): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? error.stack : undefined

  console.error(`[${title}]`, message, stack ?? '')

  if (!config.ERROR_WEBHOOK_URL) return

  const fields = [{ name: 'Error', value: `\`\`\`\n${message.slice(0, 1000)}\n\`\`\``, inline: false }]

  if (stack) {
    fields.push({
      name: 'Stack Trace',
      value: `\`\`\`\n${stack.slice(0, 1000)}\n\`\`\``,
      inline: false
    })
  }

  if (context) {
    for (const [key, value] of Object.entries(context)) {
      fields.push({ name: key, value, inline: true })
    }
  }

  const payload = {
    embeds: [
      {
        title: `[Error] ${title}`,
        color: 0xff0000,
        fields,
        timestamp: dayjs().toISOString()
      }
    ]
  }

  try {
    await fetch(config.ERROR_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (webhookError) {
    // Webhook送信自体が失敗してもクラッシュさせない
    console.error('Failed to send error notification:', webhookError)
  }
}
