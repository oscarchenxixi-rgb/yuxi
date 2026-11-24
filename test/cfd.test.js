import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { loadReferenceRange, referenceCaseIds } from '../src/data/case0577Cfd.js'

const site = process.env.FLOWVIZ_TEST_SITE
const publicRoot = new URL('../public/', import.meta.url)
const pressure = { surfacePressure: 'kPa' }
const volumePressure = { volumePressure: 'kPa' }
const speed = { speed: 'm/s', ux: 'm/s', uy: 'm/s', uz: 'm/s' }

async function readDataset(path) {
  if (!site) return JSON.parse(await readFile(new URL(path, publicRoot), 'utf8'))
  const response = await fetch(new URL(path, site.endsWith('/') ? site : site + '/'), {
    signal: AbortSignal.timeout(10_000),
  })
  assert.equal(response.status, 200, path)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i, path)
  return response.json()
}

test('the three CFD cases have aligned, valid reference samples', async (t) => {
  for (const caseId of referenceCaseIds) {
    await t.test(`Case ${caseId}`, async () => {
      const prefix = `cfd/case-${caseId}/reference/`
      const [surface, volume, velocity] = await Promise.all(
        ['surface-pressure.json', 'volume-pressure.json', 'volume-speed.json'].map((name) => readDataset(prefix + name))
      )
      for (const [data, fields] of [[surface, pressure], [volume, volumePressure], [velocity, speed]]) {
        assert.equal(data.caseId, caseId)
        assert.equal(data.layer, 'reference')
        assert.equal(data.coordinateUnit, 'm')
        assert.ok(data.source)
        assert.ok(Array.isArray(data.positions) && data.positions.length && data.positions.every(Number.isFinite))
        assert.equal(data.positions.length % 3, 0)
        for (const [field, unit] of Object.entries(fields)) {
          const series = data.fields[field]
          assert.equal(series.unit, unit, field)
          assert.equal(series.values.length, data.positions.length / 3, field)
          assert.ok(series.values.every(Number.isFinite), field)
        }
      }
      assert.deepEqual(volume.positions, velocity.positions, 'volume pressure and speed must use the same points')
      const { ux, uy, uz, speed: magnitude } = velocity.fields
      for (let index = 0; index < magnitude.values.length; index++) {
        const expected = Math.hypot(ux.values[index], uy.values[index], uz.values[index])
        assert.ok(Math.abs(expected - magnitude.values[index]) <= 1e-9 * Math.max(1, expected), `speed at point ${index}`)
      }
    })
  }
})

test('the shared volume-pressure scale covers every case', { skip: Boolean(site) }, async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) =>
    new Response(await readFile(new URL(url.slice(1), publicRoot)))
  )
  const range = await loadReferenceRange('volumePressure')
  const datasets = await Promise.all(referenceCaseIds.map((caseId) =>
    readDataset(`cfd/case-${caseId}/reference/volume-pressure.json`)
  ))
  const values = datasets.flatMap((data) => data.fields.volumePressure.values)
  assert.deepEqual(range, { min: Math.min(...values), max: Math.max(...values), unit: 'kPa' })
})
