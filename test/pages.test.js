import assert from 'node:assert/strict'
import { test } from 'node:test'
import { legacyPagesLocation } from '../src/router/pagesLocation.js'

test('Pages keeps the legacy route and query in shared links', () => {
  const base = '/yuxi/'
  assert.equal(legacyPagesLocation(new URL('https://example.org/yuxi/cases/0577'), base), '/yuxi/#/cases/0577')
  assert.equal(
    legacyPagesLocation(new URL('https://example.org/yuxi/visualization?case=0577#data'), base),
    '/yuxi/#/visualization?case=0577#data'
  )
  assert.equal(legacyPagesLocation(new URL('https://example.org/yuxi/#/cases/0577'), base), null)
  assert.equal(legacyPagesLocation(new URL('https://example.org/yuxi/'), base), null)
})

const site = process.env.FLOWVIZ_TEST_SITE
test('the published Pages entry and its assets respond successfully', { skip: !site }, async () => {
  const options = { signal: AbortSignal.timeout(20_000) }
  const response = await fetch(site, options)
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /id="app"/)

  const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((match) => match[1])
  assert.ok(assets.some((path) => path.endsWith('.js')), 'Pages must serve a production build')
  await Promise.all(assets.map(async (path) => {
    const asset = await fetch(new URL(path, response.url), options)
    assert.equal(asset.status, 200, path)
    assert.doesNotMatch(asset.headers.get('content-type') ?? '', /text\/html/i, path)
    await asset.body.cancel()
  }))
})
