import { TrackManager } from '../utils/track-manager'

export default defineEventHandler(() => {
  return TrackManager.getTracks()
})
