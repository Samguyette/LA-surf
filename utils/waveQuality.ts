import { WaveQualityInput, WaveQualityLevel, WaveQualityConfig } from '@/types/wave-data'

/**
 * Wave Quality Scoring Algorithm for LA County Surf Conditions
 * 
 * This algorithm calculates a 0-100 quality score based on NOAA WAVEWATCH III variables.
 * The scoring is optimized for Southern California surf conditions and takes into account:
 * 
 * 1. Wave Height (40% weight): Optimal range 2-8 feet
 *    - Too small (<2ft): poor surfing conditions
 *    - Optimal (2-6ft): excellent for most surfers
 *    - Large (6-8ft): good for experienced surfers
 *    - Too large (>8ft): dangerous conditions
 * 
 * 2. Wave Period (35% weight): Optimal range 8-16 seconds
 *    - Short period (<8s): choppy, poor quality waves (wind waves)
 *    - Medium period (8-12s): good quality groundswell
 *    - Long period (12-16s): excellent quality, powerful waves
 *    - Very long (>16s): may be too powerful or spread out
 * 
 * 3. Wind Speed (25% weight): Lower is better
 *    - Calm (0-5 knots): glass-off conditions, excellent
 *    - Light (5-10 knots): light texture, good
 *    - Moderate (10-15 knots): choppy surface, fair
 *    - Strong (>15 knots): blown out conditions, poor
 * 
 * Note: Wind direction could be added for more precision (offshore vs onshore)
 * but is not included in this simplified model.
 */

const WAVE_QUALITY_CONFIG: WaveQualityConfig = {
  weights: {
    waveHeight: 0.40,  // 40% - most important factor
    wavePeriod: 0.35,  // 35% - quality of the waves
    windSpeed: 0.25    // 25% - surface conditions
  },
  optimal: {
    minWaveHeight: 2.0,    // feet
    maxWaveHeight: 8.0,    // feet
    minWavePeriod: 8.0,    // seconds
    maxWavePeriod: 16.0,   // seconds
    maxWindSpeed: 15.0     // knots
  }
}

/**
 * Calculate wave quality score (0-100) based on wave conditions
 */
export function calculateWaveQuality(input: WaveQualityInput): number {
  const { waveHeight, wavePeriod, windSpeed } = input
  const { weights, optimal } = WAVE_QUALITY_CONFIG
  
  // Calculate individual component scores (0-1 scale)
  const heightScore = calculateWaveHeightScore(waveHeight, optimal)
  const periodScore = calculateWavePeriodScore(wavePeriod, optimal)
  const windScore = calculateWindSpeedScore(windSpeed, optimal)
  
  // Weighted average
  const totalScore = (
    heightScore * weights.waveHeight +
    periodScore * weights.wavePeriod +
    windScore * weights.windSpeed
  )
  
  // Convert to 0-100 scale and round
  return Math.round(totalScore * 100)
}

/**
 * Calculate wave height component score
 * Optimal range: 2-6 feet (beginner to intermediate)
 * Good range: 6-8 feet (advanced)
 * Poor: <2 feet or >8 feet
 */
function calculateWaveHeightScore(height: number, optimal: WaveQualityConfig['optimal']): number {
  if (height <= 0) return 0
  
  if (height < optimal.minWaveHeight) {
    // Too small: linear scale from 0 to 0.6
    return Math.max(0, (height / optimal.minWaveHeight) * 0.6)
  } else if (height <= 6) {
    // Optimal range: high score
    return 1.0
  } else if (height <= optimal.maxWaveHeight) {
    // Large but manageable: good score with slight decline
    return 0.8 - ((height - 6) / (optimal.maxWaveHeight - 6)) * 0.2
  } else {
    // Too large: rapidly declining score
    const excess = height - optimal.maxWaveHeight
    return Math.max(0, 0.6 - (excess / 4) * 0.6)
  }
}

/**
 * Calculate wave period component score
 * Longer periods generally indicate better quality groundswell
 */
function calculateWavePeriodScore(period: number, optimal: WaveQualityConfig['optimal']): number {
  if (period <= 0) return 0
  
  if (period < 6) {
    // Very short period: wind waves, poor quality
    return 0.1
  } else if (period < optimal.minWavePeriod) {
    // Short period: increasing quality
    return 0.1 + ((period - 6) / (optimal.minWavePeriod - 6)) * 0.5
  } else if (period <= 12) {
    // Good period range: high score
    return 0.6 + ((period - optimal.minWavePeriod) / (12 - optimal.minWavePeriod)) * 0.4
  } else if (period <= optimal.maxWavePeriod) {
    // Excellent period range: maximum score
    return 1.0
  } else {
    // Very long period: may be too spread out
    const excess = period - optimal.maxWavePeriod
    return Math.max(0.7, 1.0 - (excess / 10) * 0.3)
  }
}

/**
 * Calculate wind speed component score
 * Lower wind speeds are better for clean surf conditions
 */
function calculateWindSpeedScore(windSpeed: number, optimal: WaveQualityConfig['optimal']): number {
  if (windSpeed < 0) return 0
  
  if (windSpeed <= 5) {
    // Light wind: excellent conditions
    return 1.0
  } else if (windSpeed <= 10) {
    // Moderate wind: good conditions
    return 1.0 - ((windSpeed - 5) / 5) * 0.3
  } else if (windSpeed <= optimal.maxWindSpeed) {
    // Strong wind: declining conditions
    return 0.7 - ((windSpeed - 10) / 5) * 0.4
  } else {
    // Very strong wind: poor conditions
    const excess = windSpeed - optimal.maxWindSpeed
    return Math.max(0, 0.3 - (excess / 10) * 0.3)
  }
}

/**
 * Get quality level description from numeric score
 */
export function getWaveQualityLevel(score: number): WaveQualityLevel {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
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
