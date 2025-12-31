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
import { getSpeakers, getUserSettings, updateUserSettings } from '../utils'

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
  .addSubcommand((subcommand) => subcommand.setName('list').setDescription('利用可能な話者の一覧を表示します'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('話者を設定します')
      .addStringOption((option) =>
        option.setName('name').setDescription('話者名').setRequired(true).setAutocomplete(true)
      )
  )
  .addSubcommand((subcommand) => subcommand.setName('current').setDescription('現在の話者設定を表示します'))

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

  switch (subcommand) {
    case 'list': {
      await interaction.deferReply()
      try {
        const speakers = await updateSpeakerCache()
        // デフォルトキャラクターを除外
        const filteredSpeakers = speakers.filter((s) => !EXCLUDED_SPEAKER_UUIDS.includes(s.speaker_uuid))
        const embed = new EmbedBuilder().setTitle('話者一覧').setColor(0x00ae86)

        for (const speaker of filteredSpeakers.slice(0, 25)) {
          const styles = speaker.styles.map((style) => `${style.name} (ID: ${style.id})`).join('\n')
          embed.addFields({
            name: speaker.name,
            value: styles || 'スタイルなし',
            inline: true
          })
        }

        if (filteredSpeakers.length > 25) {
          embed.setFooter({ text: `他 ${filteredSpeakers.length - 25} 人の話者があります` })
        }

        await interaction.editReply({ embeds: [embed] })
      } catch (error) {
        console.error('Failed to get speakers:', error)
        await interaction.editReply('話者一覧の取得に失敗しました')
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
          await updateUserSettings(interaction.user.id, { speakerId: styleId })
          await interaction.reply({
            content: `話者を **${speaker.name}** (${firstStyle.name}) に設定しました`,
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

          await updateUserSettings(interaction.user.id, { speakerId: selectedStyleId })
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

    case 'current': {
      try {
        const settings = await getUserSettings(interaction.user.id)
        const speakers = await updateSpeakerCache()

        // 現在の話者とスタイル名を検索
        let speakerInfo = `ID: ${settings.speakerId}`
        for (const speaker of speakers) {
          const style = speaker.styles.find((s) => s.id === settings.speakerId)
          if (style) {
            speakerInfo = `**${speaker.name}** (${style.name}) - ID: ${settings.speakerId}`
            break
          }
        }

        await interaction.reply({
          content: `現在の話者: ${speakerInfo}`,
          flags: MessageFlags.Ephemeral
        })
      } catch (error) {
        console.error('Failed to get current speaker:', error)
        await interaction.reply({
          content: '設定の取得に失敗しました',
          flags: MessageFlags.Ephemeral
        })
      }
      break
    }
  }
}
