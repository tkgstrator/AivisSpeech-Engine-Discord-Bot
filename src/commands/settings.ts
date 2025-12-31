import { type ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { deleteUserSettings, getUserSettings, updateUserSettings } from '../utils'

/**
 * /settings コマンドの定義
 */
export const settingsCommand = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('TTS設定を管理します')
  .addSubcommand((subcommand) => subcommand.setName('show').setDescription('現在の設定を表示します'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('speed')
      .setDescription('話速を設定します（0.5〜2.0）')
      .addNumberOption((option) =>
        option
          .setName('value')
          .setDescription('話速（0.5〜2.0、デフォルト: 1.0）')
          .setRequired(true)
          .setMinValue(0.5)
          .setMaxValue(2.0),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('pitch')
      .setDescription('音高を設定します（-0.15〜0.15）')
      .addNumberOption((option) =>
        option
          .setName('value')
          .setDescription('音高（-0.15〜0.15、デフォルト: 0.0）')
          .setRequired(true)
          .setMinValue(-0.15)
          .setMaxValue(0.15),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('volume')
      .setDescription('音量を設定します（0.0〜2.0）')
      .addNumberOption((option) =>
        option
          .setName('value')
          .setDescription('音量（0.0〜2.0、デフォルト: 1.0）')
          .setRequired(true)
          .setMinValue(0.0)
          .setMaxValue(2.0),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('intonation')
      .setDescription('抑揚を設定します（0.0〜2.0）')
      .addNumberOption((option) =>
        option
          .setName('value')
          .setDescription('抑揚（0.0〜2.0、デフォルト: 1.0）')
          .setRequired(true)
          .setMinValue(0.0)
          .setMaxValue(2.0),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName('reset').setDescription('設定をデフォルトに戻します'))

/**
 * /settings コマンドのハンドラー
 */
export const handleSettingsCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const subcommand = interaction.options.getSubcommand()
  const userId = interaction.user.id

  switch (subcommand) {
    case 'show': {
      try {
        const settings = await getUserSettings(userId)
        const embed = new EmbedBuilder()
          .setTitle('現在のTTS設定')
          .setColor(0x00ae86)
          .addFields(
            { name: '話者ID', value: `${settings.speakerId}`, inline: true },
            { name: '話速', value: `${settings.speedScale}`, inline: true },
            { name: '音高', value: `${settings.pitchScale}`, inline: true },
            { name: '音量', value: `${settings.volumeScale}`, inline: true },
            { name: '抑揚', value: `${settings.intonationScale}`, inline: true },
          )

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      } catch (error) {
        console.error('Failed to get settings:', error)
        await interaction.reply({
          content: '設定の取得に失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }

    case 'speed': {
      const value = interaction.options.getNumber('value', true)
      try {
        await updateUserSettings(userId, { speedScale: value })
        await interaction.reply({
          content: `話速を ${value} に設定しました`,
          flags: MessageFlags.Ephemeral,
        })
      } catch (error) {
        console.error('Failed to set speed:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }

    case 'pitch': {
      const value = interaction.options.getNumber('value', true)
      try {
        await updateUserSettings(userId, { pitchScale: value })
        await interaction.reply({
          content: `音高を ${value} に設定しました`,
          flags: MessageFlags.Ephemeral,
        })
      } catch (error) {
        console.error('Failed to set pitch:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }

    case 'volume': {
      const value = interaction.options.getNumber('value', true)
      try {
        await updateUserSettings(userId, { volumeScale: value })
        await interaction.reply({
          content: `音量を ${value} に設定しました`,
          flags: MessageFlags.Ephemeral,
        })
      } catch (error) {
        console.error('Failed to set volume:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }

    case 'intonation': {
      const value = interaction.options.getNumber('value', true)
      try {
        await updateUserSettings(userId, { intonationScale: value })
        await interaction.reply({
          content: `抑揚を ${value} に設定しました`,
          flags: MessageFlags.Ephemeral,
        })
      } catch (error) {
        console.error('Failed to set intonation:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }

    case 'reset': {
      try {
        await deleteUserSettings(userId)
        await interaction.reply({
          content: '設定をデフォルトに戻しました',
          flags: MessageFlags.Ephemeral,
        })
      } catch (error) {
        console.error('Failed to reset settings:', error)
        await interaction.reply({
          content: 'リセットに失敗しました',
          flags: MessageFlags.Ephemeral,
        })
      }
      break
    }
  }
}
