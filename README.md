# AivisSpeech Discord Bot

Discord の音声チャンネルに参加して、テキストチャンネルのメッセージを AivisSpeech Engine を使用して読み上げる Discord Bot です。

## 概要

このボットは以下の機能を提供します:

- Discord の音声チャンネルでテキストメッセージを音声合成して読み上げ
- 複数の話者（キャラクター）とスタイルから選択可能
- ユーザーごとに話者設定を保存
- ユーザー辞書機能（読み方のカスタマイズ）
- Redis を使用した設定の永続化

## 技術スタック

- **Runtime**: [Bun](https://bun.com) v1.3.5
- **言語**: TypeScript
- **主要ライブラリ**:
  - [discord.js](https://discord.js.org/) - Discord API クライアント
  - [@discordjs/voice](https://discordjs.guide/voice/) - 音声機能
  - [Zod](https://zod.dev/) - スキーマバリデーション
  - [ioredis](https://github.com/redis/ioredis) - Redis クライアント
- **音声合成**: [AivisSpeech Engine](https://github.com/Aivis-Project/AivisSpeech-Engine)

## 前提条件

- Docker および Docker Compose がインストールされていること
- Discord Bot のトークンを取得済みであること
  - [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
  - Bot を作成してトークンを取得
  - 必要な権限: `Send Messages`, `Connect`, `Speak`, `Use Voice Activity`
  - Privileged Gateway Intents: `MESSAGE CONTENT INTENT` を有効化

## セットアップ

### 1. 環境変数の設定

`.env.example` をコピーして `.env` ファイルを作成します:

```bash
cp .env.example .env
```

`.env` ファイルを編集して、Discord Bot トークンを設定します:

```env
# Discord Bot Token (必須)
DISCORD_TOKEN=your_discord_bot_token_here

# AivisSpeech Engine URL (デフォルト: http://aivis:10101)
AIVIS_BASE_URL=http://aivis:10101

# デフォルト話者ID（スタイルID）
# 1633968992 = 桜羽エマ - ノーマル
DEFAULT_SPEAKER_ID=1633968992

# Redis URL (デフォルト: redis://redis:6379)
REDIS_URL=redis://redis:6379
```

### 2. Docker Compose で起動

```bash
docker compose up -d
```

このコマンドで以下のコンテナが起動します:

- `app`: Discord Bot 本体
- `aivis`: AivisSpeech Engine (音声合成エンジン)
- `redis`: ユーザー設定の保存用

### 3. ログの確認

```bash
docker compose logs -f app
```

## Docker Compose 設定例

### 基本構成

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DISCORD_TOKEN: ${DISCORD_TOKEN}
    depends_on:
      redis:
        condition: service_healthy
      aivis:
        condition: service_healthy
    stdin_open: true
    tty: true

  aivis:
    image: tkgling/aivisspeech-engine:cuda12.8.1-cudnn-1.1.0
    volumes:
      - ./AivisSpeech-Engine-Dev:/home/user/.local/share/AivisSpeech-Engine-Dev:cached

  redis:
    image: redis:8.4.0
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  redis-data:
    name: redis-data
```

**ボリュームマウントについて:**

- `aivis` サービス: バインドマウント（`./AivisSpeech-Engine-Dev`）を使用
  - AivisSpeech Engine のモデルデータや設定を直接操作できます
  - 新しいモデル(`aivmx`形式)を追加する場合は、`AivisSpeech-Engine-Dev/Models` ディレクトリに直接配置可能
  - ホスト側から簡単にバックアップや管理が可能
- `redis` サービス: 名前付きボリューム（`redis-data`）を使用
  - Redis のデータは Docker が管理し、直接操作する必要がないため

### カスタマイズ例

環境変数で設定を上書きする場合:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      DISCORD_TOKEN: ${DISCORD_TOKEN}
      AIVIS_BASE_URL: http://aivis:10101
      DEFAULT_SPEAKER_ID: 1633968992
      REDIS_URL: redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
      aivis:
        condition: service_healthy
```

ポートを公開する場合（デバッグ用）:

```yaml
services:
  aivis:
    image: tkgling/aivisspeech-engine:cuda12.8.1-cudnn-1.1.0
    ports:
      - 10101:10101
    volumes:
      - ./AivisSpeech-Engine-Dev:/home/user/.local/share/AivisSpeech-Engine-Dev:cached

  redis:
    image: redis:8.4.0
    ports:
      - 6379:6379
    volumes:
      - redis-data:/data
```

## 開発

### 依存関係のインストール

```bash
bun install
```

### 開発モード（ホットリロード）

```bash
bun run dev
```

### ビルド

```bash
bun run build
```

### 本番実行

```bash
bun run start
```

## 使い方

### コマンド一覧

#### `/speaker` - 話者設定

- `/speaker list` - 利用可能な話者の一覧を表示
- `/speaker set <name>` - 話者を設定（オートコンプリート対応）
- `/speaker current` - 現在の話者設定を表示

#### `/settings` - 設定管理

- `/settings show` - 現在の設定を表示
- `/settings reset` - 設定をリセット

#### `/dict` - ユーザー辞書

- `/dict add <word> <reading>` - 辞書に単語を追加
- `/dict remove <word>` - 辞書から単語を削除
- `/dict list` - 登録済みの単語一覧を表示

### 基本的な使い方

1. Discord サーバーに Bot を招待
2. 音声チャンネルに参加
3. テキストチャンネルで `/speaker set` コマンドで好きな話者を選択
4. テキストチャンネルにメッセージを送信すると、音声チャンネルで読み上げられます

## ライセンス

MIT

## 関連リンク

- [AivisSpeech Engine](https://github.com/Aivis-Project/AivisSpeech-Engine)
- [discord.js](https://discord.js.org/)
- [Bun](https://bun.com)
