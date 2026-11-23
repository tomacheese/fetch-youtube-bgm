import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const load = createRequire(import.meta.url)
load('ts-node/register')
const NodeID3 = load('node-id3')
const { updateTrackTags } = load('../src/lib')

test('synchronizes saved metadata and clears tags while preserving other frames and audio', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'id3-tags-'))
  const file = path.join(directory, 'track.mp3')
  const audio = Buffer.from('sample audio')
  const track = { vid: 'abcdefghijk', track: 'Title', artist: 'Artist', album: 'Album', albumArtist: 'Album artist' }
  try {
    fs.writeFileSync(file, NodeID3.write({ title: 'Old', artist: 'Old', album: 'Old', performerInfo: 'Old', genre: 'Rock' }, audio))
    updateTrackTags(file, track)
    let tags = NodeID3.read(file)
    assert.deepEqual([tags.title, tags.artist, tags.album, tags.performerInfo, tags.genre], ['Title', 'Artist', 'Album', 'Album artist', 'Rock'])
    assert.ok(fs.readFileSync(file).subarray(-audio.length).equals(audio))
    const unchanged = fs.readFileSync(file)
    updateTrackTags(file, track)
    assert.deepEqual(fs.readFileSync(file), unchanged)
    updateTrackTags(file, { ...track, artist: null, album: null, albumArtist: null })
    tags = NodeID3.read(file)
    assert.equal(tags.title, 'Title')
    assert.ok(!tags.artist)
    assert.ok(!tags.album)
    assert.ok(!tags.performerInfo)
    assert.equal(tags.genre, 'Rock')
    updateTrackTags(file, { ...track, track: null, artist: '', album: '', albumArtist: '' })
    tags = NodeID3.read(file)
    assert.ok(!tags.title)
    assert.ok(!tags.artist)
    assert.ok(!tags.album)
    assert.ok(!tags.performerInfo)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('updates tags during the unchanged-video metadata filter without downloading', async () => {
  const lib = load('../src/lib')
  const configuration = load('../src/configuration')
  const { ParallelFetchVideoMetadata } = load('../src/main')
  const { mock } = await import('node:test')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'id3-filter-'))
  const file = path.join(directory, 'track.mp3')
  const track = { vid: 'abcdefghijk', track: 'Title', artist: 'Artist', album: 'New album', albumArtist: 'New album artist' }
  const metadata = { duration: 10, filesizeApprox: 20 }
  fs.writeFileSync(file, NodeID3.write({ album: 'Old album' }, Buffer.from('audio')))
  const methods = [
    mock.method(lib, 'getVideoMetadataStore', () => ({ [track.vid]: metadata })),
    mock.method(lib, 'getVideoMetadata', async () => metadata),
    mock.method(lib, 'getTrack', async () => track),
    mock.method(configuration, 'getConfig', () => ({})),
    mock.method(lib, 'getFilename', () => file),
  ]
  const originalExists = fs.existsSync
  methods.push(
    mock.method(fs, 'existsSync', (name) => name === `/data/tracks/${file}` ? true : originalExists(name)),
    mock.method(lib, 'updateTrackTags', (_name, value) => updateTrackTags(file, value)),
  )
  try {
    const result = await new ParallelFetchVideoMetadata([track.vid]).runAll(1)
    assert.deepEqual(result.idsToProcess, [])
    const tags = NodeID3.read(file)
    assert.equal(tags.album, track.album)
    assert.equal(tags.performerInfo, track.albumArtist)
  } finally {
    for (const method of methods) method.mock.restore()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('updates the existing MP3 when downloaded audio has the same fingerprint', async () => {
  const lib = load('../src/lib')
  const configuration = load('../src/configuration')
  const { ParallelProcessVideo } = load('../src/main')
  const { mock } = await import('node:test')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'id3-fingerprint-'))
  const file = path.join(directory, 'track.mp3')
  const track = { vid: 'abcdefghijk', track: 'Title', artist: 'Artist', album: 'New album', albumArtist: null }
  fs.writeFileSync(file, NodeID3.write({ album: 'Old album', performerInfo: 'Old artist' }, Buffer.from('audio')))
  const methods = [
    mock.method(configuration, 'getConfig', () => ({})),
    mock.method(lib, 'getTrack', async () => track),
    mock.method(lib, 'getVideoInformation', async () => ({ title: 'Title', artist: 'Artist' })),
    mock.method(lib, 'normalizeVolume', () => Buffer.alloc(0)),
    mock.method(lib, 'trimAndAddSilence', () => Buffer.alloc(0)),
    mock.method(lib, 'addId3Tag', () => {}),
    mock.method(lib, 'isSetArtwork', () => true),
    mock.method(lib, 'getFilename', () => file),
    mock.method(lib, 'getEchoPrint', () => 'same fingerprint'),
    mock.method(lib, 'updateTrackTags', (_name, value) => updateTrackTags(file, value)),
    mock.method(fs.promises, 'access', async () => {}),
    mock.method(fs, 'readdirSync', () => []),
    mock.method(fs, 'existsSync', () => true),
  ]
  try {
    await new ParallelProcessVideo([track.vid], new Map()).runAll(1)
    const tags = NodeID3.read(file)
    assert.equal(tags.album, 'New album')
    assert.ok(!tags.performerInfo)
  } finally {
    for (const method of methods) method.mock.restore()
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
