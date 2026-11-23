import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

test('captures and sanitizes download stderr without leaking to the parent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'download-stderr-'))
  try {
    fs.writeFileSync(
      path.join(dir, 'yt-dlp'),
      '#!/bin/sh\nprintf "proxy https://test-user:test-password@example.invalid/path\\n" >&2\nexit 7\n',
      { mode: 0o755 },
    )
    const script = `
      require('ts-node/register')
      const constants = require('./src/constants')
      constants.DOWNLOAD_TEMP_DIR = process.argv[1]
      const { downloadVideo } = require('./src/lib')
      process.stdout.write(JSON.stringify(downloadVideo('abcdefghijk')))
    `
    const child = spawnSync(process.execPath, ['-e', script, dir], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, PATH: `${dir}${path.delimiter}${process.env.PATH}` },
      encoding: 'utf8',
    })
    assert.equal(child.status, 0, child.stderr)
    assert.equal(child.stderr, '')
    assert.deepEqual(JSON.parse(child.stdout), {
      success: false,
      exitCode: 7,
      stderr: 'proxy https://***:***@example.invalid/path\n',
    })
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
