import { TrackManager } from '../../utils/track-manager'

export default defineEventHandler(async (event) => {
  const vid = event.context.params?.vid
  if (!vid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "vid" is missing'
    })
  }

  const body = await readBody(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { track: title, artist, album, albumArtist } = body
  if (
    (title !== undefined && typeof title !== 'string') ||
    [artist, album, albumArtist].some(value => value !== undefined && value !== null && typeof value !== 'string')
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid track fields'
    })
  }

  const track = TrackManager.getTrack(vid)
  const newTitle = title === undefined ? track?.track : title
  if (!newTitle) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "track" is missing'
    })
  }
  const newTrack = {
    track: newTitle,
    artist: artist === undefined ? track?.artist ?? null : artist,
    album: album === undefined ? track?.album ?? null : album,
    albumArtist: albumArtist === undefined ? track?.albumArtist ?? null : albumArtist
  }

  TrackManager.set(vid, newTrack)

  if (WebhookTrackManager.getTrack(vid)) {
    WebhookTrackManager.delete(vid)
  }

  event.node.res.statusCode = 204
  return ''
})
