import {
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js'
import type { GuildSettings } from '../schemas/guildSettings.dto'
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
      .setName('set')
      .setDescription('サーバー設定を変更します')
      .addBooleanOption((option) =>
        option.setName('read-non-vc').setDescription('VCに参加していない人のチャット読み上げ').setRequired(false)
      )
      .addBooleanOption((option) =>
        option.setName('announce-join').setDescription('VC参加時のアナウンス').setRequired(false)
      )
      .addBooleanOption((option) =>
        option.setName('announce-leave').setDescription('VC退出時のアナウンス').setRequired(false)
      )
      .addChannelOption((option) => option.setName('channel1').setDescription('読み上げチャンネル1').setRequired(false))
      .addChannelOption((option) => option.setName('channel2').setDescription('読み上げチャンネル2').setRequired(false))
      .addChannelOption((option) => option.setName('channel3').setDescription('読み上げチャンネル3').setRequired(false))
      .addChannelOption((option) => option.setName('channel4').setDescription('読み上げチャンネル4').setRequired(false))
      .addChannelOption((option) => option.setName('channel5').setDescription('読み上げチャンネル5').setRequired(false))
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

        // 読み上げチャンネルの表示
        const channelNames =
          settings.readChannels.length > 0 ? settings.readChannels.map((id) => `<#${id}>`).join(', ') : '全チャンネル'

        const embed = new EmbedBuilder()
          .setTitle('現在のサーバー設定')
          .setColor(0x00ae86)
          .addFields(
            { name: 'VC外ユーザー読み上げ', value: settings.readNonVcUsers ? '有効' : '無効', inline: true },
            { name: 'VC参加アナウンス', value: settings.announceJoin ? '有効' : '無効', inline: true },
            { name: 'VC退出アナウンス', value: settings.announceLeave ? '有効' : '無効', inline: true },
            { name: '読み上げチャンネル', value: channelNames, inline: false }
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

    case 'set': {
      try {
        const updates: Partial<GuildSettings> = {}
        const messages: string[] = []

        // ブール値の設定
        const readNonVc = interaction.options.getBoolean('read-non-vc')
        if (readNonVc !== null) {
          updates.readNonVcUsers = readNonVc
          messages.push(`VC外ユーザー読み上げ: ${readNonVc ? '有効' : '無効'}`)
        }

        const announceJoin = interaction.options.getBoolean('announce-join')
        if (announceJoin !== null) {
          updates.announceJoin = announceJoin
          messages.push(`VC参加アナウンス: ${announceJoin ? '有効' : '無効'}`)
        }

        const announceLeave = interaction.options.getBoolean('announce-leave')
        if (announceLeave !== null) {
          updates.announceLeave = announceLeave
          messages.push(`VC退出アナウンス: ${announceLeave ? '有効' : '無効'}`)
        }

        // チャンネル設定
        const channels = [
          interaction.options.getChannel('channel1'),
          interaction.options.getChannel('channel2'),
          interaction.options.getChannel('channel3'),
          interaction.options.getChannel('channel4'),
          interaction.options.getChannel('channel5')
        ].filter((ch): ch is NonNullable<typeof ch> => ch !== null)

        if (channels.length > 0 || interaction.options.get('channel1') !== null) {
          const channelIds = channels.map((ch) => ch.id)
          updates.readChannels = channelIds
          if (channelIds.length === 0) {
            messages.push('読み上げチャンネル: 全チャンネル')
          } else {
            const channelMentions = channels.map((ch) => `<#${ch.id}>`).join(', ')
            messages.push(`読み上げチャンネル: ${channelMentions}`)
          }
        }

        if (Object.keys(updates).length === 0) {
          await interaction.reply({
            content: '変更する設定を指定してください',
            flags: MessageFlags.Ephemeral
          })
          return
        }

        await updateGuildSettings(guildId, updates)
        await interaction.reply({
          content: `以下の設定を変更しました:\n${messages.join('\n')}`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to update settings:', error)
        await interaction.reply({
          content: '設定の更新に失敗しました',
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
