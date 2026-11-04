import fs from 'node:fs'

export interface Config {
  playlistId: string
  /** Discord 通知の設定。Webhook か Bot のどちらかを指定する */
  discord?: {
    /** Webhook URL (Webhook を使う場合に必須) */
    webhook_url?: string
    /** Bot トークン (Bot を使う場合に必須) */
    token?: string
    /** チャンネル ID (Bot を使う場合に必須) */
    channel_id?: string
  }
  filename?: {
    sanitizeChars?: string[]
  }
}

export function getConfig() {
  const path = process.env.CONFIG_PATH ?? './data/config.json'
  const config = JSON.parse(fs.readFileSync(path).toString()) as Config
  return config
}
