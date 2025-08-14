import { NextRequest, NextResponse } from 'next/server'
import NodeCache from 'node-cache'
import { WaveDataPoint, OpenMeteoResponse, NOAATideResponse } from '@/types/wave-data'
import { calculateWaveQuality, getLocationFactor } from '@/utils/waveQuality'
import { LA_COASTLINE_POINTS, isInMarinaExclusionZone } from '@/data/coastline'
import { SECTION_CHARACTERISTICS } from '@/data/sections'
import { COASTLINE_SECTIONS, CoastlineSection } from '@/data/coastlineSections'

// Force this route to be dynamic and not cached by Next.js
export const dynamic = 'force-dynamic'
export const revalidate = 0

// 10-minute server-side cache to balance freshness with API efficiency
const cache = new NodeCache({ stdTTL: 600 })

const OPEN_METEO_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const OPEN_METEO_LATITUDES = [
  33.70, 33.78, 33.86, 33.94, 34.02, 34.10, 34.18, 34.26, 34.34, 34.42
] as const
const OPEN_METEO_LONGITUDES = [
  -119.30, -119.05, -118.80, -118.55, -118.30, -118.05, -117.80, -117.95, -118.15, -118.40
] as const

// NOAA tide station IDs for LA County
const NOAA_STATIONS = {
  'Los Angeles': '9410660', // Los Angeles (Outer Harbor)
  'Long Beach': '9411340', // Long Beach (Terminal Island)
  'Santa Monica': '9410840', // Santa Monica
  'Redondo Beach': '9410660', // Use LA station for now
} as const

/**
 * Open-Meteo Weather API Route
 * 
 * This route fetches both wave and wind data from Open-Meteo's free APIs.
 * 
 * APIs Used:
 * 1. Marine Weather API (https://open-meteo.com/en/docs/marine-weather-api)
 *    Variables: wave_height, wave_period, wave_direction, swell_wave_height, 
 *              swell_wave_period, swell_wave_direction, sea_surface_temperature
 * 
 * 2. Forecast API (https://open-meteo.com/en/docs)
 *    Variables: wind_speed_10m (knots), wind_direction_10m (degrees), temperature_2m
 * 
 * Enhanced Features:
 * - Real-time wind data integration for accurate surf quality assessment
 * - Wind direction analysis (offshore vs onshore) significantly impacts scoring
 * - Wind conditions now carry 35% weight in quality calculation
 * - Parallel API calls for optimal performance
 * 
 * The data is cached server-side to improve performance and reduce API calls.
 * Cache duration: 10 minutes to balance data freshness with API responsiveness.
 */

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = 'wave-data'
    const cachedEntry = cache.get(cacheKey) as { data: WaveDataPoint[], timestamp: string, fetchTime: number, measurementTime?: string | null } | undefined
    
    if (cachedEntry) {
      const cacheAge = Date.now() - cachedEntry.fetchTime
      const remainingTTL = Math.max(0, 600000 - cacheAge) // 10 minutes in ms
      
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Returning cached data, TTL remaining: ${Math.round(remainingTTL / 1000)}s`)
      }
      
      return NextResponse.json({
        data: cachedEntry.data,
        cached: true,
        timestamp: cachedEntry.timestamp,
        measurementTime: cachedEntry.measurementTime,
        cacheAge: Math.round(cacheAge / 1000),
        nextRefresh: new Date(cachedEntry.fetchTime + 600000).toISOString()
      }, {
        headers: {
          'Cache-Control': `public, max-age=${Math.round(remainingTTL / 1000)}, s-maxage=${Math.round(remainingTTL / 1000)}`,
          'X-Cache-Status': 'HIT',
          'X-Cache-Remaining-TTL': remainingTTL.toString()
        }
      })
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Cache miss - fetching fresh wave data from Open-Meteo...')
    }
    
    // Fetch fresh data from Open-Meteo and NOAA
    const [{ waveData, windData }, tideData] = await Promise.all([
      fetchOpenMeteoWaveData(),
      fetchNOAATideData()
    ])
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Received data from ${waveData.length} wave stations and ${windData.length} wind stations`)
    }
    
    // Process and interpolate data for LA coastline points
    const processedData = await processWaveDataForCoastline(waveData, windData, tideData)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Processed ${processedData.length} coastline points`)
    }
    
    // Find the earliest measurement time across all data points
    const earliestMeasurementTime = processedData.reduce((earliest, point) => {
      if (!earliest || new Date(point.measurementTime) < new Date(earliest)) {
        return point.measurementTime
      }
      return earliest
    }, null as string | null)
    
    // Cache the fresh data with metadata
    const fetchTime = Date.now()
    const timestamp = new Date(fetchTime).toISOString()
    cache.set(cacheKey, {
      data: processedData,
      timestamp,
      fetchTime,
      measurementTime: earliestMeasurementTime
    })
    
    return NextResponse.json({
      data: processedData,
      cached: false,
      timestamp,
      measurementTime: earliestMeasurementTime,
      cacheAge: 0,
      nextRefresh: new Date(fetchTime + 600000).toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=600, s-maxage=600',
        'X-Cache-Status': 'MISS',
        'X-Cache-Remaining-TTL': '600000'
      }
    })
    
  } catch (error) {
    console.error('Error fetching wave data:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Try to return stale cached data if available
    const staleEntry = cache.get('wave-data') as { data: WaveDataPoint[], timestamp: string, fetchTime: number, measurementTime?: string | null } | undefined
    if (staleEntry) {
      const cacheAge = Date.now() - staleEntry.fetchTime
      console.log('Returning stale cached data due to API error')
      
      return NextResponse.json({
        data: staleEntry.data,
        cached: true,
        stale: true,
        error: 'Using cached data due to API error',
        timestamp: staleEntry.timestamp,
        measurementTime: staleEntry.measurementTime,
        cacheAge: Math.round(cacheAge / 1000),
        nextRefresh: new Date(Date.now() + 60000).toISOString() // Retry in 1 minute
      }, {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
          'X-Cache-Status': 'STALE',
          'X-Error': 'API-Error'
        }
      })
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch wave data' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    )
  }
}

async function fetchOpenMeteoWaveData(): Promise<{ waveData: OpenMeteoResponse[]; windData: OpenMeteoResponse[] }> {
  try {
    const { waveResponse, windResponse } = await tryOpenMeteoEndpoint()
    
    const [waveData, windData] = await Promise.all([
      waveResponse.json(),
      windResponse.json()
    ])
    
    // Open-Meteo returns an array of station data
    const normalizedWaveData = Array.isArray(waveData) ? waveData : [waveData]
    const normalizedWindData = Array.isArray(windData) ? windData : [windData]
    
    return { 
      waveData: normalizedWaveData, 
      windData: normalizedWindData 
    }
  } catch (error) {
    console.error('Open-Meteo API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to fetch wave and wind data from Open-Meteo: ${errorMessage}`)
  }
}

