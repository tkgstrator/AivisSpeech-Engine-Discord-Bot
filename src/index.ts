import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js'
import { commands, executeAutocomplete, executeCommand } from './commands'
import { config } from './config'
import { getUserSettings, preprocessForTts, textToSpeechWithSettings } from './utils'
import { connectToChannel, destroyPlayer, disconnectFromChannel, enqueueAudio, getConnection } from './voice'

/**
 * Discord Botクライアント
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
})

/**
 * スラッシュコマンドをDiscordに登録する
 */
const registerCommands = async (clientId: string): Promise<void> => {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN)
  try {
    console.log('Registering slash commands...')
    await rest.put(Routes.applicationCommands(clientId), { body: commands })
    console.log('Slash commands registered successfully')
  } catch (error) {
    console.error('Failed to register slash commands:', error)
  }
}

/**
 * Bot起動時の処理
 */
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Bot is ready! Logged in as ${readyClient.user.tag}`)
  await registerCommands(readyClient.user.id)
})

/**
 * スラッシュコマンドの処理
 */
client.on(Events.InteractionCreate, async (interaction) => {
  // オートコンプリートの処理
  if (interaction.isAutocomplete()) {
    try {
      await executeAutocomplete(interaction)
    } catch (error) {
      console.error('Autocomplete error:', error)
    }
    return
  }

  if (!interaction.isChatInputCommand()) return

  try {
    await executeCommand(interaction)
  } catch (error) {
    console.error('Command execution error:', error)
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'コマンドの実行中にエラーが発生しました',
        flags: MessageFlags.Ephemeral
      })
    } else {
      await interaction.reply({
        content: 'コマンドの実行中にエラーが発生しました',
        flags: MessageFlags.Ephemeral
      })
    }
  }
})

/**
 * ボイスステート変更時の処理
 * - ユーザーがVCに参加 → Botも参加
 * - VCが空になった → Botは離脱
 */
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guildId = newState.guild.id

  // Botの状態変更は無視
  if (newState.member?.user.bot) {
    return
  }

  // ユーザーがVCに参加した場合
  if (!oldState.channel && newState.channel) {
    const existingConnection = getConnection(guildId)

    // Botがまだ接続していない場合のみ参加
    if (!existingConnection) {
      try {
        await connectToChannel(newState.channel)
      } catch (error) {
        console.error('Failed to connect to voice channel:', error)
      }
    }
    return
  }

  // ユーザーがVCから離脱した場合
  if (oldState.channel && !newState.channel) {
    // 残っているメンバーをチェック（Bot除く）
    const remainingMembers = oldState.channel.members.filter((member) => !member.user.bot)

    // 誰もいなくなったら離脱
    if (remainingMembers.size === 0) {
      destroyPlayer(guildId)
      disconnectFromChannel(guildId)
    }
    return
  }

  // ユーザーが別のVCに移動した場合
  if (oldState.channel && newState.channel && oldState.channelId !== newState.channelId) {
    // 元のチャンネルが空になったかチェック
    const remainingInOld = oldState.channel.members.filter((member) => !member.user.bot)

    if (remainingInOld.size === 0) {
      // 新しいチャンネルに移動
      try {
        await connectToChannel(newState.channel)
      } catch (error) {
        console.error('Failed to move to new voice channel:', error)
        destroyPlayer(guildId)
        disconnectFromChannel(guildId)
      }
    }
  }
})

/**
 * メッセージ受信時のTTS処理
 * - Botがギルドに接続中の場合のみ処理
 * - 送信者がVCにいる場合のみ読み上げ
 */
client.on(Events.MessageCreate, async (message) => {
  // Botのメッセージは無視
  if (message.author.bot) return

  // DMは無視
  if (!message.guild) return

  // 空メッセージは無視
  if (!message.content.trim()) return

  const guildId = message.guild.id
  const connection = getConnection(guildId)

  // Botが接続していない場合は無視
  if (!connection) return

  // 送信者がVCにいるか確認
  const member = message.member
  if (!member?.voice.channel) return

  // BotがいるVCと同じか確認
  const botVoiceChannelId = message.guild.members.me?.voice.channelId
  if (member.voice.channelId !== botVoiceChannelId) return

  // テキストを前処理
  const processedText = preprocessForTts(message.content)
  if (!processedText) return

  try {
    // ユーザー設定を取得
    const settings = await getUserSettings(message.author.id)

    // TTSで音声を生成
    const audioStream = await textToSpeechWithSettings(processedText, settings)

    // キューに追加して再生
    enqueueAudio(guildId, audioStream, connection)
  } catch (error) {
    console.error('Failed to process TTS:', error)
  }
})

// Botを起動
client.login(config.DISCORD_TOKEN)
