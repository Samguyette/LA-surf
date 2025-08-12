import { CoastlinePoint } from '@/types/wave-data'

/**
 * Los Angeles County Surf Spot Reference Points
 * 
 * These are reference points for major surf breaks along the LA County coast.
 * Used for wave data interpolation and as fallback points.
 * The actual coastline geometry is fetched from OpenStreetMap.
 */

export const LA_COASTLINE_POINTS: CoastlinePoint[] = [
  // Coastline from specified north point to Rancho Palos Verdes
  { lat: 34.09413904941302, lng: -119.07850285736356, name: 'North Starting Point' },
  { lat: 34.0823, lng: -118.8001, name: 'Zuma Beach' },
  { lat: 34.0678, lng: -118.7001, name: 'Malibu Point' },
  { lat: 34.0456, lng: -118.6778, name: 'Malibu Lagoon' },
  { lat: 34.0367, lng: -118.5334, name: 'Topanga Beach' },
  { lat: 34.0301, lng: -118.5001, name: 'Will Rogers Beach' },
  { lat: 34.0189, lng: -118.4445, name: 'Santa Monica Pier' },
  { lat: 34.0101, lng: -118.4001, name: 'Venice Beach' },
  { lat: 33.9945, lng: -118.2889, name: 'Manhattan Beach' },
  { lat: 33.9823, lng: -118.2001, name: 'Hermosa Beach' },
  { lat: 33.9689, lng: -118.1556, name: 'Redondo Beach' },
  { lat: 33.9456, lng: -118.0556, name: 'Palos Verdes' },
  { lat: 33.8445, lng: -118.3170, name: 'Palos Verdes Peninsula' },
  { lat: 33.7945, lng: -118.3370, name: 'Point Vicente' },
  { lat: 33.7445, lng: -118.3870, name: 'Rancho Palos Verdes' }
]

/**
 * Get bounding box for LA County coastline
 */
export function getCoastlineBounds() {
  return {
    north: 34.5,   // Extended north to include Oxnard
    south: 33.7,
    east: -117.7,
    west: -119.3   // Extended west to include Oxnard coastline
  }
}

/**
 * Find nearest surf spot to given coordinates
 */
export function findNearestCoastlinePoint(lat: number, lng: number): CoastlinePoint {
  let nearestPoint = LA_COASTLINE_POINTS[0]
  let minDistance = Infinity
  
  for (const point of LA_COASTLINE_POINTS) {
    const distance = Math.sqrt(
      Math.pow(point.lat - lat, 2) + Math.pow(point.lng - lng, 2)
    )
    
    if (distance < minDistance) {
      minDistance = distance
      nearestPoint = point
    }
  }
  
  return nearestPoint
}