async function tryOpenMeteoEndpoint(): Promise<{ waveResponse: Response; windResponse: Response }> {
  // Define high-resolution LA County coastline coordinate grid
  // Optimized for 10 lats x 10 lons = 100 coordinates (max tested limit)
  // This provides much better resolution than the original 8x8 = 64 coordinates
  const latitudes = OPEN_METEO_LATITUDES
  const longitudes = OPEN_METEO_LONGITUDES
  
  // Build the marine API URL for wave data
  const marineBaseUrl = OPEN_METEO_BASE
  const marineParams = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    current: 'wave_height,wave_direction,wave_period,sea_surface_temperature',
    hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature',
    forecast_days: '1',
    timezone: 'America/Los_Angeles',
    temperature_unit: 'fahrenheit' // Get sea surface temperature in Fahrenheit
  })
  
  // Build the forecast API URL for wind and temperature data  
  const forecastBaseUrl = 'https://api.open-meteo.com/v1/forecast'
  const windParams = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    current: 'wind_speed_10m,wind_direction_10m,temperature_2m',
    hourly: 'wind_speed_10m,wind_direction_10m,temperature_2m',
    forecast_days: '1',
    timezone: 'America/Los_Angeles',
    wind_speed_unit: 'kn', // Get wind speed in knots directly
    temperature_unit: 'fahrenheit' // Get temperature in Fahrenheit
  })
  
  const waveEndpoint = `${marineBaseUrl}?${marineParams.toString()}`
  const windEndpoint = `${forecastBaseUrl}?${windParams.toString()}`
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Fetching wave and wind data from Open-Meteo APIs...`)
  }
  
  // Fetch both wave and wind data in parallel
  const [waveResponse, windResponse] = await Promise.all([
    fetch(waveEndpoint, {
      headers: {
        'User-Agent': 'LA-Surf-App/1.0',
      },
      signal: AbortSignal.timeout(10000)
    }),
    fetch(windEndpoint, {
      headers: {
        'User-Agent': 'LA-Surf-App/1.0',
      },
      signal: AbortSignal.timeout(10000)
    })
  ])
  
  if (!waveResponse.ok) {
    throw new Error(`Marine API HTTP ${waveResponse.status}: ${waveResponse.statusText}`)
  }
  
  if (!windResponse.ok) {
    throw new Error(`Forecast API HTTP ${windResponse.status}: ${windResponse.statusText}`)
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Successfully fetched wave and wind data from Open-Meteo`)
  }
  
  return { waveResponse, windResponse }
}

