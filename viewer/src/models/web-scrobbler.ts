export interface WebScrobblerWebhookBody {
  eventName: string
  time: number
  data: Data
}

interface Data {
  song: Song
}

interface Song {
  parsed: Parsed
  processed: Processed
  noRegex: NoRegex
  flags: Flags
  metadata: Metadata
  connector: Connector
  controllerTabId: number
}

interface Parsed {
  track: string
  artist: string | null
  albumArtist: string | null
  album: string | null
  duration: number
  uniqueID: string
  currentTime: number | null
  isPlaying: boolean
  trackArt: string
  isPodcast: boolean
  originUrl: string
  scrobblingDisallowedReason: string | null
}

interface Processed {
  track: string
  artist: string | null
  albumArtist: string | null
  duration: number
}

interface NoRegex {
  track: string
  artist: string | null
  albumArtist: string | null
  duration: number | null
}

interface Flags {
  isScrobbled: boolean
  isCorrectedByUser: boolean
  isRegexEditedByUser: IsRegexEditedByUser
  isAlbumFetched: boolean
  isValid: boolean
  isMarkedAsPlaying: boolean
  isSkipped: boolean
  isReplaying: boolean
  hasBlockedTag: boolean
  isLovedInService: boolean
  finishedProcessing: boolean
}

interface IsRegexEditedByUser {
  track: boolean
  artist: boolean
  album: boolean
  albumArtist: boolean
}

interface Metadata {
  userloved: boolean
  startTimestamp: number
  label: string
  artistUrl: string
  trackUrl: string
  userPlayCount: number
}

interface Connector {
  label: string
  matches: string[]
  js: string
  id: string
}
