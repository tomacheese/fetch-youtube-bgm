import { TrackManager } from '../../utils/track-manager'
import type { Track } from '~~/src/models/track'

export default defineEventHandler(() => {
  const downloadedTrackFiles = TrackManager.getDownloadedTrackFiles() || []
  return Object.entries(TrackManager.getTracks()).map(([vid, track]) => {
    return {
      vid,
      track: track.track,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist,
      isDownloaded: downloadedTrackFiles.some(file => file.includes(vid))
    }
  }) as Track[]
})
