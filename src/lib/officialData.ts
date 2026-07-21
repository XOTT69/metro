import { officialStationsEndpoint } from '../data/metro'
import type { Station } from '../types'

interface GeoJsonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: { name?: string; name_eng?: string; code1?: string }
}

interface GeoJsonResponse {
  features?: GeoJsonFeature[]
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’'«»\".]/g, '')
    .replace(/площа українських героїв/g, 'площа українських героїв')
    .replace(/\s+/g, ' ')
    .trim()

export const mergeOfficialCoordinates = async (source: Station[], signal?: AbortSignal) => {
  const response = await fetch(officialStationsEndpoint, { signal })
  if (!response.ok) throw new Error(`Official API: ${response.status}`)
  const payload = (await response.json()) as GeoJsonResponse
  const features = payload.features ?? []
  if (!features.length) throw new Error('Official API returned no stations')

  const byName = new Map(
    features
      .filter((feature) => feature.properties?.name && feature.geometry?.coordinates)
      .map((feature) => [normalize(feature.properties?.name ?? ''), feature]),
  )

  return source.map((station) => {
    const feature = byName.get(normalize(station.name))
    const coordinates = feature?.geometry?.coordinates
    return coordinates
      ? { ...station, lng: Number(coordinates[0]), lat: Number(coordinates[1]) }
      : station
  })
}
