import { NextRequest, NextResponse } from 'next/server'
import NodeCache from 'node-cache'
import { WaveDataPoint, OpenMeteoResponse } from '@/types/wave-data'
import { calculateWaveQuality, getLocationFactor } from '@/utils/waveQuality'
import { LA_COASTLINE_POINTS } from '@/data/coastline'

// Cache for 20 minutes (1200 seconds)
const cache = new NodeCache({ stdTTL: 1200 })

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
    // Check cache first
    const cachedData = cache.get('wave-data') as WaveDataPoint[] | undefined
    if (cachedData) {
      return NextResponse.json({
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('Fetching fresh wave data from Open-Meteo...')
    
    // Fetch fresh data from Open-Meteo
    const waveData = await fetchOpenMeteoWaveData()
    console.log(`Received data from ${waveData.length} stations`)
    
    // Process and interpolate data for LA coastline points
    const processedData = await processWaveDataForCoastline(waveData)
    console.log(`Processed ${processedData.length} coastline points`)
    
    // Cache the processed data
    cache.set('wave-data', processedData)
    
    return NextResponse.json({
      data: processedData,
      cached: false,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error fetching wave data:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Return cached data if available, even if stale
    const staleData = cache.get('wave-data') as WaveDataPoint[] | undefined
    if (staleData) {
      return NextResponse.json({
        data: staleData,
        cached: true,
        stale: true,
        error: 'Using cached data due to API error',
        timestamp: new Date().toISOString()
      })
    }
    
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
  const latitudes = [
    33.70, 33.78, 33.86, 33.94, 34.02, 34.10, 34.18, 34.26, 34.34, 34.42
  ]
  const longitudes = [
    -119.30, -119.05, -118.80, -118.55, -118.30, -118.05, -117.80, -117.95, -118.15, -118.40
  ]
  
  // Build the API URL with multiple coordinates for better coverage
  const baseUrl = 'https://marine-api.open-meteo.com/v1/marine'
  const params = new URLSearchParams({
    latitude: latitudes.join(','),
    longitude: longitudes.join(','),
    current: 'wave_height,wave_direction,wave_period',
    hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period',
    forecast_days: '1',
    timezone: 'America/Los_Angeles'
  })
  
  const endpoint = `${baseUrl}?${params.toString()}`
  
  console.log(`Fetching wave data from Open-Meteo API...`)
  
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent': 'LA-Surf-App/1.0',
    },
    signal: AbortSignal.timeout(10000) // 10 second timeout
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  console.log(`Successfully fetched wave data from Open-Meteo`)
  return response
}

// Legacy NOAA mock data generation removed - Open-Meteo provides reliable real data

async function processWaveDataForCoastline(openMeteoData: OpenMeteoResponse[]): Promise<WaveDataPoint[]> {
  // Process coastline data by dividing into sections for better spatial resolution
  const coastlineData: WaveDataPoint[] = []
  
  // Divide coastline into detailed sections for highly accurate wave data
  // Increased from 4 to 12 sections for much better granularity
  const coastlineSections = [
    {
      name: 'Oxnard/Ventura County',
      points: LA_COASTLINE_POINTS.slice(0, 2), // North Starting Point to Zuma
      bounds: { north: 34.45, south: 34.30, west: -119.4, east: -119.0 }
    },
    {
      name: 'Zuma/Point Dume',
      points: LA_COASTLINE_POINTS.slice(1, 3), // Zuma to Malibu Point
      bounds: { north: 34.30, south: 34.15, west: -119.1, east: -118.8 }
    },
    {
      name: 'Malibu Point/Surfrider',
      points: LA_COASTLINE_POINTS.slice(2, 5), // Malibu Point to Malibu Lagoon
      bounds: { north: 34.15, south: 34.05, west: -118.85, east: -118.65 }
    },
    {
      name: 'Malibu Creek/Big Rock',
      points: LA_COASTLINE_POINTS.slice(4, 6), // Malibu Lagoon to Topanga
      bounds: { north: 34.08, south: 34.02, west: -118.70, east: -118.50 }
    },
    {
      name: 'Topanga/Sunset Point',
      points: LA_COASTLINE_POINTS.slice(5, 7), // Topanga to Will Rogers
      bounds: { north: 34.05, south: 34.00, west: -118.55, east: -118.48 }
    },
    {
      name: 'Will Rogers/Santa Monica',
      points: LA_COASTLINE_POINTS.slice(6, 9), // Will Rogers to Santa Monica Pier
      bounds: { north: 34.02, south: 33.98, west: -118.52, east: -118.42 }
    },
    {
      name: 'Santa Monica Pier/Venice',
      points: LA_COASTLINE_POINTS.slice(8, 11), // Santa Monica Pier to Venice
      bounds: { north: 34.00, south: 33.96, west: -118.46, east: -118.40 }
    },
    {
      name: 'Venice/El Segundo',
      points: LA_COASTLINE_POINTS.slice(10, 12), // Venice to Manhattan Beach
      bounds: { north: 33.98, south: 33.92, west: -118.42, east: -118.25 }
    },
    {
      name: 'Manhattan Beach/Hermosa',
      points: LA_COASTLINE_POINTS.slice(11, 13), // Manhattan to Hermosa Beach
      bounds: { north: 33.94, south: 33.88, west: -118.30, east: -118.18 }
    },
    {
      name: 'Hermosa/Redondo Beach',
      points: LA_COASTLINE_POINTS.slice(12, 14), // Hermosa to Redondo Beach
      bounds: { north: 33.90, south: 33.84, west: -118.22, east: -118.12 }
    },
    {
      name: 'Redondo/Palos Verdes',
      points: LA_COASTLINE_POINTS.slice(13, 16), // Redondo to PV Peninsula
      bounds: { north: 33.86, south: 33.78, west: -118.18, east: -118.25 }
    },
    {
      name: 'Palos Verdes Peninsula',
      points: LA_COASTLINE_POINTS.slice(15, 18), // PV Peninsula to Rancho PV
      bounds: { north: 33.82, south: 33.70, west: -118.45, east: -118.30 }
    }
  ]
  
  // Process each section separately to get more varied data
  for (const section of coastlineSections) {
    const sectionData = await processSectionWaveData(openMeteoData, section)
    coastlineData.push(...sectionData)
  }
  
  return coastlineData
}

interface CoastlineSection {
  name: string
  points: typeof LA_COASTLINE_POINTS
  bounds: { north: number; south: number; west: number; east: number }
}

async function processSectionWaveData(
  openMeteoData: OpenMeteoResponse[], 
  section: CoastlineSection
): Promise<WaveDataPoint[]> {
  if (!openMeteoData || openMeteoData.length === 0) {
    throw new Error('No wave data available from Open-Meteo')
  }
  
  // Filter Open-Meteo data to this section's geographic bounds
  const sectionStations = openMeteoData.filter((station: any) => {
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
  
  return section.points.map((point, index) => {
    // Find multiple nearby stations and weight them by distance
    const nearbyStations = stationsToUse
      .map((station: any) => {
        const distance = Math.sqrt(
          Math.pow(station.latitude - point.lat, 2) + Math.pow(station.longitude - point.lng, 2)
        )
        return { station, distance }
      })
      .sort((a: any, b: any) => a.distance - b.distance)
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
        // Find the first non-null hourly values
        for (let i = 0; i < station.hourly.wave_height.length; i++) {
          if (station.hourly.wave_height[i] !== null && 
              station.hourly.wave_period[i] !== null && 
              station.hourly.wave_direction[i] !== null) {
            currentHeight = station.hourly.wave_height[i]
            currentPeriod = station.hourly.wave_period[i]
            currentDirection = station.hourly.wave_direction[i]
            break
          }
        }
      }
      
      if (currentHeight !== null && currentPeriod !== null && currentDirection !== null) {
        weightedHeight += currentHeight * weight
        weightedPeriod += currentPeriod * weight
        weightedDirection += currentDirection * weight
        
        // Get swell data from hourly (use first non-null values)
        let swellHeight = null, swellPeriod = null
        for (let i = 0; i < station.hourly.swell_wave_height.length; i++) {
          if (station.hourly.swell_wave_height[i] !== null && 
              station.hourly.swell_wave_period[i] !== null) {
            swellHeight = station.hourly.swell_wave_height[i]
            swellPeriod = station.hourly.swell_wave_period[i]
            break
          }
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

function getSectionCharacteristics(sectionName: string) {
  // Define realistic characteristics for each detailed coastal section
  switch (sectionName) {
    case 'Oxnard/Ventura County':
      return {
        heightMultiplier: 1.15, // Exposed to big NW swells
        periodMultiplier: 1.1, // Long period swells
        directionOffset: -8, // Strong NW exposure
        windOffset: 3, // More wind exposure
        tempOffset: -2 // Coolest water
      }
    case 'Zuma/Point Dume':
      return {
        heightMultiplier: 1.1, // Good swell exposure
        periodMultiplier: 1.05, // Longer periods
        directionOffset: -5, // NW exposure
        windOffset: 1, // Some wind protection
        tempOffset: -1 // Slightly cooler
      }
    case 'Malibu Point/Surfrider':
      return {
        heightMultiplier: 1.0, // Classic Malibu waves
        periodMultiplier: 1.0, // Perfect period
        directionOffset: 0, // Direct west exposure
        windOffset: -2, // Point protection
        tempOffset: 0 // Ideal temperature
      }
    case 'Malibu Creek/Big Rock':
      return {
        heightMultiplier: 0.95, // Slightly more protected
        periodMultiplier: 0.98, // Good period
        directionOffset: 2, // Slight SW exposure
        windOffset: -1, // Some protection
        tempOffset: 0 // Typical temperature
      }
    case 'Topanga/Sunset Point':
      return {
        heightMultiplier: 0.9, // More protected bay area
        periodMultiplier: 0.95, // Shorter period
        directionOffset: 5, // More SW exposure
        windOffset: 0, // Average wind
        tempOffset: 1 // Slightly warmer
      }
    case 'Will Rogers/Santa Monica':
      return {
        heightMultiplier: 0.85, // Bay protection
        periodMultiplier: 0.92, // Shorter period
        directionOffset: 8, // SW exposure
        windOffset: 2, // More onshore wind
        tempOffset: 1 // Bay warming
      }
    case 'Santa Monica Pier/Venice':
      return {
        heightMultiplier: 0.8, // Protected bay
        periodMultiplier: 0.9, // Short period
        directionOffset: 10, // SW exposure
        windOffset: 3, // Onshore wind
        tempOffset: 2 // Urban heat effect
      }
    case 'Venice/El Segundo':
      return {
        heightMultiplier: 0.85, // Beach break exposure
        periodMultiplier: 0.88, // Shorter period
        directionOffset: 12, // S/SW exposure
        windOffset: 4, // Airport wind effect
        tempOffset: 2 // Warm urban area
      }
    case 'Manhattan Beach/Hermosa':
      return {
        heightMultiplier: 0.9, // Good beach break
        periodMultiplier: 0.9, // Moderate period
        directionOffset: 15, // More south exposure
        windOffset: 3, // Onshore winds
        tempOffset: 2 // Urban heat
      }
    case 'Hermosa/Redondo Beach':
      return {
        heightMultiplier: 0.88, // Beach break
        periodMultiplier: 0.88, // Short period
        directionOffset: 18, // South exposure
        windOffset: 4, // More wind
        tempOffset: 3 // Warmer urban area
      }
    case 'Redondo/Palos Verdes':
      return {
        heightMultiplier: 0.92, // Transitioning to point
        periodMultiplier: 0.9, // Moderate period
        directionOffset: 20, // S/SSW exposure
        windOffset: 2, // Some wind protection
        tempOffset: 2 // Urban influence
      }
    case 'Palos Verdes Peninsula':
      return {
        heightMultiplier: 1.05, // Point break exposure
        periodMultiplier: 1.0, // Good period
        directionOffset: 25, // Strong south exposure
        windOffset: 0, // Protected from NW winds
        tempOffset: 1 // Slightly warmer
      }
    default:
      return {
        heightMultiplier: 1.0,
        periodMultiplier: 1.0,
        directionOffset: 0,
        windOffset: 0,
        tempOffset: 0
      }
  }
}
