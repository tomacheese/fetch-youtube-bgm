# GitHub Copilot Instructions

GitHub Copilot のコードレビュー向けの指示。開発手順・規約・アーキテクチャは [AGENTS.md](../AGENTS.md) を参照し、ここでは複製しない。

## レビュー時の重点確認

- 認証情報のハードコードやコミット混入 (Discord トークン・Webhook URL)。`data/config.json` は Git 管理外。
- ログへの認証情報・個人情報の出力。
- 外部プロセス (`yt-dlp`, `ffmpeg`, `sox`, `mp3gain` / `rgain3`) 呼び出しのエラーハンドリングと入力の扱い。ID の検証 (`assertPlaylistId` / `assertVideoId`) を経由しているか。
- `skipLibCheck` を有効にしていないか。型エラーを握りつぶしていないか。
- 関数・インターフェースに日本語の JSDoc があるか。コメント・JSDoc が日本語、エラーメッセージが英語で統一されているか。

## 指摘しない既知パターン

- フォーマットや lint で機械的に検出できる差分。
- 自動テストの欠如そのもの。
- 日本語のコメント・ドキュメント (意図的)。
- yarn 1.x (Classic) の使用、およびルート `package.json` を持たない `downloader` / `viewer` 分離構成。
