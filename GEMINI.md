# GEMINI.md

## 目的

Gemini CLI 向けのコンテキストと作業方針を定義する。

## 出力スタイル

- 言語: 日本語
- トーン: プロフェッショナルかつ簡潔
- 形式: Markdown

## 共通ルール

- 会話は日本語で行う。
- コミット規約: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- 日本語と英数字の間には半角スペースを挿入する。

## プロジェクト概要

- YouTube プレイリストから動画をダウンロードし、MP3 変換・メタデータ付与を行うシステム。
- `downloader` (Node.js) と `viewer` (Nuxt.js) で構成。

## コーディング規約

- フォーマット: Prettier
- Linter: ESLint
- コメント言語: 日本語
- エラーメッセージ: 英語

## 開発コマンド

### downloader

- `yarn dev`: 開発実行
- `yarn compile`: 型チェック
- `yarn lint`: Lint 実行

### viewer

- `yarn dev`: 開発実行
- `yarn build`: ビルド
- `yarn lint`: Lint 実行

## 注意事項

- 認証情報（Discord トークン等）を Git にコミットしない。
- ログに機密情報を出力しない。
- 既存のコーディング規約やディレクトリ構造を優先する。

## リポジトリ固有

- 外部ツール（yt-dlp, ffmpeg, mp3gain）の動作を前提としている。
- `data/config.json` がメインの設定ファイル。
