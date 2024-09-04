import fs from 'node:fs'

export interface Config {
  playlistId: string
  /** Discord webhook URL or bot token */
  discord?: {
    /** Discord webhook URL (required if using webhook) */
    webhook_url?: string
    /** Discord bot token (required if using bot) */
    token?: string
    /** Discord channel ID (required if using bot) */
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
