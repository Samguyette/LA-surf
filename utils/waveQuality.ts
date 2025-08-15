import { WaveQualityInput, WaveQualityLevel, WaveQualityConfig } from '@/types/wave-data'
import { SECTION_LOCATION_FACTOR } from '@/data/sections'

/**
 * Wave Quality Scoring Algorithm for LA County Surf Conditions
 * 
 * This algorithm calculates a 0-100 quality score using a more realistic Surfline-style approach.
 * The scoring creates natural variation across locations and reflects actual surf quality:
 * 
 * 1. Wave Height (30% weight): More realistic optimal ranges
 *    - Tiny (<1.5ft): very poor conditions (0-20%)
 *    - Small (1.5-3ft): poor to fair conditions (20-50%)
 *    - Good (3-5ft): good conditions (50-80%) 
 *    - Optimal (4-6ft): excellent conditions (80-100%)
 *    - Large (6-8ft): good for experts (60-80%)
 *    - Too large (>8ft): dangerous/closed out (20-40%)
 * 
 * 2. Wave Period (25% weight): More stringent period requirements
 *    - Very short (<7s): wind waves, very poor (0-20%)
 *    - Short (7-10s): poor to fair quality (20-50%)
 *    - Medium (10-13s): good quality (50-80%)
 *    - Long (13-16s): excellent quality (80-100%)
 *    - Very long (>16s): may be too powerful (60-80%)
 * 
 * 3. Wind Conditions (35% weight): Enhanced wind analysis with direction
 *    Wind Speed:
 *    - Glass (0-3.5 mph): excellent conditions (90-100%)
 *    - Light (3.5-9 mph): good conditions (60-90%)
 *    - Moderate (9-14 mph): fair conditions (30-60%)
 *    - Strong (14-21 mph): poor conditions (10-30%)
 *    - Very strong (>21 mph): blown out (0-10%)
 *    
 *    Wind Direction (multiplier on wind score):
 *    - Offshore winds (opposite to waves): improve quality (1.4x)
 *    - Cross-shore winds (perpendicular): slight improvement (1.1x)
 *    - Onshore winds (same direction as waves): degrade quality (0.3x)
 * 
 * 4. Location Factor (10% weight): Reflects spot quality and consistency
 *    - Premium spots get slight bonuses
 *    - Crowded/inconsistent spots get penalties
 */

const WAVE_QUALITY_CONFIG: WaveQualityConfig = {
  weights: {
    waveHeight: 0.30,
    wavePeriod: 0.22,
    windSpeed: 0.38,
    locationFactor: 0.10
  },
  optimal: {
    minWaveHeight: 2.8,   // ft
    maxWaveHeight: 7.0,   // ft
    minWavePeriod: 11.0,  // s
    maxWavePeriod: 17.0,  // s
    maxWindSpeed: 11.0    // kts
  }
}

/**
 * Calculate wave quality score (0-100) based on wave conditions
 */
export function calculateWaveQuality(input: WaveQualityInput, locationFactor: number = 1.0): number {
  const { waveHeight, wavePeriod, windSpeed, waveDirection, windDirection } = input
  const { weights, optimal } = WAVE_QUALITY_CONFIG
  
  // Calculate individual component scores (0-1 scale)
  const heightScore = calculateWaveHeightScore(waveHeight, optimal)
  const periodScore = calculateWavePeriodScore(wavePeriod, optimal)
  const windScore = calculateWindScore(windSpeed, windDirection, waveDirection, optimal)
  
  // Calculate base score from conditions
  const conditionsScore = (
    heightScore * weights.waveHeight +
    periodScore * weights.wavePeriod +
    windScore * weights.windSpeed
  )
  
  // Apply location factor (0.7 = poor spot, 1.0 = average, 1.2 = premium spot)
  const locationWeight = weights.locationFactor || 0.10
  const locationScore = Math.max(0, Math.min(1, locationFactor))
  
  // Combine conditions score (90%) with location factor (10%)
  const totalScore = conditionsScore * (1 - locationWeight) + locationScore * locationWeight
  
  // Convert to 0-100 scale and round
  return Math.round(Math.max(0, Math.min(100, totalScore * 100)))
}

/**
 * Calculate wave height component score with realistic Surfline-style scaling
 * More stringent scoring that reflects actual surf quality expectations
 */
function calculateWaveHeightScore(height: number, optimal: WaveQualityConfig['optimal']): number {
  if (height <= 0) return 0

  if (height < 1.8) {
    return Math.max(0, height * 0.111)
  } else if (height < optimal.minWaveHeight) {
    const progress = (height - 1.8) / (optimal.minWaveHeight - 1.8)
    return 0.2 + progress * 0.3
  } else if (height <= optimal.maxWaveHeight) {
    const progress = (height - optimal.minWaveHeight) / (optimal.maxWaveHeight - optimal.minWaveHeight)
    return 0.5 + progress * 0.5
  } else if (height <= 10) {
    const progress = (height - optimal.maxWaveHeight) / (10 - optimal.maxWaveHeight)
    return 0.8 - progress * 0.2
  } else {
    const excess = Math.min(height - 10, 6)
    return 0.4 - (excess / 6) * 0.2
  }
}


/**
 * Calculate wave period component score with realistic quality standards
 * Period is crucial for wave quality - shorter periods = choppier, lower quality
 */
