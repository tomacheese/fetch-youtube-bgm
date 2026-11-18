import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { test } from 'node:test'

const existing = { track: 'Title', artist: 'Artist', album: 'Album', albumArtist: 'Album artist' }
let saved
let current
let webhookDeleted

globalThis.defineEventHandler = handler => handler
globalThis.readBody = async event => event.body
globalThis.createError = details => Object.assign(new Error(details.statusMessage), details)
globalThis.TrackManager = {
  getTrack: () => current,
  set: (vid, track) => { saved = { vid, track } }
}
globalThis.WebhookTrackManager = {
  getTrack: () => true,
  delete: () => { webhookDeleted = true }
}

const source = await readFile(new URL('../src/server/api/tracks/[vid].patch.ts', import.meta.url), 'utf8')
const javascript = stripTypeScriptTypes(source.replace("import { TrackManager } from '../../utils/track-manager'", ''))
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

const run = async (body, track = existing) => {
  saved = undefined
  webhookDeleted = false
  current = track
  const event = { body, context: { params: { vid: 'video' } }, node: { res: {} } }
  await handler(event)
  assert.equal(event.node.res.statusCode, 204)
  assert.equal(webhookDeleted, true)
  return saved.track
}

test('preserves omitted fields and updates supplied strings', async () => {
  assert.deepEqual(await run({ track: 'New title', artist: 'New artist' }), { ...existing, track: 'New title', artist: 'New artist' })
})

test('clears optional fields with null or empty strings', async () => {
  assert.deepEqual(await run({ artist: null, album: '', albumArtist: null }), { track: 'Title', artist: null, album: '', albumArtist: null })
})

test('creates tracks with optional fields defaulting to null', async () => {
  assert.deepEqual(await run({ track: 'New' }, null), { track: 'New', artist: null, album: null, albumArtist: null })
})

test('rejects invalid fields without writing or deleting webhook data', async () => {
  for (const body of [null, [], { track: 123 }, { track: null }, { track: '' }, { artist: 456 }, { album: false }, { albumArtist: {} }]) {
    saved = undefined
    webhookDeleted = false
    current = existing
    await assert.rejects(handler({ body, context: { params: { vid: 'video' } }, node: { res: {} } }), { statusCode: 400 })
    assert.equal(saved, undefined)
    assert.equal(webhookDeleted, false)
  }
})

test('requires a title when creating a track', async () => {
  await assert.rejects(run({ artist: 'Artist' }, null), { statusCode: 400 })
})
