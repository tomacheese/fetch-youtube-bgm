export interface Track {
  vid: string
  track: string
  artist: string | null
  album: string | null
  albumArtist: string | null
  isDownloaded?: boolean
}

export type EditingTrack = {
  isNew: boolean
  isWebhookTrack: boolean
} & Track

export interface FileTrack {
  track: string
  artist: string | null
  album: string | null
  albumArtist: string | null
}

export interface ITracksFile {
  [key: string]: FileTrack
}
