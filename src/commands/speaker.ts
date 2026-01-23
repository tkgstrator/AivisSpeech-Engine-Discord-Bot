import {
  ActionRowBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction
} from 'discord.js'
import type { Speaker } from '../schemas/aivis.dto'
import {
  deleteUserSettings,
  getCurrentSpeakerConfig,
  getCurrentSpeakerId,
  getSpeakers,
  setCurrentSpeakerId,
  updateCurrentSpeakerConfig
} from '../utils'

/**
 * 話者キャッシュ
 */
let speakerListCache: Speaker[] = []
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 1分

/**
 * 話者キャッシュを更新する
 */
const updateSpeakerCache = async (): Promise<Speaker[]> => {
  const now = Date.now()
  if (now - cacheTimestamp < CACHE_TTL && speakerListCache.length > 0) {
    return speakerListCache
  }

  try {
    speakerListCache = await getSpeakers()
    cacheTimestamp = now
  } catch (error) {
    console.error('Failed to update speaker cache:', error)
  }

  return speakerListCache
}

/**
 * /speaker コマンドの定義
 */
export const speakerCommand = new SlashCommandBuilder()
  .setName('speaker')
  .setDescription('話者を設定します')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('話者を設定します')
      .addStringOption((option) =>
        option.setName('name').setDescription('話者名').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName('clear').setDescription('話者設定をリセットします'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('config')
      .setDescription('話者ごとの詳細設定')
      .addStringOption((option) =>
        option
          .setName('setting')
          .setDescription('設定項目')
          .setRequired(true)
          .addChoices(
            { name: 'show - 現在の設定を表示', value: 'show' },
            { name: 'speed - 話速（0.5〜2.0）', value: 'speed' },
            { name: 'pitch - 音高（-0.15〜0.15）', value: 'pitch' },
            { name: 'volume - 音量（0.0〜2.0）', value: 'volume' },
            { name: 'intonation - 抑揚（0.0〜2.0）', value: 'intonation' },
            { name: 'reset - 設定をデフォルトに戻す', value: 'reset' }
          )
      )
      .addNumberOption((option) =>
        option.setName('value').setDescription('設定する値（speed/pitch/volume/intonationの場合）').setRequired(false)
      )
  )

/**
 * 除外するspeaker_uuid
 */
const EXCLUDED_SPEAKER_UUIDS = [
  'e756b8e4-b606-4e15-99b1-3f9c6a1b2317', // まお
  '5680ac39-43c9-487a-bc3e-018c0d29cc38' // コハク
]

/**
 * /speaker set のオートコンプリートハンドラー（話者名のみ）
 */
export const handleSpeakerAutocomplete = async (interaction: AutocompleteInteraction): Promise<void> => {
  const speakers = await updateSpeakerCache()
  const focusedValue = interaction.options.getFocused().toLowerCase()

  // 除外キャラクターを除き、話者名でフィルタリング（重複を除去）
  const uniqueSpeakers = speakers
    .filter((s) => !EXCLUDED_SPEAKER_UUIDS.includes(s.speaker_uuid))
    .filter((s) => s.name.toLowerCase().includes(focusedValue))
    .slice(0, 25)

  await interaction.respond(
    uniqueSpeakers.map((s) => ({
      name: s.name,
      value: s.speaker_uuid
    }))
  )
}

/**
 * スタイル選択メニューを作成する
 */
const createStyleSelectMenu = (speaker: Speaker, customId: string): ActionRowBuilder<StringSelectMenuBuilder> => {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('スタイルを選択してください')
    .addOptions(
      speaker.styles.map((style) => ({
        label: style.name,
        description: `ID: ${style.id}`,
        value: style.id.toString()
      }))
    )

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)
}

/**
 * /speaker コマンドのハンドラー
 */
