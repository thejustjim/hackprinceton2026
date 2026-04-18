export interface LatLng {
  lat: number
  lng: number
}

export const COUNTRY_CENTROIDS: Record<string, LatLng> = {
  AR: { lat: -38.4161, lng: -63.6167 },
  AT: { lat: 47.5162, lng: 14.5501 },
  AU: { lat: -25.2744, lng: 133.7751 },
  BD: { lat: 23.685, lng: 90.3563 },
  BE: { lat: 50.5039, lng: 4.4699 },
  BR: { lat: -14.235, lng: -51.9253 },
  CA: { lat: 56.1304, lng: -106.3468 },
  CH: { lat: 46.8182, lng: 8.2275 },
  CL: { lat: -35.6751, lng: -71.543 },
  CN: { lat: 35.8617, lng: 104.1954 },
  CZ: { lat: 49.8175, lng: 15.473 },
  DE: { lat: 51.1657, lng: 10.4515 },
  DK: { lat: 56.2639, lng: 9.5018 },
  EG: { lat: 26.8206, lng: 30.8025 },
  ES: { lat: 40.4637, lng: -3.7492 },
  ET: { lat: 9.145, lng: 40.4897 },
  FI: { lat: 61.9241, lng: 25.7482 },
  FR: { lat: 46.2276, lng: 2.2137 },
  GB: { lat: 55.3781, lng: -3.436 },
  GR: { lat: 39.0742, lng: 21.8243 },
  HU: { lat: 47.1625, lng: 19.5033 },
  ID: { lat: -0.7893, lng: 113.9213 },
  IE: { lat: 53.1424, lng: -7.6921 },
  IL: { lat: 31.0461, lng: 34.8516 },
  IN: { lat: 20.5937, lng: 78.9629 },
  IT: { lat: 41.8719, lng: 12.5674 },
  JP: { lat: 36.2048, lng: 138.2529 },
  KE: { lat: -0.0236, lng: 37.9062 },
  KR: { lat: 35.9078, lng: 127.7669 },
  MA: { lat: 31.7917, lng: -7.0926 },
  MX: { lat: 23.6345, lng: -102.5528 },
  MY: { lat: 4.2105, lng: 101.9758 },
  NG: { lat: 9.082, lng: 8.6753 },
  NL: { lat: 52.1326, lng: 5.2913 },
  NO: { lat: 60.472, lng: 8.4689 },
  NZ: { lat: -40.9006, lng: 174.886 },
  PE: { lat: -9.19, lng: -75.0152 },
  PH: { lat: 12.8797, lng: 121.774 },
  PL: { lat: 51.9194, lng: 19.1451 },
  PT: { lat: 39.3999, lng: -8.2245 },
  RO: { lat: 45.9432, lng: 24.9668 },
  RU: { lat: 61.524, lng: 105.3188 },
  SE: { lat: 60.1282, lng: 18.6435 },
  TH: { lat: 15.87, lng: 100.9925 },
  TR: { lat: 38.9637, lng: 35.2433 },
  TW: { lat: 23.6978, lng: 120.9605 },
  UA: { lat: 48.3794, lng: 31.1656 },
  US: { lat: 37.0902, lng: -95.7129 },
  VN: { lat: 14.0583, lng: 108.2772 },
  ZA: { lat: -30.5595, lng: 22.9375 },
}

export function getCountryCentroid(countryCode: string): LatLng {
  const code = countryCode.trim().toUpperCase()
  const centroid = COUNTRY_CENTROIDS[code]
  if (!centroid) {
    if (typeof console !== "undefined") {
      console.warn(
        `[country-coords] No centroid for ISO-2 "${code}"; falling back to {0, 0}`
      )
    }
    return { lat: 0, lng: 0 }
  }
  return centroid
}
