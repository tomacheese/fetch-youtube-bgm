import fs from 'fs'
import type { FileTrack, ITracksFile } from '~~/src/models/track'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class WebhookTrackManager {
  private static readonly tracksFile = process.env.WEBHOOK_TRACKS_FILE || 'data/webhook-tracks.json'

  public static getTracks(): ITracksFile {
    if (!fs.existsSync(this.tracksFile)) {
      return {}
    }
    const data = fs.readFileSync(this.tracksFile, 'utf8')
    return JSON.parse(data) as ITracksFile
  }

  public static getTrack(vid: string): FileTrack | undefined {
    const tracks = this.getTracks()
    return tracks[vid]
  }

  public static set(vid: string, track: FileTrack) {
    const tracks = this.getTracks()
    tracks[vid] = track
    fs.writeFileSync(this.tracksFile, JSON.stringify(tracks, null, 2))
  }

  public static delete(vid: string) {
    const tracks = this.getTracks()
    if (!tracks[vid]) {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete tracks[vid]
    fs.writeFileSync(this.tracksFile, JSON.stringify(tracks, null, 2))
  }
}
