import type { Track } from '~~/src/models/track';

export default defineEventHandler(() => {
  return Object.entries(WebhookTrackManager.getTracks()).map(([vid, track]) => {
    return {
      vid,
      track: track.track,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist
    }
  }) satisfies Track[]
})
