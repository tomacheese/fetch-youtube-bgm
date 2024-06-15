import { TrackManager } from '../../utils/track-manager'
import type { Track } from '~~/src/models/track'

export default defineEventHandler((event) => {
  if (!event.context.params) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "vid" is missing'
    })
  }
  const vid = event.context.params.vid
  const track = TrackManager.getTrack(vid)
  if (!track) {
    throw createError({
      statusCode: 404,
      statusMessage: `Track with vid ${vid} not found`
    })
  }
  return {
    vid,
    track: track.track,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist
  } satisfies Track
})
