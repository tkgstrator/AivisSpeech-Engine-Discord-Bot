import { type ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { addUserDictWord, deleteUserDictWord, getUserDict } from '../utils'

/**
 * /dict コマンドの定義
 */
export const dictCommand = new SlashCommandBuilder()
  .setName('dict')
  .setDescription('ユーザー辞書を管理します')
  .addSubcommand((subcommand) => subcommand.setName('list').setDescription('登録されている単語の一覧を表示します'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('add')
      .setDescription('単語を追加します')
      .addStringOption((option) =>
        option.setName('surface').setDescription('単語の表記（例: Discord）').setRequired(true),
      )
      .addStringOption((option) =>
        option.setName('pronunciation').setDescription('読み方（カタカナ、例: ディスコード）').setRequired(true),
      )
      .addIntegerOption((option) =>
        option
          .setName('accent')
          .setDescription('アクセント位置（0: 平板型、1以上: アクセントが下がる直前の位置）')
          .setRequired(true)
          .setMinValue(0),
      )
      .addIntegerOption((option) =>
        option
          .setName('priority')
          .setDescription('優先度（1〜9、デフォルト: 5）')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(9),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('単語を削除します')
      .addStringOption((option) =>
        option.setName('uuid').setDescription('削除する単語のUUID（listコマンドで確認できます）').setRequired(true),
      ),
  )

/**
 * /dict コマンドのハンドラー
 */
export const handleDictCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
  const subcommand = interaction.options.getSubcommand()

  switch (subcommand) {
    case 'list': {
      await interaction.deferReply()
      try {
        const dict = await getUserDict()
        const entries = Object.entries(dict)

        if (entries.length === 0) {
          await interaction.editReply('登録されている単語はありません')
          return
        }

        const embed = new EmbedBuilder().setTitle('ユーザー辞書').setColor(0x00ae86)

        // 最大25件まで表示
        for (const [uuid, word] of entries.slice(0, 25)) {
          const pronunciation = Array.isArray(word.pronunciation) ? word.pronunciation.join('') : word.pronunciation
          const accentType = Array.isArray(word.accent_type) ? word.accent_type.join(',') : word.accent_type

          embed.addFields({
            name: word.surface,
            value: `読み: ${pronunciation}\nアクセント: ${accentType}\nUUID: \`${uuid}\``,
            inline: true,
          })
        }

        if (entries.length > 25) {
          embed.setFooter({ text: `他 ${entries.length - 25} 件の単語があります` })
        }

        await interaction.editReply({ embeds: [embed] })
      } catch (error) {
        console.error('Failed to get user dict:', error)
        await interaction.editReply('辞書の取得に失敗しました')
      }
      break
    }

    case 'add': {
      const surface = interaction.options.getString('surface', true)
      const pronunciation = interaction.options.getString('pronunciation', true)
      const accentType = interaction.options.getInteger('accent', true)
      const priority = interaction.options.getInteger('priority') ?? 5

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      try {
        const uuid = await addUserDictWord({
          surface,
          pronunciation,
          accentType,
          priority,
        })
        await interaction.editReply(`単語を追加しました\n表記: ${surface}\n読み: ${pronunciation}\nUUID: \`${uuid}\``)
      } catch (error) {
        console.error('Failed to add word:', error)
        await interaction.editReply('単語の追加に失敗しました')
      }
      break
    }

    case 'delete': {
      const uuid = interaction.options.getString('uuid', true)

      await interaction.deferReply({ flags: MessageFlags.Ephemeral })
      try {
        await deleteUserDictWord(uuid)
        await interaction.editReply(`単語を削除しました (UUID: ${uuid})`)
      } catch (error) {
        console.error('Failed to delete word:', error)
        await interaction.editReply('単語の削除に失敗しました')
      }
      break
    }
  }
}
