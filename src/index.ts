import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js'
import { commands, executeAutocomplete, executeCommand } from './commands'
import { config } from './config'
import {
  getCurrentSpeakerConfig,
  getCurrentSpeakerId,
  getGuildSettings,
  preloadModels,
  preprocessForTts,
  textToSpeechWithSettings
} from './utils'
import { notifyError } from './utils/notifier'
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
  await preloadModels()
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
    await notifyError('Command execution error', error, {
      command: interaction.commandName,
      guildId: interaction.guildId ?? 'unknown'
    })
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
 * - Bot自身がVCから切断された場合 → プレイヤーをクリーンアップ
 * - ユーザーがVCに参加 → Botも参加 + アナウンス
 * - VCが空になった → Botは離脱
 * - ユーザーがVCから離脱 → アナウンス
 */
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const guildId = newState.guild.id

  // Bot自身のVCからの切断を検知 → プレイヤーをクリーンアップ
  if (newState.member?.id === newState.client.user?.id) {
    if (oldState.channel && !newState.channel) {
      console.log(`Bot was disconnected from VC in guild: ${guildId}`)
      destroyPlayer(guildId)
    }
    return
  }

  // Botの状態変更は無視
  if (newState.member?.user.bot) {
    return
  }

  // ギルド設定を取得
  const guildSettings = await getGuildSettings(guildId)

  // ユーザーがVCに参加した場合
  if (!oldState.channel && newState.channel) {
    const existingConnection = getConnection(guildId)

    // Botがまだ接続していない場合のみ参加
    if (!existingConnection) {
      try {
        await connectToChannel(newState.channel)
      } catch (error) {
        await notifyError('Failed to connect to voice channel', error, { guildId })
      }
    }

    // 参加アナウンス
    const connection = existingConnection || getConnection(guildId)
    if (connection && guildSettings.announceJoin && newState.member) {
      try {
        const speakerId = await getCurrentSpeakerId(newState.member.user.id)
        const speakerConfig = await getCurrentSpeakerConfig(newState.member.user.id)
        const username = newState.member.displayName || newState.member.user.username
        const announceText = `${username}が参加しました`
        const audioStream = await textToSpeechWithSettings(announceText, speakerId, speakerConfig)
        enqueueAudio(guildId, audioStream, connection)
      } catch (error) {
        await notifyError('Failed to announce join', error, { guildId })
      }
    }
    return
  }

  // ユーザーがVCから離脱した場合
  if (oldState.channel && !newState.channel) {
    // 残っているメンバーをチェック（Bot除く） → 先にチェックして空なら即離脱
    const remainingMembers = oldState.channel.members.filter((member) => !member.user.bot)

    if (remainingMembers.size === 0) {
      destroyPlayer(guildId)
      disconnectFromChannel(guildId)
      return
    }

    // 離脱アナウンス
    const connection = getConnection(guildId)
    if (connection && guildSettings.announceLeave && newState.member) {
      try {
        const speakerId = await getCurrentSpeakerId(newState.member.user.id)
        const speakerConfig = await getCurrentSpeakerConfig(newState.member.user.id)
        const username = newState.member.displayName || newState.member.user.username
        const announceText = `${username}が退席しました`
        const audioStream = await textToSpeechWithSettings(announceText, speakerId, speakerConfig)
        enqueueAudio(guildId, audioStream, connection)
      } catch (error) {
        await notifyError('Failed to announce leave', error, { guildId })
      }
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
        destroyPlayer(guildId)
        await connectToChannel(newState.channel)
      } catch (error) {
        await notifyError('Failed to move to new voice channel', error, { guildId })
        disconnectFromChannel(guildId)
      }
    }
  }
})

/**
 * メッセージ受信時のTTS処理
 * - Botがギルドに接続中の場合のみ処理
 * - readNonVcUsersがfalseの場合: Botと同じVCにいるユーザーのみ読み上げ
 * - readNonVcUsersがtrueの場合: VC外のユーザーも読み上げ
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

  // ギルド設定を取得
  const guildSettings = await getGuildSettings(guildId)

  // 送信者の情報を取得
  const member = message.member

  // BotがいるVCと同じか確認
  const botVoiceChannelId = message.guild.members.me?.voice.channelId
  const isInSameChannel = member?.voice.channelId === botVoiceChannelId

  // 1. VCのテキストチャンネルかどうか → YESなら読み上げる
  const isVcTextChannel = message.channel.id === botVoiceChannelId
  if (isVcTextChannel) {
    // VCのテキストチャンネルなので読み上げ処理へ
  } else {
    // 2. 読み上げチャンネルに登録されているかどうか → NOなら読み上げない
    if (guildSettings.readChannels.length > 0 && !guildSettings.readChannels.includes(message.channel.id)) {
      return
    }

    // 3. 書き込んだユーザーはVCに参加しているか → しているなら読み上げる
    if (isInSameChannel) {
      // VCに参加しているので読み上げ処理へ
    } else {
      // 4. VC外ユーザー読み上げ設定が有効か → 有効なら読み上げる、そうでないなら読み上げない
      if (!guildSettings.readNonVcUsers) {
        return
      }
    }
  }

  // テキストを前処理
  const processedText = preprocessForTts(message.content)
  if (!processedText) return

  try {
    // ユーザー設定を取得
    const speakerId = await getCurrentSpeakerId(message.author.id)
    const speakerConfig = await getCurrentSpeakerConfig(message.author.id)

    // TTSで音声を生成
    const audioStream = await textToSpeechWithSettings(processedText, speakerId, speakerConfig)

    // キューに追加して再生
    enqueueAudio(guildId, audioStream, connection)
  } catch (error) {
    await notifyError('Failed to process TTS', error, { guildId })
  }
})

// Botを起動
client.login(config.DISCORD_TOKEN)
