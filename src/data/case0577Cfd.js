const sources = {
  surfacePressure: ['surface-pressure.json', 'kPa'],
  volumePressure: ['volume-pressure.json', 'kPa'],
  speed: ['volume-speed.json', 'm/s'],
  ux: ['volume-speed.json', 'm/s'],
  uy: ['volume-speed.json', 'm/s'],
  uz: ['volume-speed.json', 'm/s'],
}
const requests = new Map()

export const referenceCaseIds = ['0415', '0577', '0072']

export function loadReferenceField(caseId, field) {
  if (!referenceCaseIds.includes(caseId)) return null
  return loadPointField(caseId, `case-${caseId}`, 'reference', field)
}

export const syntheticCaseId = 'synthetic-pipe-000'

export function supportsPointField(datasetId, field) {
  return Object.hasOwn(sources, field) &&
    (datasetId !== syntheticCaseId || field !== 'volumePressure')
}

export function isSyntheticDemo(query) {
  return !query?.case || (query.demo === syntheticCaseId && !referenceCaseIds.includes(query.case))
}

export function loadSyntheticField(field) {
  if (!supportsPointField(syntheticCaseId, field)) return null
  return loadPointField(syntheticCaseId, syntheticCaseId, 'synthetic', field)
}

export async function loadReferenceRange(field) {
  const datasets = await Promise.all(referenceCaseIds.map((caseId) => loadReferenceField(caseId, field)))
  if (datasets.some((data) => !data)) return null
  return {
    min: Math.min(...datasets.map((data) => data.min)),
    max: Math.max(...datasets.map((data) => data.max)),
    unit: datasets[0].unit,
  }
}

async function loadPointField(caseId, directory, layer, field) {
  if (!Object.hasOwn(sources, field)) return null
  const [filename, unit] = sources[field]
  const base = import.meta.env?.BASE_URL ?? '/'
  const url = `${base}cfd/${directory}/${layer}/${filename}`
  if (!requests.has(url)) {
    // Publish only the exported JSON files under public/cfd. The archive stays outside the app.
    requests.set(url, fetch(url).then(async (response) => {
      if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) return null
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    }).catch((error) => {
      requests.delete(url)
      throw error
    }))
  }
  const data = await requests.get(url)
  if (!data) {
    requests.delete(url)
    return null
  }
  if (data.caseId !== caseId || data.layer !== layer || data.coordinateUnit !== 'm' || !data.source) {
    throw new Error(`Invalid ${caseId} dataset metadata`)
  }
  const series = data.fields?.[field]
  if (!series && ['ux', 'uy', 'uz'].includes(field)) return null
  const positions = data.positions
  const values = series?.values
  if (series?.unit !== unit || !Array.isArray(values) || !values.length ||
      !Array.isArray(positions) || positions.length !== values.length * 3 ||
      !positions.every(Number.isFinite) || !values.every(Number.isFinite)) {
    throw new Error(`Invalid ${caseId} samples`)
  }

  const lower = [Infinity, Infinity, Infinity]
  const upper = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i++) {
    const axis = i % 3
    lower[axis] = Math.min(lower[axis], positions[i])
    upper[axis] = Math.max(upper[axis], positions[i])
  }
  const center = lower.map((value, axis) => (value + upper[axis]) / 2)
  const span = Math.max(...upper.map((value, axis) => value - lower[axis])) || 1
  const displayPositions = Float32Array.from(positions, (value, i) => (value - center[i % 3]) * 7.4 / span)
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return { positions, displayPositions, values, unit, min, max }
}
