---
name: discord-js
description: discord.js v14 conventions. Use when writing or reviewing Discord bot code, slash commands, voice connections, event handlers, and interactions.
user-invocable: false
---

# discord.js v14 Conventions

## Client
- Use `GatewayIntentBits` to declare required intents
- Privileged intents (`MessageContent`, `GuildMembers`) must be enabled in the Discord Developer Portal
- Use `Events` enum for event names (not raw strings)

## Slash Commands
- Define commands with `SlashCommandBuilder`
- Register via `REST.put(Routes.applicationCommands(clientId), { body })`
- Handle with `interaction.isChatInputCommand()` guard

## Interaction Responses
- Must respond within 3 seconds — use `deferReply()` to extend
- Use `MessageFlags.Ephemeral` for user-only messages
- Use `editReply()` after `deferReply()` to send the final response

```typescript
// Immediate reply
await interaction.reply({ content: 'Pong!' })

// Deferred reply for long-running operations
await interaction.deferReply()
await interaction.editReply({ content: 'Done' })

// Ephemeral message
await interaction.reply({ content: 'Secret', flags: MessageFlags.Ephemeral })
```

## Event Handling
- `Events.ClientReady` — bot startup (use `client.once`)
- `Events.InteractionCreate` — slash commands, buttons, modals
- `Events.VoiceStateUpdate` — VC join/leave/move detection
- `Events.MessageCreate` — message received (filter `message.author.bot` and `!message.guild`)

## Voice (@discordjs/voice)
- Join with `joinVoiceChannel({ channelId, guildId, adapterCreator })`
- Play audio with `createAudioPlayer()` + `createAudioResource(stream)`
- Subscribe player to connection: `connection.subscribe(player)`
- Listen on `AudioPlayerStatus.Idle` for queue processing

## Key Imports

```typescript
// Client & events
import { Client, Events, GatewayIntentBits, MessageFlags, REST, Routes } from 'discord.js'

// Command building
import { SlashCommandBuilder } from 'discord.js'

// Types
import type { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js'

// Voice
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'
```
