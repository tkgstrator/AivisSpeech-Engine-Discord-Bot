import type { AutocompleteInteraction, ChatInputCommandInteraction } from 'discord.js'
import { dictCommand, handleDictCommand } from './dict'
import { handleSettingsCommand, settingsCommand } from './settings'
import { handleSpeakerAutocomplete, handleSpeakerCommand, speakerCommand } from './speaker'

/**
 * 全スラッシュコマンドの定義
 */
export const commands = [speakerCommand.toJSON(), settingsCommand.toJSON(), dictCommand.toJSON()]

/**
 * コマンドハンドラーのマップ
 */
const commandHandlers: Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>> = {
  speaker: handleSpeakerCommand,
  settings: handleSettingsCommand,
  dict: handleDictCommand,
}

/**
 * オートコンプリートハンドラーのマップ
 */
const autocompleteHandlers: Record<string, (interaction: AutocompleteInteraction) => Promise<void>> = {
  speaker: handleSpeakerAutocomplete,
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
