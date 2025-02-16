import type { FileTrack } from '~/models/track';
import { TrackManager } from '../utils/track-manager';
import { WebhookTrackManager } from '../utils/webhook-track-manager';
import type { WebScrobblerWebhookBody } from '~/models/web-scrobbler';
import { MusicBrainz } from '../utils/musicbrainz';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateBody(body: any): body is WebScrobblerWebhookBody {
  // 最低限必要なプロパティがあるかどうかをチェック
  return (
    typeof body === 'object' &&
    typeof body.data.song.parsed.uniqueID === 'string' &&
    typeof body.data.song.parsed.track === 'string' &&
    (typeof body.data.song.parsed.artist === 'string' || body.data.song.parsed.artist === null) &&
    typeof body.data.song.flags.isCorrectedByUser === 'boolean'
  )
}

function getVideoInfo(vid: string): Promise<FileTrack | null> {
  return new Promise((resolve, reject) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          reject(new Error(`Failed to fetch video info: ${res.statusText}`))
          return
        }
        return res.json()
      })
      .then((data) => {
        const trackData = {
          track: data.title,
          artist: data.author_name,
          album: null,
          albumArtist: null
        } satisfies FileTrack
        resolve(trackData)
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body || typeof body !== 'object' || !validateBody(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const {
    data: {
      song: {
        parsed: { uniqueID: vid, track, artist },
        flags: { isCorrectedByUser }
      }
    }
  } = body

  // ユーザーが修正している場合は無視
  if (isCorrectedByUser) {
    throw createError({
      statusCode: 400,
      statusMessage: 'This track is corrected by user.'
    })
  }

  // すでに登録済みの場合は無視
  if (TrackManager.getTrack(vid) || WebhookTrackManager.getTrack(vid)) {
    throw createError({
      statusCode: 409, // Conflict
      statusMessage: 'This track is already registered.'
    })
  }

  const videoInfo = await getVideoInfo(vid)
  if (!videoInfo) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Video not found'
    })
  }

  // タイトルに、trackの値が含まれているかどうかをチェック
  if (!videoInfo.track.toLowerCase().includes(track.toLowerCase())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Track name does not match'
    })
  }

  // MusicBrainzから情報を取得
  let trackName = track
  let artistName = artist
  const musicbrainzInfo = await MusicBrainz.getTrackInfo(vid)
  if (musicbrainzInfo) {
    trackName = musicbrainzInfo.title
    artistName = musicbrainzInfo.artist
  }

  const trackData = {
    track: trackName,
    artist: artistName,
    album: null,
    albumArtist: null
  } satisfies FileTrack

  WebhookTrackManager.set(vid, trackData)
  event.node.res.statusCode = 201 // Created
  return trackData
})
