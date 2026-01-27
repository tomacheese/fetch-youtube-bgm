# CLAUDE.md

## 目的

このドキュメントは、Claude Code の作業方針とプロジェクト固有ルールを示す。

## 判断記録のルール

1. 判断内容の要約
2. 検討した代替案
3. 採用しなかった案とその理由
4. 前提条件・仮定・不確実性
5. 他エージェントによるレビュー可否

## プロジェクト概要

- 目的: YouTube プレイリストから動画をダウンロードし、メタデータを付与して MP3 に変換する。
- 主な機能:
  - プレイリスト同期、MP3 変換、タグ付与、音量調整、Web UI による編集。

## 重要ルール

- 会話言語: 日本語
- コミット規約: [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
- コメント言語: 日本語
- エラーメッセージ: 英語
- 日本語と英数字の間には半角スペースを挿入する。

## 環境のルール

- ブランチ命名: [Conventional Branch](https://conventional-branch.github.io) (`feat/`, `fix/`)
- GitHub リポジトリ調査: 必要に応じてテンポラリディレクトリにクローンして検索する。
- Renovate PR: 追加コミットや更新を行わない。

## Git Worktree

- Git Worktree を使用する場合、以下の構成とする。
  - `.bare/`
  - `<ブランチ名>/`

## コード改修時のルール

- エラーメッセージの絵文字統一: 既存のメッセージに絵文字がある場合、それに従う。
- TypeScript: `skipLibCheck` の使用は禁止。
- JSDoc: 関数やインターフェースには日本語で記載する。

## 相談ルール

- Codex CLI: 実装レビュー、局所設計、整合性確認。
- Gemini CLI: 外部仕様、最新情報の確認。

## 開発コマンド

### downloader

```bash
yarn install  # 依存関係インストール
yarn dev      # 開発モード実行
yarn compile  # 型チェック
yarn lint     # Lint 実行
yarn fix      # 自動修正
```

### viewer

```bash
yarn install  # 依存関係インストール
yarn dev      # 開発モード実行
yarn build    # ビルド
yarn lint     # Lint 実行
yarn fix      # 自動修正
```

## アーキテクチャと主要ファイル

### アーキテクチャサマリー

- `downloader`: YouTube からのダウンロード、変換、メタデータ管理を行うバックエンドサービス。
- `viewer`: ダウンロードされた楽曲のメタデータを編集するための Nuxt 3 フロントエンド。
- 両者は `/data` ディレクトリを共有ボリュームとして使用し、JSON ファイル経由でデータを共有する。

### 主要ディレクトリ

- `downloader/src/`: ダウンローダーのソースコード。
- `viewer/src/`: ビューアー（Nuxt）のソースコード。
- `viewer/src/server/api/`: ビューアーのバックエンド API。
- `data/`: 設定ファイル、ログ、楽曲データ、MP3 ファイルが格納される（Git 管理外）。

## 実装パターン

- `downloader`: クラスベースのサービス構成。`@book000/node-utils` を活用。
- `viewer`: Nuxt 3 (Composition API) + Vuetify 3。

## テスト

- 現在、自動テストコードは存在しない。
- 変更後は `yarn lint` を実行し、型チェックは `yarn compile`（downloader のみ）によって行うことを必須とする（viewer には `compile` スクリプトは存在しない）。

## ドキュメント更新ルール

- 新機能追加時や設定項目の変更時は `README.md` を更新する。

## 作業チェックリスト

### 新規改修時

1. プロジェクトを理解する
2. 作業ブランチが適切であることを確認する
3. 最新のリモートブランチに基づいた新規ブランチであることを確認する
4. 不要ブランチが削除済みであることを確認する
5. `yarn install` を実行する

### コミット・プッシュ前

1. Conventional Commits に従っていることを確認する
2. センシティブな情報が含まれていないことを確認する
3. Lint / Format エラーがないことを確認する
4. 動作確認を行う

### PR 作成前

1. PR 作成の依頼があることを確認する
2. センシティブな情報が含まれていないことを確認する
3. コンフリクトの恐れがないことを確認する

### PR 作成後

1. コンフリクトがないことを確認する
2. PR 本文が最新状態のみを網羅していることを確認する
3. `gh pr checks <PR ID> --watch` で CI を確認する
4. Copilot レビューに対応する
5. コードレビューを実施し、指摘対応を行う