function calculateWavePeriodScore(period: number, optimal: WaveQualityConfig['optimal']): number {
  if (period <= 0) return 0

  if (period < 8) {
    return Math.max(0, period * 0.025)
  } else if (period < optimal.minWavePeriod) {
    const progress = (period - 8) / (optimal.minWavePeriod - 8)
    return 0.2 + progress * 0.3
  } else if (period <= 14) {
    const progress = (period - optimal.minWavePeriod) / (14 - optimal.minWavePeriod)
    return 0.5 + progress * 0.3
  } else if (period <= optimal.maxWavePeriod) {
    const progress = (period - 14) / (optimal.maxWavePeriod - 14)
    return 0.8 + progress * 0.2
  } else {
    const excess = Math.min(period - optimal.maxWavePeriod, 8)
    return 0.85 - (excess / 8) * 0.15
  }
}


/**
 * Calculate wind component score with wind speed and direction analysis
 * Enhanced to consider offshore vs onshore winds for surf quality
 */
function calculateWindScore(
  windSpeed: number,
  windDirection?: number,
  waveDirection?: number,
  optimal?: WaveQualityConfig['optimal']
): number {
  if (windSpeed < 0) return 0

  let windSpeedScore = 0
  if (windSpeed <= 4) {
    windSpeedScore = 1 - (windSpeed * 0.02)
  } else if (windSpeed <= 8) {
    windSpeedScore = 0.92 - ((windSpeed - 4) * 0.0675)
  } else if (windSpeed <= (optimal?.maxWindSpeed || 11)) {
    windSpeedScore = 0.65 - ((windSpeed - 8) * 0.10)
  } else if (windSpeed <= 18) {
    windSpeedScore = 0.35 - ((windSpeed - (optimal?.maxWindSpeed || 11)) * 0.032857)
  } else {
    const excess = Math.min(windSpeed - 18, 12)
    windSpeedScore = 0.12 - (excess * 0.008333)
  }

  if (windDirection !== undefined && waveDirection !== undefined) {
    const windDirectionModifier = calculateWindDirectionModifier(windDirection, waveDirection)
    return windSpeedScore * windDirectionModifier
  }
  return windSpeedScore
}


/**
 * Calculate wind direction modifier for surf quality
 * Offshore winds (blowing from land to sea) improve surf quality
 * Onshore winds (blowing from sea to land) degrade surf quality
 */
function calculateWindDirectionModifier(windDirection: number, waveDirection: number): number {
  // Normalize angles to 0-360
  const normalizedWindDir = ((windDirection % 360) + 360) % 360
  const normalizedWaveDir = ((waveDirection % 360) + 360) % 360
  
  // Calculate the angle difference between wind and wave direction
  let angleDiff = Math.abs(normalizedWindDir - normalizedWaveDir)
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff
  }
  
  // For LA coastline (generally facing south/southwest):
  // - Offshore winds (from northeast quadrant): enhance quality
  // - Onshore winds (from southwest quadrant): degrade quality
  // - Cross-shore winds (from north/south): neutral to slightly negative
  
  if (angleDiff <= 45) {
    // Wind blowing in same direction as waves (onshore) - bad for surf
    return 0.25  // Significantly reduce quality
  } else if (angleDiff >= 135) {
    // Wind blowing opposite to waves (offshore) - good for surf
    return 1.5
  } else if (angleDiff >= 90) {
    // Wind blowing perpendicular (cross-shore) - neutral to slightly good
    return 1.08
  } else {
    // Partially onshore winds - somewhat bad
    const factor = (angleDiff - 45) / 45
    return 0.25 + factor * 0.83
  }
}

/**
 * Get location quality factor based on surf spot characteristics
 * This reflects the inherent quality and consistency of different surf spots
 */
export function getLocationFactor(sectionName: string): number {
  // Short comment: centralized map prevents drift between API and utils
  return SECTION_LOCATION_FACTOR[sectionName] ?? 1.0
}

/**
 * Get quality level description from numeric score with adjusted thresholds
 * More realistic thresholds that reflect the tougher scoring
 */
export function getWaveQualityLevel(score: number): WaveQualityLevel {
  if (score >= 75) return 'excellent'  // Raised from 80 - excellent is rare
  if (score >= 55) return 'good'       // Raised from 60 - good is solid
  if (score >= 35) return 'fair'       // Lowered from 40 - fair is average
  return 'poor'                        // Poor is common in reality
}

/**
 * Get color for quality score (for gradient visualization)
 * Returns HSL hue value (0-120, where 0=red, 60=yellow, 120=green)
 */
export function getQualityColor(score: number): string {
  // Map score (0-100) to hue (0-120)
  const hue = (score / 100) * 120
  return `hsl(${hue}, 80%, 50%)`
}

/**
 * Get RGB color for quality score (alternative format)
 */
export function getQualityColorRGB(score: number): string {
  const normalizedScore = Math.max(0, Math.min(100, score)) / 100
  
  if (normalizedScore < 0.5) {
    // Red to Yellow (0-50)
    const red = 255
    const green = Math.round(255 * (normalizedScore * 2))
    const blue = 0
    return `rgb(${red}, ${green}, ${blue})`
  } else {
    // Yellow to Green (50-100)
    const red = Math.round(255 * (1 - ((normalizedScore - 0.5) * 2)))
    const green = 255
    const blue = 0
    return `rgb(${red}, ${green}, ${blue})`
  }
}
