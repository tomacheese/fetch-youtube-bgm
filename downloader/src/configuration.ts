import fs from 'fs'

export interface Config {
  playlistId: string
  /** Discord webhook URL or bot token */
  discord: {
    /** Discord webhook URL (required if using webhook) */
    webhook_url?: string
    /** Discord bot token (required if using bot) */
    token?: string
    /** Discord channel ID (required if using bot) */
    channel_id?: string
  }
}

export function getConfig() {
  const config = JSON.parse(
    fs.readFileSync('./config.json').toString(),
  ) as Config
  return config
}
