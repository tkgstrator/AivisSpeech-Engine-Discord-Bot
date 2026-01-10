import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { connectToChannel, destroyPlayer, disconnectFromChannel, getConnection } from '../voice'

/**
 * /join コマンドの定義
 */
export const joinCommand = new SlashCommandBuilder().setName('join').setDescription('ボイスチャンネルに参加します')

/**
 * /join コマンドのハンドラー
 */
export const handleJoinCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const member = interaction.member
  if (!member || !('voice' in member)) {
    await interaction.reply({
      content: 'ボイスチャンネルに参加してから実行してください',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  const voiceChannel = member.voice.channel
  if (!voiceChannel) {
    await interaction.reply({
      content: 'ボイスチャンネルに参加してから実行してください',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.reply({
      content: 'サーバー内で実行してください',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  // 既に接続している場合
  const existingConnection = getConnection(guildId)
  if (existingConnection) {
    await interaction.reply({
      content: '既にボイスチャンネルに接続しています',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  try {
    await connectToChannel(voiceChannel)
    await interaction.reply({
      content: `${voiceChannel.name} に参加しました`,
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    console.error('Failed to join voice channel:', error)
    await interaction.reply({
      content: 'ボイスチャンネルへの参加に失敗しました',
      flags: MessageFlags.Ephemeral
    })
  }
}

/**
 * /leave コマンドの定義
 */
export const leaveCommand = new SlashCommandBuilder().setName('leave').setDescription('ボイスチャンネルから離脱します')

/**
 * /leave コマンドのハンドラー
 */
export const handleLeaveCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const guildId = interaction.guildId
  if (!guildId) {
    await interaction.reply({
      content: 'サーバー内で実行してください',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  const connection = getConnection(guildId)
  if (!connection) {
    await interaction.reply({
      content: 'ボイスチャンネルに接続していません',
      flags: MessageFlags.Ephemeral
    })
    return
  }

  try {
    destroyPlayer(guildId)
    disconnectFromChannel(guildId)
    await interaction.reply({
      content: 'ボイスチャンネルから離脱しました',
      flags: MessageFlags.Ephemeral
    })
  } catch (error) {
    console.error('Failed to leave voice channel:', error)
    await interaction.reply({
      content: 'ボイスチャンネルからの離脱に失敗しました',
      flags: MessageFlags.Ephemeral
    })
  }
}
