import { NextRequest, NextResponse } from 'next/server'
// Short comment: temporarily disabling server-side cache to ensure always-fresh data
// import NodeCache from 'node-cache'
import { WaveDataPoint, OpenMeteoResponse } from '@/types/wave-data'
import { calculateWaveQuality, getLocationFactor } from '@/utils/waveQuality'
import { LA_COASTLINE_POINTS, isInMarinaExclusionZone } from '@/data/coastline'
import { SECTION_CHARACTERISTICS } from '@/data/sections'
import { COASTLINE_SECTIONS, CoastlineSection } from '@/data/coastlineSections'

// Short comment: commenting out in-memory cache instance for now
// const cache = new NodeCache({ stdTTL: 1200 })

const OPEN_METEO_BASE = 'https://marine-api.open-meteo.com/v1/marine'
const OPEN_METEO_LATITUDES = [
  33.70, 33.78, 33.86, 33.94, 34.02, 34.10, 34.18, 34.26, 34.34, 34.42
] as const
const OPEN_METEO_LONGITUDES = [
  -119.30, -119.05, -118.80, -118.55, -118.30, -118.05, -117.80, -117.95, -118.15, -118.40
] as const

/**
 * Open-Meteo Marine Weather API Route
 * 
 * This route fetches wave data from Open-Meteo's free marine weather API.
 * 
 * API: Open-Meteo Marine Weather API (https://open-meteo.com/en/docs/marine-weather-api)
 * Variables used:
 * - wave_height: Significant wave height (meters)
 * - wave_period: Peak wave period (seconds) 
 * - wave_direction: Peak wave direction (degrees)
 * - swell_wave_height: Swell wave height (meters)
 * - swell_wave_period: Swell wave period (seconds)
 * - swell_wave_direction: Swell wave direction (degrees)
 * 
 * The data is cached server-side to improve performance and reduce API calls.
 * Cache duration: 20 minutes to balance data freshness with API responsiveness.
 */

export async function GET(request: NextRequest) {
  try {
    // Short comment: caching disabled; always fetch fresh data
    // const cachedData = cache.get('wave-data') as WaveDataPoint[] | undefined
    // if (cachedData) {
    //   return NextResponse.json({
    //     data: cachedData,
    //     cached: true,
    //     timestamp: new Date().toISOString()
    //   })
    // }

    if (process.env.NODE_ENV !== 'production') {
      console.log('Fetching fresh wave data from Open-Meteo...')
    }
    
    // Fetch fresh data from Open-Meteo
    const waveData = await fetchOpenMeteoWaveData()
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Received data from ${waveData.length} stations`)
    }
    
    // Process and interpolate data for LA coastline points
    const processedData = await processWaveDataForCoastline(waveData)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Processed ${processedData.length} coastline points`)
    }
    
    // Short comment: caching disabled; do not write to cache
    // cache.set('wave-data', processedData)
    
    return NextResponse.json({
      data: processedData,
      cached: false,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error fetching wave data:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Short comment: caching disabled; do not return stale cached data
    // const staleData = cache.get('wave-data') as WaveDataPoint[] | undefined
    // if (staleData) {
    //   return NextResponse.json({
    //     data: staleData,
    //     cached: true,
    //     stale: true,
    //     error: 'Using cached data due to API error',
    //     timestamp: new Date().toISOString()
    //   })
    // }
    
    return NextResponse.json(
      { error: 'Failed to fetch wave data' },
      { status: 500 }
    )
  }
}

async function fetchOpenMeteoWaveData(): Promise<OpenMeteoResponse[]> {
  try {
    const response = await tryOpenMeteoEndpoint()
    const data = await response.json()
    // Open-Meteo returns an array of station data
    return Array.isArray(data) ? data : [data]
  } catch (error) {
    console.error('Open-Meteo API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to fetch wave data from Open-Meteo: ${errorMessage}`)
  }
}

async function tryOpenMeteoEndpoint(): Promise<Response> {
  // Define high-resolution LA County coastline coordinate grid
  // Optimized for 10 lats x 10 lons = 100 coordinates (max tested limit)
  // This provides much better resolution than the original 8x8 = 64 coordinates
  const latitudes = OPEN_METEO_LATITUDES
  const longitudes = OPEN_METEO_LONGITUDES
  
  // Build the API URL with multiple coordinates for single call
  const baseUrl = OPEN_METEO_BASE
  const params = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    current: 'wave_height,wave_direction,wave_period',
    hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period',
    forecast_days: '1',
    timezone: 'America/Los_Angeles'
  })
  
  const endpoint = `${baseUrl}?${params.toString()}`
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Fetching wave data from Open-Meteo API...`)
  }
  
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'LA-Surf-App/1.0',
    },
    signal: AbortSignal.timeout(10000)
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Successfully fetched wave data from Open-Meteo`)
  }
  return response
}

