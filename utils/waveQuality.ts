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
 *    - Glass (0-3 knots): excellent conditions (90-100%)
 *    - Light (3-8 knots): good conditions (60-90%)
 *    - Moderate (8-12 knots): fair conditions (30-60%)
 *    - Strong (12-18 knots): poor conditions (10-30%)
 *    - Very strong (>18 knots): blown out (0-10%)
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
    waveHeight: 0.25,  // 30% - wave size importance (reduced from 35%)
    wavePeriod: 0.20,  // 25% - wave quality/power (reduced from 30%)
    windSpeed: 0.45,   // 35% - surface conditions (increased from 25%)
    locationFactor: 0.10  // 10% - spot quality modifier
  },
  optimal: {
    minWaveHeight: 3.0,    // feet - raised for more realistic scoring
    maxWaveHeight: 6.0,    // feet - tighter optimal range
    minWavePeriod: 10.0,   // seconds - higher minimum for quality
    maxWavePeriod: 16.0,   // seconds
    maxWindSpeed: 12.0     // knots - more wind-sensitive
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
  
  if (height < 1.5) {
    // Tiny waves: very poor conditions (0-20%)
    return Math.max(0, height * 0.133) // 0 at 0ft, 0.2 at 1.5ft
  } else if (height < optimal.minWaveHeight) {
    // Small waves: poor to fair conditions (20-50%)
    const progress = (height - 1.5) / (optimal.minWaveHeight - 1.5)
    return 0.2 + progress * 0.3  // 20% to 50%
  } else if (height <= optimal.maxWaveHeight) {
    // Optimal range: good to excellent conditions (50-100%)
    const progress = (height - optimal.minWaveHeight) / (optimal.maxWaveHeight - optimal.minWaveHeight)
    return 0.5 + progress * 0.5  // 50% to 100%
  } else if (height <= 8) {
    // Large waves: good for experts (60-80%)
    const progress = (height - optimal.maxWaveHeight) / (8 - optimal.maxWaveHeight)
    return 0.8 - progress * 0.2  // 80% down to 60%
  } else {
    // Too large: dangerous/closed out (20-40%)
    const excess = Math.min(height - 8, 4) // Cap excess at 4ft for calculation
    return 0.4 - (excess / 4) * 0.2  // 40% down to 20%
  }
}

/**
 * Calculate wave period component score with realistic quality standards
 * Period is crucial for wave quality - shorter periods = choppier, lower quality
 */
function calculateWavePeriodScore(period: number, optimal: WaveQualityConfig['optimal']): number {
  if (period <= 0) return 0
  
  if (period < 7) {
    // Very short period: wind waves, very poor quality (0-20%)
    return Math.max(0, period * 0.0286) // 0 at 0s, 0.2 at 7s
  } else if (period < optimal.minWavePeriod) {
    // Short period: poor to fair quality (20-50%)
    const progress = (period - 7) / (optimal.minWavePeriod - 7)
    return 0.2 + progress * 0.3  // 20% to 50%
  } else if (period <= 13) {
    // Medium period: good quality (50-80%)
    const progress = (period - optimal.minWavePeriod) / (13 - optimal.minWavePeriod)
    return 0.5 + progress * 0.3  // 50% to 80%
  } else if (period <= optimal.maxWavePeriod) {
    // Long period: excellent quality (80-100%)
    const progress = (period - 13) / (optimal.maxWavePeriod - 13)
    return 0.8 + progress * 0.2  // 80% to 100%
  } else {
    // Very long period: may be too powerful/spread out (60-80%)
    const excess = Math.min(period - optimal.maxWavePeriod, 8) // Cap excess
    return 0.8 - (excess / 8) * 0.2  // 80% down to 60%
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
  
  // Calculate base wind speed score
  let windSpeedScore = 0
  if (windSpeed <= 3) {
    // Glass conditions: excellent but rare (90-100%)
    windSpeedScore = 0.9 + (3 - windSpeed) * 0.033  // 90% at 3kts, 100% at 0kts
  } else if (windSpeed <= 8) {
    // Light wind: good conditions (60-90%)
    const progress = (windSpeed - 3) / 5
    windSpeedScore = 0.9 - progress * 0.3  // 90% down to 60%
  } else if (windSpeed <= (optimal?.maxWindSpeed || 12)) {
    // Moderate wind: fair conditions (30-60%)
    const progress = (windSpeed - 8) / ((optimal?.maxWindSpeed || 12) - 8)
    windSpeedScore = 0.6 - progress * 0.3  // 60% down to 30%
  } else if (windSpeed <= 18) {
    // Strong wind: poor conditions (10-30%)
    const progress = (windSpeed - (optimal?.maxWindSpeed || 12)) / (18 - (optimal?.maxWindSpeed || 12))
    windSpeedScore = 0.3 - progress * 0.2  // 30% down to 10%
  } else {
    // Very strong wind: blown out (0-10%)
    const excess = Math.min(windSpeed - 18, 12) // Cap excess at 12kts
    windSpeedScore = 0.1 - (excess / 12) * 0.1  // 10% down to 0%
  }
  
  // Apply wind direction modifier if both wind and wave directions are available
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
    return 0.3  // Significantly reduce quality
  } else if (angleDiff >= 135) {
    // Wind blowing opposite to waves (offshore) - good for surf
    return 1.4  // Significantly improve quality (but cap overall score)
  } else if (angleDiff >= 90) {
    // Wind blowing perpendicular (cross-shore) - neutral to slightly good
    return 1.1  // Slight improvement
  } else {
    // Partially onshore winds - somewhat bad
    const factor = (angleDiff - 45) / 45  // 0 to 1 as angle increases
    return 0.3 + factor * 0.8  // Gradually improve from 0.3 to 1.1
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
