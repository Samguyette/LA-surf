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

export interface OpenMeteoResponse {
  latitude: number
  longitude: number
  current: {
    time: string
    wave_height: number | null
    wave_direction: number | null
    wave_period: number | null
  }
  hourly: {
    time: string[]
    wave_height: (number | null)[]
    wave_direction: (number | null)[]
    wave_period: (number | null)[]
    swell_wave_height: (number | null)[]
    swell_wave_direction: (number | null)[]
    swell_wave_period: (number | null)[]
  }
}

// Legacy NOAA interface kept for reference
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
  // Short comment: direction is not used in scoring today; mark optional to match usage
  waveDirection?: number // degrees (optional)
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
    locationFactor?: number // optional location quality modifier
  }
  optimal: {
    minWaveHeight: number // feet
    maxWaveHeight: number // feet
    minWavePeriod: number // seconds
    maxWavePeriod: number // seconds
    maxWindSpeed: number // knots
  }
}