async function processWaveDataForCoastline(openMeteoData: OpenMeteoResponse[]): Promise<WaveDataPoint[]> {
  const coastlineData: WaveDataPoint[] = []
  
  for (const section of COASTLINE_SECTIONS) {
    const sectionData = processSectionWaveData(openMeteoData, section)
    coastlineData.push(...sectionData)
  }
  
  return coastlineData
}



function processSectionWaveData(
  openMeteoData: OpenMeteoResponse[], 
  section: CoastlineSection
): WaveDataPoint[] {
  if (!openMeteoData || openMeteoData.length === 0) {
    throw new Error('No wave data available from Open-Meteo')
  }
  
  // Filter Open-Meteo data to this section's geographic bounds
  const sectionStations = openMeteoData.filter((station: OpenMeteoResponse) => {
    return (
      station.latitude >= section.bounds.south &&
      station.latitude <= section.bounds.north &&
      station.longitude >= section.bounds.west &&
      station.longitude <= section.bounds.east
    )
  })
  
  // If no specific data for this section, use all available stations
  const stationsToUse = sectionStations.length > 0 ? sectionStations : openMeteoData
  
  // Add some realistic regional variation based on section characteristics
  const sectionMultipliers = getSectionCharacteristics(section.name)
  
  return section.points
    .filter(point => !isInMarinaExclusionZone(point.lat, point.lng)) // Exclude marina entrance points
    .map((point, index) => {
    // Find multiple nearby stations and weight them by distance
    const nearbyStations = stationsToUse
      .map((station: OpenMeteoResponse) => {
        const distance = Math.sqrt(
          Math.pow(station.latitude - point.lat, 2) + Math.pow(station.longitude - point.lng, 2)
        )
        return { station, distance }
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3) // Use top 3 nearest stations
    
    if (nearbyStations.length === 0) {
      throw new Error('No nearby weather stations found')
    }
    
    // Average the nearby station data using inverse distance weighting
    let totalWeight = 0
    let weightedHeight = 0, weightedPeriod = 0, weightedDirection = 0
    let weightedSwellHeight = 0, weightedSwellPeriod = 0
    let avgHeight = 0, avgPeriod = 0, avgDirection = 0
    let avgSwellHeight = 0, avgSwellPeriod = 0
    
    for (const { station, distance } of nearbyStations) {
      const weight = 1 / (distance + 0.01) // Inverse distance weighting
      
      // Use current data if available, otherwise use latest hourly data with actual values
      let currentHeight = station.current.wave_height
      let currentPeriod = station.current.wave_period
      let currentDirection = station.current.wave_direction
      
      // If current data is null, try to use hourly data
      if (currentHeight === null || currentPeriod === null || currentDirection === null) {
        // Short comment: use helper to get first non-null triple for readability
        const idx = findFirstNonNullTripletIndex(
          station.hourly.wave_height,
          station.hourly.wave_period,
          station.hourly.wave_direction
        )
        if (idx !== -1) {
          currentHeight = station.hourly.wave_height[idx]
          currentPeriod = station.hourly.wave_period[idx]
          currentDirection = station.hourly.wave_direction[idx]
        }
      }
      
      if (currentHeight !== null && currentPeriod !== null && currentDirection !== null) {
        weightedHeight += currentHeight * weight
        weightedPeriod += currentPeriod * weight
        weightedDirection += currentDirection * weight
        
        // Get swell data from hourly (use first non-null values)
        let swellHeight = null, swellPeriod = null
        const swellIdx = findFirstNonNullPairIndex(
          station.hourly.swell_wave_height,
          station.hourly.swell_wave_period
        )
        if (swellIdx !== -1) {
          swellHeight = station.hourly.swell_wave_height[swellIdx]
          swellPeriod = station.hourly.swell_wave_period[swellIdx]
        }
        
        if (swellHeight !== null && swellPeriod !== null) {
          weightedSwellHeight += swellHeight * weight
          weightedSwellPeriod += swellPeriod * weight
        }
        
        totalWeight += weight
      }
    }
    
    if (totalWeight === 0) {
      // If no valid data found, use a reasonable default based on location and season
      console.warn(`No valid wave data for point ${point.lat}, ${point.lng}, using defaults`)
      const fallbackHeight = 1.0 + Math.random() * 0.5 // 1.0-1.5 meters
      const fallbackPeriod = 10 + Math.random() * 3 // 10-13 seconds  
      const fallbackDirection = 250 + Math.random() * 20 // SW to W
      
      avgHeight = fallbackHeight
      avgPeriod = fallbackPeriod
      avgDirection = fallbackDirection
      avgSwellHeight = fallbackHeight * 0.7
      avgSwellPeriod = fallbackPeriod + 2
    } else {
      // Calculate weighted averages
      avgHeight = weightedHeight / totalWeight
      avgPeriod = weightedPeriod / totalWeight
      avgDirection = weightedDirection / totalWeight
      avgSwellHeight = weightedSwellHeight / totalWeight
      avgSwellPeriod = weightedSwellPeriod / totalWeight
    }
    
    // Apply section-specific characteristics
    const finalHeight = Math.max(0.3, Math.min(3.0, avgHeight * sectionMultipliers.heightMultiplier))
    const finalPeriod = Math.max(6, Math.min(20, avgPeriod * sectionMultipliers.periodMultiplier))
    const finalDirection = avgDirection + sectionMultipliers.directionOffset
    
    // Estimate wind speed based on wave conditions and location
    // Open-Meteo doesn't provide wind in marine API, so we estimate from waves
    const estimatedWindSpeed = Math.min(
      Math.max(2, finalHeight * 3 + sectionMultipliers.windOffset + (Math.random() * 5)), 
      25
    )
    
    // Convert units (Open-Meteo uses meters, we want feet for display)
    const waveHeightFeet = Math.max(0.5, Math.min(15, finalHeight * 3.28084))
    const wavePeriodSeconds = Math.max(5, Math.min(25, finalPeriod))
    const windSpeedKnots = Math.max(0, Math.min(30, estimatedWindSpeed))
    
    // Get location factor for this section
    const locationFactor = getLocationFactor(section.name)
    
    // Calculate wave quality score with location factor
    const qualityScore = calculateWaveQuality({
      waveHeight: waveHeightFeet,
      wavePeriod: wavePeriodSeconds,
      windSpeed: windSpeedKnots,
      waveDirection: finalDirection
    }, locationFactor)
    
    // Calculate water temperature based on season and location
    const baseWaterTemp = 64 + Math.sin((new Date().getMonth() - 2) * Math.PI / 6) * 8
    const waterTempF = baseWaterTemp + sectionMultipliers.tempOffset
    
    return {
      id: `${section.name.toLowerCase().replace(/\s+/g, '-')}-${index}`,
      lat: point.lat,
      lng: point.lng,
      waveHeight: Math.round(waveHeightFeet * 10) / 10,
      wavePeriod: Math.round(wavePeriodSeconds * 10) / 10,
      waveDirection: Math.round(finalDirection),
      windSpeed: Math.round(windSpeedKnots * 10) / 10,
      waterTemp: Math.round(waterTempF * 10) / 10,
      qualityScore,
      timestamp: new Date().toISOString()
    }
  })
}

// Short comment: helpers to find the first index where multiple arrays have non-null values at same position
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

function getSectionCharacteristics(sectionName: string) {
  // Short comment: read characteristics from central map to keep API and UI consistent
  return SECTION_CHARACTERISTICS[sectionName] ?? {
    heightMultiplier: 1.0,
    periodMultiplier: 1.0,
    directionOffset: 0,
    windOffset: 0,
    tempOffset: 0
  }
}
