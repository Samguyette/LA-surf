/**
 * Type definitions for wave data and NOAA API responses
 */

export interface WaveDataPoint {
  id: string
  lat: number
  lng: number
  waveHeight: number // feet
  wavePeriod: number // seconds
  waveDirection: number // degrees
  windSpeed: number // knots
  waterTemp: number // fahrenheit
  qualityScore: number // 0-100 scale
  timestamp: string
}

export interface CoastlinePoint {
  lat: number
  lng: number
  name?: string
}

export interface NOAAResponse {
  table: {
    columnNames: string[]
    columnTypes: string[]
    columnUnits: string[]
    rows: Array<Array<string | number>>
  }
}

export interface WaveQualityInput {
  waveHeight: number // feet
  wavePeriod: number // seconds
  windSpeed: number // knots
  waveDirection: number // degrees (optional)
}

export interface WaveDataAPIResponse {
  data: WaveDataPoint[]
  cached: boolean
  stale?: boolean
  error?: string
  timestamp: string
}

export type WaveQualityLevel = 'poor' | 'fair' | 'good' | 'excellent'

export interface WaveQualityConfig {
  weights: {
    waveHeight: number
    wavePeriod: number
    windSpeed: number
  }
  optimal: {
    minWaveHeight: number // feet
    maxWaveHeight: number // feet
    minWavePeriod: number // seconds
    maxWavePeriod: number // seconds
    maxWindSpeed: number // knots
  }
}