async function fetchNOAATideData(): Promise<Map<string, { height: number; trend: 'rising' | 'falling' }>> {
  const tideData = new Map<string, { height: number; trend: 'rising' | 'falling' }>()
  
  try {
    // Fetch tide data for all LA stations
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, '')
    
    const promises = Object.entries(NOAA_STATIONS).map(async ([locationName, stationId]) => {
      try {
        const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?` +
          `date=today&station=${stationId}&product=water_level&datum=MLLW&` +
          `time_zone=lst_ldt&units=english&format=json&application=LA-Surf-App`
        
        const response = await fetch(url, {
          headers: { 'User-Agent': 'LA-Surf-App/1.0' },
          signal: AbortSignal.timeout(8000)
        })
        
        if (!response.ok) {
          console.warn(`Failed to fetch tide data for ${locationName}: ${response.statusText}`)
          return
        }
        
        const data = await response.json() as NOAATideResponse
        
        if (!data.data || data.data.length < 2) {
          console.warn(`Insufficient tide data for ${locationName}`)
          return
        }
        
        // Get the two most recent tide measurements to determine trend
        const recent = data.data.slice(-2)
        const currentHeight = parseFloat(recent[1].v)
        const previousHeight = parseFloat(recent[0].v)
        
        const trend: 'rising' | 'falling' = currentHeight > previousHeight ? 'rising' : 'falling'
        
        tideData.set(locationName, {
          height: currentHeight,
          trend
        })
        
      } catch (error) {
        console.warn(`Error fetching tide data for ${locationName}:`, error)
      }
    })
    
    await Promise.all(promises)
    
  } catch (error) {
    console.error('Error fetching NOAA tide data:', error)
  }
  
  return tideData
}

async function processWaveDataForCoastline(
  waveData: OpenMeteoResponse[], 
  windData: OpenMeteoResponse[], 
  tideData: Map<string, { height: number; trend: 'rising' | 'falling' }>
): Promise<WaveDataPoint[]> {
  const coastlineData: WaveDataPoint[] = []
  
  for (const section of COASTLINE_SECTIONS) {
    const sectionData = processSectionWaveData(waveData, windData, section, tideData)
    coastlineData.push(...sectionData)
  }
  
  return coastlineData
}



function processSectionWaveData(
  waveData: OpenMeteoResponse[], 
  windData: OpenMeteoResponse[],
  section: CoastlineSection,
  tideData: Map<string, { height: number; trend: 'rising' | 'falling' }>
): WaveDataPoint[] {
  if (!waveData || waveData.length === 0) {
    throw new Error('No wave data available from Open-Meteo')
  }
  
  if (!windData || windData.length === 0) {
    throw new Error('No wind data available from Open-Meteo')
  }
  
  // Filter wave data to this section's geographic bounds
  const sectionWaveStations = waveData.filter((station: OpenMeteoResponse) => {
    return (
      station.latitude >= section.bounds.south &&
      station.latitude <= section.bounds.north &&
      station.longitude >= section.bounds.west &&
      station.longitude <= section.bounds.east
    )
  })
  
  // Filter wind data to this section's geographic bounds
  const sectionWindStations = windData.filter((station: OpenMeteoResponse) => {
    return (
      station.latitude >= section.bounds.south &&
      station.latitude <= section.bounds.north &&
      station.longitude >= section.bounds.west &&
      station.longitude <= section.bounds.east
    )
  })
  
  // If no specific data for this section, use all available stations
  const waveStationsToUse = sectionWaveStations.length > 0 ? sectionWaveStations : waveData
  const windStationsToUse = sectionWindStations.length > 0 ? sectionWindStations : windData
  
  // Add some realistic regional variation based on section characteristics
  const sectionMultipliers = getSectionCharacteristics(section.name)
  
  return section.points
    .filter(point => !isInMarinaExclusionZone(point.lat, point.lng)) // Exclude marina entrance points
    .map((point, index) => {
    // Find multiple nearby wave stations and weight them by distance
    const nearbyWaveStations = waveStationsToUse
      .map((station: OpenMeteoResponse) => {
        const distance = Math.sqrt(
          Math.pow(station.latitude - point.lat, 2) + Math.pow(station.longitude - point.lng, 2)
        )
        return { station, distance }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3) // Use top 3 nearest stations
    
    // Find multiple nearby wind stations and weight them by distance
    const nearbyWindStations = windStationsToUse
      .map((station: OpenMeteoResponse) => {
        const distance = Math.sqrt(
          Math.pow(station.latitude - point.lat, 2) + Math.pow(station.longitude - point.lng, 2)
        )
        return { station, distance }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3) // Use top 3 nearest stations
    
    if (nearbyWaveStations.length === 0) {
      throw new Error('No nearby wave stations found')
    }
    
    if (nearbyWindStations.length === 0) {
      throw new Error('No nearby wind stations found')
    }
    
    // Average the nearby wave station data using inverse distance weighting
    let waveWeight = 0
    let weightedHeight = 0, weightedPeriod = 0, weightedDirection = 0
    let weightedSwellHeight = 0, weightedSwellPeriod = 0, weightedWaterTemp = 0
    let avgHeight = 0, avgPeriod = 0, avgDirection = 0
    let avgSwellHeight = 0, avgSwellPeriod = 0, avgWaterTemp = 0
    let earliestWaveMeasurementTime: string | null = null
    
    for (const { station, distance } of nearbyWaveStations) {
      const weight = 1 / (distance + 0.01) // Inverse distance weighting
      
      // Use current data if available, otherwise use latest hourly data with actual values
      let currentHeight = station.current.wave_height ?? null
      let currentPeriod = station.current.wave_period ?? null
      let currentDirection = station.current.wave_direction ?? null
      let currentWaterTemp = station.current.sea_surface_temperature ?? null
      let measurementTime = station.current.time // Start with current time
      
      // If current data is null, try to use hourly data
      if (currentHeight === null || currentPeriod === null || currentDirection === null) {
        // Short comment: use helper to get first non-null triple for readability
        const idx = findFirstNonNullTripletIndex(
          station.hourly.wave_height || [],
          station.hourly.wave_period || [],
          station.hourly.wave_direction || []
        )
        if (idx !== -1) {
          currentHeight = station.hourly.wave_height?.[idx] ?? null
          currentPeriod = station.hourly.wave_period?.[idx] ?? null
          currentDirection = station.hourly.wave_direction?.[idx] ?? null
          // Use the timestamp from the hourly data if we're using hourly data
          measurementTime = station.hourly.time?.[idx] || station.current.time
        }
      }
      
      // Get water temperature from current or hourly data
      if (currentWaterTemp === null) {
        const waterTempIdx = findFirstNonNullIndex(station.hourly.sea_surface_temperature || [])
        if (waterTempIdx !== -1) {
          currentWaterTemp = station.hourly.sea_surface_temperature?.[waterTempIdx] ?? null
        }
      }
      
      if (currentHeight !== null && currentPeriod !== null && currentDirection !== null) {
        weightedHeight += currentHeight * weight
        weightedPeriod += currentPeriod * weight
        weightedDirection += currentDirection * weight
        
        // Track the earliest measurement time
        if (earliestWaveMeasurementTime === null || new Date(measurementTime) < new Date(earliestWaveMeasurementTime)) {
          earliestWaveMeasurementTime = measurementTime
        }
        
        // Add water temperature to weighted average if available
        if (currentWaterTemp !== null) {
          weightedWaterTemp += currentWaterTemp * weight
        }
        
        // Get swell data from hourly (use first non-null values)
        let swellHeight = null, swellPeriod = null
        const swellIdx = findFirstNonNullPairIndex(
          station.hourly.swell_wave_height || [],
          station.hourly.swell_wave_period || []
        )
        if (swellIdx !== -1) {
          swellHeight = station.hourly.swell_wave_height?.[swellIdx] || null
          swellPeriod = station.hourly.swell_wave_period?.[swellIdx] || null
        }
        
        if (swellHeight !== null && swellPeriod !== null) {
          weightedSwellHeight += swellHeight * weight
          weightedSwellPeriod += swellPeriod * weight
        }
        
        waveWeight += weight
      }
    }
    
    // Average the nearby wind station data using inverse distance weighting  
    let windWeight = 0
    let weightedWindSpeed = 0, weightedWindDirection = 0, weightedAirTemp = 0
    let avgWindSpeed = 0, avgWindDirection = 0, avgAirTemp = 0
    let earliestWindMeasurementTime: string | null = null
    
    for (const { station, distance } of nearbyWindStations) {
      const weight = 1 / (distance + 0.01) // Inverse distance weighting
      
      // Use current data if available, otherwise use latest hourly data
      let currentWindSpeed = station.current.wind_speed_10m ?? null
      let currentWindDirection = station.current.wind_direction_10m ?? null
      let currentAirTemp = station.current.temperature_2m ?? null
      let windMeasurementTime = station.current.time // Start with current time
      
      // If current data is null, try to use hourly data
      if (currentWindSpeed === null || currentWindDirection === null || currentAirTemp === null) {
        const idx = findFirstNonNullTripletIndex(
          station.hourly.wind_speed_10m || [],
          station.hourly.wind_direction_10m || [],
          station.hourly.temperature_2m || []
        )
        if (idx !== -1) {
          currentWindSpeed = currentWindSpeed ?? station.hourly.wind_speed_10m?.[idx] ?? null
          currentWindDirection = currentWindDirection ?? station.hourly.wind_direction_10m?.[idx] ?? null
          currentAirTemp = currentAirTemp ?? station.hourly.temperature_2m?.[idx] ?? null
          // Use the timestamp from the hourly data if we're using hourly data
          windMeasurementTime = station.hourly.time?.[idx] || station.current.time
        }
      }
      
      if (currentWindSpeed !== null && currentWindDirection !== null) {
        weightedWindSpeed += currentWindSpeed * weight
        weightedWindDirection += currentWindDirection * weight
        
        // Track the earliest wind measurement time
        if (earliestWindMeasurementTime === null || new Date(windMeasurementTime) < new Date(earliestWindMeasurementTime)) {
          earliestWindMeasurementTime = windMeasurementTime
        }
        
        if (currentAirTemp !== null) {
          weightedAirTemp += currentAirTemp * weight
        }
        
        windWeight += weight
      }
    }
    
    if (waveWeight === 0) {
      // If no valid wave data found, use a reasonable default based on location and season
      console.warn(`No valid wave data for point ${point.lat}, ${point.lng}, using defaults`)
      const fallbackHeight = 1.0 + Math.random() * 0.5 // 1.0-1.5 meters
      const fallbackPeriod = 10 + Math.random() * 3 // 10-13 seconds  
      const fallbackDirection = 250 + Math.random() * 20 // SW to W
      
      avgHeight = fallbackHeight
      avgPeriod = fallbackPeriod
      avgDirection = fallbackDirection
      avgSwellHeight = fallbackHeight * 0.7
      avgSwellPeriod = fallbackPeriod + 2
      avgWaterTemp = 62 // Fallback to typical LA water temperature in Fahrenheit
    } else {
      // Calculate weighted averages for wave data
      avgHeight = weightedHeight / waveWeight
      avgPeriod = weightedPeriod / waveWeight
      avgDirection = weightedDirection / waveWeight
      avgSwellHeight = weightedSwellHeight / waveWeight
      avgSwellPeriod = weightedSwellPeriod / waveWeight
      avgWaterTemp = weightedWaterTemp / waveWeight
    }
    
    if (windWeight === 0) {
      // If no valid wind data found, use a reasonable default
      console.warn(`No valid wind data for point ${point.lat}, ${point.lng}, using defaults`)
      avgWindSpeed = 8 + Math.random() * 6 // 8-14 knots (already in knots from API)
      avgWindDirection = 280 + Math.random() * 40 // Generally westerly for LA
      avgAirTemp = 68 // Fallback to typical LA air temperature in Fahrenheit
    } else {
      // Calculate weighted averages for wind and air temperature data
      avgWindSpeed = weightedWindSpeed / windWeight
      avgWindDirection = weightedWindDirection / windWeight
      avgAirTemp = weightedAirTemp / windWeight
    }
    
    // Apply section-specific characteristics
    const finalHeight = Math.max(0.3, Math.min(3.0, avgHeight * sectionMultipliers.heightMultiplier))
    const finalPeriod = Math.max(6, Math.min(20, avgPeriod * sectionMultipliers.periodMultiplier))
    const finalDirection = avgDirection + sectionMultipliers.directionOffset
    
    // Apply section-specific wind characteristics (wind data is already in knots from API)
    const finalWindSpeed = Math.max(0, Math.min(35, avgWindSpeed + sectionMultipliers.windOffset))
    const finalWindDirection = avgWindDirection
    
    // Convert units (Open-Meteo uses meters, we want feet for display)
    const waveHeightFeet = Math.max(0.5, Math.min(15, finalHeight * 3.28084))
    const wavePeriodSeconds = Math.max(5, Math.min(25, finalPeriod))
    const windSpeedKnots = Math.max(0, Math.min(30, finalWindSpeed))
    
    // Get location factor for this section
    const locationFactor = getLocationFactor(section.name)
    
    // Calculate wave quality score with location factor
    const qualityScore = calculateWaveQuality({
      waveHeight: waveHeightFeet,
      wavePeriod: wavePeriodSeconds,
      windSpeed: windSpeedKnots,
      waveDirection: finalDirection,
      windDirection: finalWindDirection
    }, locationFactor)
    
    // Use real water temperature from API with validation
    // Ensure water temperature is reasonable for LA (50-80°F typical range)
    const waterTempF = avgWaterTemp > 0 && avgWaterTemp >= 45 && avgWaterTemp <= 85 
      ? avgWaterTemp 
      : 62 // Default to typical LA water temperature if invalid
    
    // Ensure air temperature is reasonable for LA (40-100°F typical range)  
    const airTempF = avgAirTemp > 0 && avgAirTemp >= 35 && avgAirTemp <= 110
      ? avgAirTemp
      : 68 // Default to typical LA air temperature if invalid
    
    // Get tide data for this section - use nearest tide station
    let tideHeight = 2.5 // Default tide height in feet
    let tideTrend: 'rising' | 'falling' = 'rising'
    
    // Find the best tide station for this section
    const sectionTideData = tideData.get(section.name) || 
                           tideData.get('Los Angeles') || 
                           Array.from(tideData.values())[0]
    
    if (sectionTideData) {
      tideHeight = sectionTideData.height
      tideTrend = sectionTideData.trend
    }
    
    // Determine the earliest measurement time from all sources
    let overallEarliestTime = earliestWaveMeasurementTime
    if (earliestWindMeasurementTime && (!overallEarliestTime || new Date(earliestWindMeasurementTime) < new Date(overallEarliestTime))) {
      overallEarliestTime = earliestWindMeasurementTime
    }
    
    // If we have tide data, check its timestamp too
    if (sectionTideData && Array.from(tideData.values()).length > 0) {
      // NOAA tide data timestamps are in the format we need, but we'd need to access the original data
      // For now, we'll use the wave/wind timestamps as they're more comprehensive
    }
    
    return {
      id: `${section.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      lat: point.lat,
      lng: point.lng,
      waveHeight: Math.round(waveHeightFeet * 10) / 10,
      wavePeriod: Math.round(wavePeriodSeconds * 10) / 10,
      waveDirection: Math.round(finalDirection),
      windSpeed: Math.round(windSpeedKnots * 10) / 10,
      waterTemp: Math.round(waterTempF * 10) / 10,
      airTemp: Math.round(airTempF * 10) / 10,
      tideHeight: Math.round(tideHeight * 10) / 10,
      tideTrend,
      qualityScore,
      timestamp: new Date().toISOString(),
      measurementTime: overallEarliestTime || new Date().toISOString() // Fallback to current time if no measurement time available
    }
  })
}

// helpers to find the first index where multiple arrays have non-null values at same position
function findFirstNonNullTripletIndex(a: (number|null)[], b: (number|null)[], c: (number|null)[]): number {
  const len = Math.min(a.length, b.length, c.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== null && b[i] !== null && c[i] !== null) return i
  }
  return -1
}

function findFirstNonNullPairIndex(a: (number|null)[], b: (number|null)[]): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== null && b[i] !== null) return i
  }
  return -1
}

function findFirstNonNullIndex(a: (number|null)[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== null) return i
  }
  return -1
}

function getSectionCharacteristics(sectionName: string) {
  return SECTION_CHARACTERISTICS[sectionName] ?? {
    heightMultiplier: 1.0,
    periodMultiplier: 1.0,
    directionOffset: 0,
    windOffset: 0
  }
}
