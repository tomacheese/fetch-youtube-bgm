import axios from 'axios'
import { Config } from './configuration'

export interface DiscordEmbedFooter {
  text: string
  icon_url?: string
  proxy_icon_url?: string
}

export interface DiscordEmbedImage {
  url?: string
  proxy_url?: string
  height?: number
  width?: number
}

export interface DiscordEmbedThumbnail {
  url?: string
  proxy_url?: string
  height?: number
  width?: number
}

export interface DiscordEmbedVideo {
  url?: string
  proxy_url?: string
  height?: number
  width?: number
}

export interface DiscordEmbedProvider {
  name?: string
  url?: string
}

export interface DiscordEmbedAuthor {
  name?: string
  url?: string
  icon_url?: string
  proxy_icon_url?: string
}

export interface DiscordEmbedField {
  name: string
  value: string
  inline?: boolean
}

export interface DiscordEmbed {
  title?: string
  type?: 'rich' | 'image' | 'video' | 'gifv' | 'article' | 'link'
  description?: string
  url?: string
  timestamp?: string
  color?: number
  footer?: DiscordEmbedFooter
  image?: DiscordEmbedImage
  thumbnail?: DiscordEmbedThumbnail
  video?: DiscordEmbedVideo
  provider?: DiscordEmbedProvider
  author?: DiscordEmbedAuthor
  fields?: DiscordEmbedField[]
}

export async function sendDiscordMessage(
  config: Config,
  text: string,
  embed?: DiscordEmbed,
): Promise<void> {
  if (!config.discord) {
    return
  }
  // webhook or bot
  if (config.discord.webhook_url) {
    // webhook
    const response = await axios.post(config.discord.webhook_url, {
      content: `${text}`,
      embeds: embed ? [embed] : undefined,
    })
    if (response.status !== 204) {
      throw new Error(`Discord webhook failed (${response.status})`)
    }
    return
  }
  if (config.discord.token && config.discord.channel_id) {
    // bot
    const response = await axios.post(
      `https://discord.com/api/channels/${config.discord.channel_id}/messages`,
      {
        content: `${text}`,
        embeds: embed ? [embed] : undefined,
      },
      {
        headers: {
          Authorization: `Bot ${config.discord.token}`,
        },
      },
    )
    if (response.status !== 200) {
      throw new Error(`Discord bot failed (${response.status})`)
    }
  }
}
