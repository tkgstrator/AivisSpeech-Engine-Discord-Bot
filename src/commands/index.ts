import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'
import { configCommand, handleConfigCommand } from './config'
import { dictionaryCommand, handleDictionaryCommand } from './dict'
import { handleSpeakerAutocomplete, handleSpeakerCommand, speakerCommand } from './speaker'

/**
 * 全スラッシュコマンドの定義
 */
export const commands = [speakerCommand.toJSON(), configCommand.toJSON(), dictionaryCommand.toJSON()]

/**
 * コマンドハンドラーのマップ
 */
const commandHandlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  speaker: handleSpeakerCommand,
  config: handleConfigCommand,
  dictionary: handleDictionaryCommand,
}

/**
 * オートコンプリートハンドラーのマップ
 */
const autocompleteHandlers: Record<string, (interaction: AutocompleteInteraction) => Promise<void>> = {
  speaker: handleSpeakerAutocomplete
}

/**
 * コマンドを実行する
 * @param interaction コマンドインタラクション
 */
export const executeCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const handler = commandHandlers[interaction.commandName]
  if (handler) {
    await handler(interaction)
  }
}

/**
 * オートコンプリートを実行する
 * @param interaction オートコンプリートインタラクション
 */
export const executeAutocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
  const handler = autocompleteHandlers[interaction.commandName]
  if (handler) {
    await handler(interaction)
  }
}
