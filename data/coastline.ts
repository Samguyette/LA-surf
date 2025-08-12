import { CoastlinePoint } from '@/types/wave-data'

/**
 * Los Angeles County Surf Spot Reference Points
 * 
 * These are reference points for major surf breaks along the LA County coast.
 * Used for wave data interpolation and as fallback points.
 * The actual coastline geometry is fetched from OpenStreetMap.
 */

export const LA_COASTLINE_POINTS: CoastlinePoint[] = [
  // High-resolution coastline points for detailed wave data interpolation
  // Increased from 15 to 35+ points for much better granularity
  
  // Oxnard/Ventura County Section
  { lat: 34.09413904941302, lng: -119.07850285736356, name: 'North Starting Point' },
  { lat: 34.0950, lng: -119.0500, name: 'Oxnard Beach' },
  { lat: 34.0900, lng: -119.0200, name: 'Silver Strand Beach' },
  
  // Zuma/Point Dume Section  
  { lat: 34.0823, lng: -118.8001, name: 'Zuma Beach' },
  { lat: 34.0790, lng: -118.7800, name: 'Broad Beach' },
  { lat: 34.0745, lng: -118.7200, name: 'Point Dume' },
  
  // Malibu Point/Surfrider Section
  { lat: 34.0678, lng: -118.7001, name: 'Malibu Point' },
  { lat: 34.0630, lng: -118.6900, name: 'Surfrider Beach' },
  { lat: 34.0580, lng: -118.6850, name: 'Malibu Pier' },
  { lat: 34.0456, lng: -118.6778, name: 'Malibu Lagoon' },
  
  // Malibu Creek/Big Rock Section
  { lat: 34.0420, lng: -118.6650, name: 'Malibu Creek' },
  { lat: 34.0390, lng: -118.6500, name: 'Big Rock Beach' },
  { lat: 34.0380, lng: -118.5800, name: 'Las Flores Beach' },
  
  // Topanga/Sunset Point Section
  { lat: 34.0367, lng: -118.5334, name: 'Topanga Beach' },
  { lat: 34.0350, lng: -118.5200, name: 'Sunset Point' },
  { lat: 34.0320, lng: -118.5100, name: 'Castle Rock' },
  
  // Will Rogers/Santa Monica Section
  { lat: 34.0301, lng: -118.5001, name: 'Will Rogers Beach' },
  { lat: 34.0280, lng: -118.4900, name: 'Temescal Beach' },
  { lat: 34.0250, lng: -118.4750, name: 'Palisades Beach' },
  { lat: 34.0220, lng: -118.4600, name: 'Santa Monica State Beach' },
  { lat: 34.0189, lng: -118.4445, name: 'Santa Monica Pier' },
  
  // Santa Monica Pier/Venice Section
  { lat: 34.0150, lng: -118.4350, name: 'Ocean Park' },
  { lat: 34.0120, lng: -118.4250, name: 'Venice Pier' },
  { lat: 34.0101, lng: -118.4001, name: 'Venice Beach' },
  { lat: 34.0080, lng: -118.4200, name: 'Venice Breakwater' },
  { lat: 34.0050, lng: -118.4300, name: 'Marina del Rey' },
  
  // Venice/Dockweiler Section
  { lat: 33.9991, lng: -118.4181, name: 'Dockweiler State Beach' },
  { lat: 33.9950, lng: -118.4150, name: 'Dockweiler Beach North' },
  { lat: 33.9900, lng: -118.4120, name: 'Dockweiler Beach South' },
  { lat: 33.9850, lng: -118.4100, name: 'Playa del Rey Beach' },
  
  // Manhattan Beach Section
  { lat: 33.8844, lng: -118.4085, name: 'Manhattan Beach North' },
  { lat: 33.8823, lng: -118.4062, name: 'Manhattan Beach Pier' },
  { lat: 33.8801, lng: -118.4039, name: 'Manhattan Beach' },
  { lat: 33.8780, lng: -118.4016, name: 'Manhattan Beach South' },
  
  // Hermosa Beach Section
  { lat: 33.8629, lng: -118.3998, name: 'Hermosa Beach North' },
  { lat: 33.8607, lng: -118.3975, name: 'Hermosa Beach Pier' },
  { lat: 33.8585, lng: -118.3952, name: 'Hermosa Beach' },
  { lat: 33.8563, lng: -118.3929, name: 'Hermosa Beach South' },
  
  // Redondo Beach Section
  { lat: 33.8485, lng: -118.3889, name: 'Redondo Beach North' },
  { lat: 33.8430, lng: -118.3855, name: 'Redondo Beach Pier' },
  { lat: 33.8375, lng: -118.3821, name: 'Redondo Beach' },
  
  // Redondo/Torrance Section
  { lat: 33.8320, lng: -118.3787, name: 'Redondo Beach South' },
  { lat: 33.8265, lng: -118.3753, name: 'Torrance Beach North' },
  { lat: 33.8210, lng: -118.3719, name: 'Torrance Beach' },
  { lat: 33.8155, lng: -118.3685, name: 'Torrance Beach South' },
  
  // Palos Verdes Section
  { lat: 33.8100, lng: -118.3651, name: 'RAT Beach (Redondo Beach)' },
  { lat: 33.7900, lng: -118.3500, name: 'Malaga Cove' },
  { lat: 33.7800, lng: -118.3400, name: 'Bluff Cove' },
  
  // Palos Verdes Peninsula Section
  { lat: 33.8445, lng: -118.3170, name: 'Palos Verdes Peninsula' },
  { lat: 33.8200, lng: -118.3300, name: 'Abalone Cove' },
  { lat: 33.7945, lng: -118.3370, name: 'Point Vicente' },
  { lat: 33.7700, lng: -118.3500, name: 'Portuguese Point' },
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