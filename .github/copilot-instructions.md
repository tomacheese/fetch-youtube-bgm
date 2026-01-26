# GitHub Copilot Instructions

## プロジェクト概要

- 目的: YouTube プレイリストから動画をダウンロードし、メタデータを付与して MP3 に変換する。
- 主な機能:
  - YouTube プレイリストからの動画ダウンロードと MP3 変換。
  - Web UI によるメタデータ（タイトル、アーティスト、アルバム等）の編集。
  - Discord への通知機能。
  - mp3gain / rgain3 による音量調整。
  - Web Scrobbler 形式の JSON エクスポート。
- 対象ユーザー: YouTube の BGM をローカルで MP3 管理したいユーザー。

## 共通ルール

- 会話は日本語で行う。
- PR とコミットは [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) に従う。
  - `<type>(<scope>): <description>` 形式。
  - `<description>` は日本語で記載。
- 日本語と英数字の間には半角スペースを入れる。

## 技術スタック

- 言語: TypeScript
- フレームワーク:
  - downloader: Node.js (ts-node, ts-node-dev)
  - viewer: Nuxt.js (Vue.js 3, Vuetify 3)
- パッケージマネージャー: yarn (v1.22.22)
- 外部ツール: yt-dlp, ffmpeg, mp3gain, rgain3 (Python)

## 開発コマンド

### downloader

```bash
# 依存関係のインストール
yarn install

# 開発
yarn dev

# コンパイル (型チェック)
yarn compile

# Lint
yarn lint

# Fix
yarn fix
```

### viewer

```bash
# 依存関係のインストール
yarn install

# 開発
yarn dev

# ビルド
yarn build

# Lint
yarn lint

# Fix
yarn fix
```

## コーディング規約

- フォーマット: Prettier
- Linter: ESLint (Config: @book000/eslint-config)
- TypeScript: `skipLibCheck` の使用は禁止。
- ドキュメント: 関数やインターフェースには日本語で JSDoc を記載する。

## テスト方針

- 現在、明示的なテストコード（Jest 等）は含まれていない。
- `yarn compile` (downloader) による型チェックを CI で実施。

## セキュリティ / 機密情報

- `data/config.json` や `.env` に含まれる認証情報（Discord トークン等）を Git にコミットしない。
- ログに個人情報や認証情報を出力しない。

## ドキュメント更新

- 機能追加・変更時には `README.md` を更新する。

## リポジトリ固有

- データの保存先は `/data` ディレクトリ（Docker ボリューム）に統一されている。
- YouTube の動画取得には `yt-dlp` を使用し、Google API 認証は不要。
