import assert from 'node:assert/strict'
import childProcess from 'node:child_process'
import { createRequire } from 'node:module'
import { test, mock } from 'node:test'

const load = createRequire(import.meta.url)
load('ts-node/register')
const { getEchoPrint } = load('../src/lib')

test('compares fingerprints from single-file CLI arrays', () => {
  const exec = mock.method(childProcess, 'execFileSync', (command, args) => {
    assert.equal(command, '/usr/local/bin/echoprint-codegen')
    assert.deepEqual(args.slice(1), ['10', '30'])
    return Buffer.from(
      JSON.stringify([{ code: args[0], metadata: { filename: args[0] } }]),
    )
  })
  try {
    assert.notEqual(
      getEchoPrint('old-fingerprint'),
      getEchoPrint('new-fingerprint'),
    )
    assert.equal(
      getEchoPrint('same-fingerprint'),
      getEchoPrint('same-fingerprint'),
    )
  } finally {
    exec.mock.restore()
  }
})

test('rejects invalid CLI responses instead of comparing them', () => {
  const responses = [
    'not json',
    '{}',
    '[]',
    '[null]',
    '[[]]',
    '[{"code":"first"},{"code":"second"}]',
    '[{"error":"could not decode","tag":0,"metadata":{"filename":"bad.mp3"}}]',
    '[{"error":"could not decode","code":"fingerprint"}]',
    '[{}]',
    '[{"code":null}]',
    '[{"code":""}]',
    '[{"code":"   "}]',
  ]
  const exec = mock.method(childProcess, 'execFileSync', () => Buffer.alloc(0))
  try {
    for (const response of responses) {
      exec.mock.mockImplementation(() => Buffer.from(response))
      assert.throws(() => getEchoPrint('bad.mp3'))
      assert.throws(() => getEchoPrint('bad.mp3'))
    }
  } finally {
    exec.mock.restore()
  }
})
