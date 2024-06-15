import { TrackManager } from '../../utils/track-manager'
import { WebhookTrackManager } from '../../utils/webhook-track-manager'

export default defineEventHandler((event) => {
  if (!event.context.params) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Required parameter "vid" is missing'
    })
  }
  const vid = event.context.params.vid

  if (!TrackManager.getTrack(vid) && !WebhookTrackManager.getTrack(vid)) {
    throw createError({
      statusCode: 404,
      statusMessage: `Track with vid ${vid} not found`
    })
  }
  TrackManager.delete(vid)
  WebhookTrackManager.delete(vid)

  event.node.res.statusCode = 204
  return '' // empty body
})
