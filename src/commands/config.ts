import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js'
import { deleteGuildSettings, getGuildSettings, updateGuildSettings } from '../utils'

/**
 * /config コマンドの定義（サーバー設定専用）
 */
export const configCommand = new SlashCommandBuilder()
  .setName('config')
  .setDescription('サーバー全体の設定を管理します')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand.setName('show').setDescription('現在のサーバー設定を表示します'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('read-non-vc')
      .setDescription('VCに参加していない人のチャット読み上げを設定します')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('読み上げる場合はtrue、読み上げない場合はfalse').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('announce-join')
      .setDescription('VC参加時のアナウンスを設定します')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('アナウンスする場合はtrue、しない場合はfalse').setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('announce-leave')
      .setDescription('VC退出時のアナウンスを設定します')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('アナウンスする場合はtrue、しない場合はfalse').setRequired(true)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName('reset').setDescription('サーバー設定をデフォルトに戻します'))

/**
 * /config コマンドのハンドラー（サーバー設定専用）
 */
export const handleConfigCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  // 管理権限チェック
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: 'サーバー設定を変更するには「サーバー管理」権限が必要です',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  const subcommand = interaction.options.getSubcommand()
  const guildId = interaction.guildId

  switch (subcommand) {
    case 'show': {
      try {
        const settings = await getGuildSettings(guildId)
        const embed = new EmbedBuilder()
          .setTitle('現在のサーバー設定')
          .setColor(0x00ae86)
          .addFields(
            { name: 'VC外ユーザー読み上げ', value: settings.readNonVcUsers ? '有効' : '無効', inline: true },
            { name: 'VC参加アナウンス', value: settings.announceJoin ? '有効' : '無効', inline: true },
            { name: 'VC退出アナウンス', value: settings.announceLeave ? '有効' : '無効', inline: true }
          )

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
      } catch (error) {
        console.error('Failed to get guild settings:', error)
        await interaction.reply({
          content: '設定の取得に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }

    case 'read-non-vc': {
      const enabled = interaction.options.getBoolean('enabled', true)
      try {
        await updateGuildSettings(guildId, { readNonVcUsers: enabled })
        await interaction.reply({
          content: `VCに参加していない人のチャット読み上げを${enabled ? '有効' : '無効'}にしました`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to set read-non-vc:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }

    case 'announce-join': {
      const enabled = interaction.options.getBoolean('enabled', true)
      try {
        await updateGuildSettings(guildId, { announceJoin: enabled })
        await interaction.reply({
          content: `VC参加時のアナウンスを${enabled ? '有効' : '無効'}にしました`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to set announce-join:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }

    case 'announce-leave': {
      const enabled = interaction.options.getBoolean('enabled', true)
      try {
        await updateGuildSettings(guildId, { announceLeave: enabled })
        await interaction.reply({
          content: `VC退出時のアナウンスを${enabled ? '有効' : '無効'}にしました`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to set announce-leave:', error)
        await interaction.reply({
          content: '設定に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }

    case 'reset': {
      try {
        await deleteGuildSettings(guildId)
        await interaction.reply({
          content: 'サーバー設定をデフォルトに戻しました',
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to reset guild settings:', error)
        await interaction.reply({
          content: 'リセットに失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }
  }
}
