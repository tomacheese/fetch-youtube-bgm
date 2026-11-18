const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync('src/server/api/webhook.post.ts', 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const moduleExports = {}
const context = {
  exports: moduleExports,
  require: () => ({ TrackManager: {}, WebhookTrackManager: {}, MusicBrainz: {} }),
  defineEventHandler: (handler) => handler,
  readBody: async (event) => event.body,
  createError: (details) => Object.assign(new Error(details.statusMessage), details)
}
vm.runInNewContext(compiled, context)
const handler = moduleExports.default

const valid = { data: { song: { parsed: { uniqueID: 'id', track: 'track', artist: null }, flags: { isCorrectedByUser: true } } } }
const invalid = [
  null, [], {}, { data: null }, { data: [] }, { data: {} },
  { data: { song: null } }, { data: { song: [] } }, { data: { song: {} } },
  { data: { song: { parsed: null, flags: {} } } },
  { data: { song: { parsed: [], flags: {} } } },
  { data: { song: { parsed: {}, flags: null } } },
  { data: { song: { parsed: valid.data.song.parsed, flags: [] } } },
  ...['uniqueID', 'track', 'artist'].map((key) => {
    const parsed = { ...valid.data.song.parsed }
    delete parsed[key]
    return { data: { song: { parsed, flags: valid.data.song.flags } } }
  }),
  { data: { song: { parsed: valid.data.song.parsed, flags: {} } } },
  { data: { song: { parsed: { ...valid.data.song.parsed, artist: 1 }, flags: valid.data.song.flags } } },
  { data: { song: { parsed: valid.data.song.parsed, flags: { isCorrectedByUser: 'true' } } } }
]

async function main() {
  for (const body of invalid) {
    await assert.rejects(handler({ body }), (error) => error.statusCode === 400 && error.statusMessage === 'Invalid request body')
  }
  for (const artist of [null, 'artist']) {
    const body = { data: { song: { ...valid.data.song, parsed: { ...valid.data.song.parsed, artist } } } }
    await assert.rejects(handler({ body }), (error) => error.statusCode === 400 && error.statusMessage === 'This track is corrected by user.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
