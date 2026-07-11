# GitHub Copilot Instructions

GitHub Copilot のコードレビュー機能向けの指示書。レビュー観点に絞って記述する（開発手順は `CLAUDE.md` を参照し、ここでは複製しない）。

## プロジェクト概要

- YouTube プレイリストから動画をダウンロードし、MP3 変換・メタデータ付与・音量調整・Discord 通知を行う。
- `downloader`（Node.js / ts-node）と `viewer`（Nuxt 3 + Vuetify 3）の 2 コンポーネント構成。両者は `/data` を共有し JSON 経由でデータをやり取りする。

## 技術スタック

- 言語: TypeScript
- ランタイム: Node.js 24 / パッケージマネージャー: yarn 1.x (Classic)
- Lint: ESLint (`@book000/eslint-config`)、Format: Prettier（`downloader` の lint で強制）
- 外部ツール: `yt-dlp`, `ffmpeg`, `mp3gain` / `rgain3`

## レビュー時の重点確認

- 認証情報のハードコードやコミット混入（Discord トークン・Webhook URL）。`data/config.json` は Git 管理外。
- ログへの認証情報・個人情報の出力。
- 外部プロセス（`yt-dlp`, `ffmpeg`, `mp3gain` / `rgain3`）呼び出し時のエラーハンドリングと入力の取り扱い。
- エラーメッセージは英語、コメント・JSDoc は日本語、で統一されているか。
- TypeScript で `skipLibCheck` を有効化していないか（禁止）。
- `downloader` の型安全性は `yarn compile`（`tsc`）で担保される前提。型エラーを握りつぶしていないか。

## コーディング規約

- Prettier / ESLint (`@book000/eslint-config`) に従う。フォーマットや lint で機械的に検出できる差分は、レビューでの指摘対象としない。
- 関数・インターフェースには日本語で JSDoc を記載する。

## コミット規約

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) に従う。`<type>(<scope>): <description>` 形式、`<description>` は日本語。

## 指摘すべきでない既知パターン

- 自動テスト（Jest 等）は未整備。テストの欠如そのものは指摘しない。
- 日本語のコメント・ドキュメントは意図的なもの。英語化を促さない。
- yarn 1.x (Classic) を意図的に使用している。npm / pnpm / yarn Berry への移行を促さない。
- `downloader` と `viewer` はワークスペース統合しておらず、ルート `package.json` は存在しない。単一 `package.json` への統合を促さない。
