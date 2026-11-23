import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const stores = ['downloader/src/tracks-store.ts', 'viewer/src/server/utils/tracks-store.ts']
  .map(file => pathToFileURL(path.resolve(process.cwd(), '..', file)).href)

function worker(store, file, prefix) {
  const source = `import { updateTracks } from ${JSON.stringify(store)};
    for (let i = 0; i < 40; i++) updateTracks(${JSON.stringify(file)}, tracks => { tracks[${JSON.stringify(prefix)} + i] = 'x'.repeat(1000) })`
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: 'inherit' })
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Worker exited: ${code}`)))
  })
}

test('両プロセスの更新を保持し、読み取り中も JSON が壊れない', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'tracks-store-'))
  const file = path.join(dir, 'tracks.json')
  writeFileSync(file, '{}')
  try {
    let finished = false
    const writers = Promise.all(stores.map((store, i) => worker(store, file, `writer${i}-`))).finally(() => { finished = true })
    while (true) {
      if (finished) break
      JSON.parse(readFileSync(file, 'utf8'))
      await new Promise(resolve => setImmediate(resolve))
    }
    await writers
    const result = JSON.parse(readFileSync(file, 'utf8'))
    assert.equal(Object.keys(result).length, 80)
    for (let i = 0; i < 40; i++) {
      assert.equal(result[`writer0-${i}`].length, 1000)
      assert.equal(result[`writer1-${i}`].length, 1000)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
