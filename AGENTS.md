# AGENTS.md

## 言語ルール

- コミットメッセージの説明、PR / Issue のタイトルと本文、コードコメント / JSDoc、ドキュメントは日本語で書く。
- 日本語と英数字の間には半角スペースを入れる。
- 例外として、次のものは日本語にしない。
  - エラーメッセージとログ文言 (英語)
  - Discord 通知などユーザーに表示する文言
  - 引用、技術的な識別子
  - `package.json` (英語)
- コミットは [Conventional Commits](https://www.conventionalcommits.org/)、ブランチ名は [Conventional Branch](https://conventional-branch.github.io) (`feat/`, `fix/` など) に従う。
- Renovate が作成した PR には追加コミットしない。
- 関数とインターフェースには JSDoc を日本語で記載する。
- Git Worktree を使う場合は `.bare/` と `<ブランチ名>/` の構成にする (`.worktreeinclude` がある)。

## 概要

YouTube プレイリストの動画をダウンロードし、MP3 へ変換してメタデータを付与するサービス。ダウンロード、変換、タグ付与、音量調整、Web UI での編集、Discord 通知を行う。

- `downloader/`: ダウンロード・変換・タグ付けを行うバックエンド (Node.js、`ts-node`)。
- `viewer/`: 楽曲メタデータを編集する Nuxt 4 + Vuetify 4 のフロントエンド。
- 両者は `/data` を共有ボリュームとして使い、JSON ファイル (`tracks.json`、`webhook-tracks.json`、`video-metadata.json`) と MP3 (`tracks/`) を介してデータをやり取りする。
- `downloader` と `viewer` は独立した yarn プロジェクトで、ルートに `package.json` はない。依存関係は各ディレクトリで `yarn install` する。
- パッケージマネージャーは yarn 1.x (Classic)、ランタイムは Node.js (バージョンは各ディレクトリの `.node-version`)。
- 実行環境に必要な外部ツール: `yt-dlp`、`ffmpeg`、`sox`、`mp3gain` または `rgain3`、`echoprint-codegen`。

## 開発コマンド

### downloader (`downloader/`)

```bash
yarn install       # 依存関係のインストール
yarn dev           # 開発モードで実行 (ts-node-dev)
yarn compile:test  # 型チェックのみ (出力なし)
yarn lint          # Prettier / ESLint / tsc
yarn fix           # Prettier / ESLint の自動修正
```

`yarn compile` と `yarn lint:tsc` は `dist/` へ出力する。`yarn build` は名前に反して `ts-node` で起動するコマンドで、コンテナの `entrypoint.sh` が使う。

### viewer (`viewer/`)

```bash
yarn install  # 依存関係のインストール (postinstall で nuxt prepare を実行)
yarn dev      # 開発サーバー
yarn build    # 本番ビルド
yarn lint     # ESLint
yarn fix      # ESLint の自動修正
```

viewer に型チェック用のスクリプトはない。

## ディレクトリ構成

- `downloader/src/main.ts`: 常駐ループ。新規動画の検出、メタデータによる一次フィルタ、ダウンロード、変換、通知。
- `downloader/src/lib.ts`: yt-dlp / sox / mp3gain の呼び出し、ID3 タグ、メタデータストア。
- `downloader/src/musicbrainz.ts`, `discord.ts`, `configuration.ts`: MusicBrainz 連携、Discord 通知、`data/config.json` の読み込み。
- `viewer/src/server/api/`: viewer のバックエンド API (トラックの取得・更新・削除、Web Scrobbler の Webhook 受信)。
- `viewer/src/server/utils/`: `/data` 上の JSON を扱うマネージャーなど。
- `data/`: 設定・トラック情報・MP3 の保存先 (Git 管理外。`config.json` に認証情報を含む)。

## テスト

自動テストはない。変更後は次を実行して確認する。

- downloader: `yarn lint` と `yarn compile:test`
- viewer: `yarn lint`

## 守るべきルール

- `data/config.json` の認証情報 (Discord の Webhook URL / Bot トークン) をコミットしない。ログにも出力しない。
- 外部プロセスは `execFile` / `execFileSync` に引数配列で渡し、シェルを経由しない。プレイリスト ID と動画 ID は `assertPlaylistId` / `assertVideoId` で検証してから `yt-dlp` に渡す。
- `downloadVideo` / `getVideoMetadata` の `yt-dlp` 失敗ログには `error.message` を出さない (プロキシの認証情報を含むコマンド全体が入りうる)。stderr を `sanitizeSecrets` に通したものだけを診断情報として使う。なお `getPlaylistVideoIds` は `--proxy` 付きの `execFileSync` を try/catch せず呼んでおり、この規則の例外になっている (生のエラーが `main.ts` の `Failed to run heavy pipeline` / `Failed to run detection loop` のログに渡る)。
- 動画メタデータのストア (`/data/video-metadata.json`) は、読み込み失敗時に空として扱い (fail-open)、書き込みは一時ファイル経由のリネームでアトミックに行う。
- `skipLibCheck` を有効にしない。
- ログのエラーメッセージで絵文字を使う場合は、既存のメッセージの付け方に合わせる。
- viewer には認証がない。公開ネットワークへ直接露出する変更を入れない。
- 新機能や設定項目を変更したときは `README.md` を更新する。
