import { TrackManager } from '../../utils/track-manager'

export default defineEventHandler(async (event) => {
  if (!event.context.params) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "vid" is missing'
    })
  }
  const vid = event.context.params.vid

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const {
    track: title,
    artist,
    album,
    albumArtist
  } = body satisfies {
      track: string | null | undefined
      artist: string | null | undefined
      album: string | null | undefined
      albumArtist: string | null | undefined
    }

  const track = TrackManager.getTrack(vid)
  // track.track か title があれば OK
  const newTitle = title || track?.track
  if (!newTitle) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "track" is missing'
    })
  }
  const newTrack = {
    track: newTitle,
    artist: artist || track?.artist || null,
    album: album || track?.album || null,
    albumArtist: albumArtist || track?.albumArtist || null
  }

  TrackManager.set(vid, newTrack)

  if (WebhookTrackManager.getTrack(vid)) {
    WebhookTrackManager.delete(vid)
  }

  event.node.res.statusCode = 204
  return '' // empty body
})