export const handleSpeakerCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const subcommand = interaction.options.getSubcommand()

  // speaker config サブコマンドの処理
  if (subcommand === 'config') {
    const userId = interaction.user.id
    const setting = interaction.options.getString('setting', true)
    const value = interaction.options.getNumber('value')

    switch (setting) {
      case 'show': {
        try {
          const speakerId = await getCurrentSpeakerId(userId)
          const config = await getCurrentSpeakerConfig(userId)
          const embed = new EmbedBuilder()
            .setTitle('現在のTTS設定')
            .setColor(0x00ae86)
            .addFields(
              { name: '話者ID', value: `${speakerId}`, inline: true },
              { name: '話速', value: `${config.speed}`, inline: true },
              { name: '音高', value: `${config.pitch}`, inline: true },
              { name: '音量', value: `${config.volume}`, inline: true },
              { name: '抑揚', value: `${config.intonation}`, inline: true }
            )

          await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
        } catch (error) {
          console.error('Failed to get settings:', error)
          await interaction.reply({
            content: '設定の取得に失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }

      case 'speed': {
        if (value === null) {
          await interaction.reply({
            content: '話速を設定するには value オプションが必要です（0.5〜2.0）',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        if (value < 0.5 || value > 2.0) {
          await interaction.reply({
            content: '話速は 0.5〜2.0 の範囲で指定してください',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        try {
          await updateCurrentSpeakerConfig(userId, { speed: value })
          await interaction.reply({
            content: `話速を ${value} に設定しました`,
            flags: MessageFlags.Ephemeral
          })
        } catch (error) {
          console.error('Failed to set speed:', error)
          await interaction.reply({
            content: '設定に失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }

      case 'pitch': {
        if (value === null) {
          await interaction.reply({
            content: '音高を設定するには value オプションが必要です（-0.15〜0.15）',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        if (value < -0.15 || value > 0.15) {
          await interaction.reply({
            content: '音高は -0.15〜0.15 の範囲で指定してください',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        try {
          await updateCurrentSpeakerConfig(userId, { pitch: value })
          await interaction.reply({
            content: `音高を ${value} に設定しました`,
            flags: MessageFlags.Ephemeral
          })
        } catch (error) {
          console.error('Failed to set pitch:', error)
          await interaction.reply({
            content: '設定に失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }

      case 'volume': {
        if (value === null) {
          await interaction.reply({
            content: '音量を設定するには value オプションが必要です（0.0〜2.0）',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        if (value < 0.0 || value > 2.0) {
          await interaction.reply({
            content: '音量は 0.0〜2.0 の範囲で指定してください',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        try {
          await updateCurrentSpeakerConfig(userId, { volume: value })
          await interaction.reply({
            content: `音量を ${value} に設定しました`,
            flags: MessageFlags.Ephemeral
          })
        } catch (error) {
          console.error('Failed to set volume:', error)
          await interaction.reply({
            content: '設定に失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }

      case 'intonation': {
        if (value === null) {
          await interaction.reply({
            content: '抑揚を設定するには value オプションが必要です（0.0〜2.0）',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        if (value < 0.0 || value > 2.0) {
          await interaction.reply({
            content: '抑揚は 0.0〜2.0 の範囲で指定してください',
            flags: MessageFlags.Ephemeral
          })
          return
        }
        try {
          await updateCurrentSpeakerConfig(userId, { intonation: value })
          await interaction.reply({
            content: `抑揚を ${value} に設定しました`,
            flags: MessageFlags.Ephemeral
          })
        } catch (error) {
          console.error('Failed to set intonation:', error)
          await interaction.reply({
            content: '設定に失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }

      case 'reset': {
        try {
          await deleteUserSettings(userId)
          await interaction.reply({
            content: '設定をデフォルトに戻しました',
            flags: MessageFlags.Ephemeral
          })
        } catch (error) {
          console.error('Failed to reset settings:', error)
          await interaction.reply({
            content: 'リセットに失敗しました',
            flags: MessageFlags.Ephemeral
          })
        }
        break
      }
    }
    return
  }

  // 通常のサブコマンド処理
  switch (subcommand) {
    case 'clear': {
      try {
        await deleteUserSettings(interaction.user.id)
        await interaction.reply({
          content: '話者設定をリセットしました',
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to clear speaker settings:', error)
        await interaction.reply({
          content: '設定のリセットに失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }

    case 'set': {
      const speakerUuid = interaction.options.getString('name', true)

      try {
        const speakers = await updateSpeakerCache()
        const speaker = speakers.find((s) => s.speaker_uuid === speakerUuid)

        if (!speaker) {
          await interaction.reply({
            content: '指定された話者が見つかりませんでした',
            flags: MessageFlags.Ephemeral
          })
          return
        }

        // スタイルが1つしかない場合は直接設定
        const firstStyle = speaker.styles[0]
        if (speaker.styles.length === 1 && firstStyle) {
          const styleId = firstStyle.id
          await setCurrentSpeakerId(interaction.user.id, styleId)
          await interaction.reply({
            content: `話者を **${speaker.name}** に設定しました`,
            flags: MessageFlags.Ephemeral
          })
          return
        }

        // 複数スタイルがある場合はセレクトメニューを表示
        const customId = `speaker_style_${interaction.user.id}_${Date.now()}`
        const row = createStyleSelectMenu(speaker, customId)

        const response = await interaction.reply({
          content: `**${speaker.name}** のスタイルを選択してください:`,
          components: [row],
          flags: MessageFlags.Ephemeral
        })

        // セレクトメニューの応答を待機
        try {
          const selectInteraction = (await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.customId === customId && i.user.id === interaction.user.id,
            time: 60_000 // 60秒でタイムアウト
          })) as StringSelectMenuInteraction

          const selectedValue = selectInteraction.values[0]
          if (!selectedValue) return
          const selectedStyleId = Number.parseInt(selectedValue, 10)
          const selectedStyle = speaker.styles.find((s) => s.id === selectedStyleId)

          await setCurrentSpeakerId(interaction.user.id, selectedStyleId)
          await selectInteraction.update({
            content: `話者を **${speaker.name}** (${selectedStyle?.name}) に設定しました`,
            components: []
          })
        } catch {
          // タイムアウト時はメニューを削除
          await interaction.editReply({
            content: '選択がタイムアウトしました。もう一度お試しください。',
            components: []
          })
        }
      } catch (error) {
        console.error('Failed to set speaker:', error)
        await interaction.reply({
          content: '話者の設定に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }
  }
}
