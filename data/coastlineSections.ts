import { LA_COASTLINE_POINTS } from '@/data/coastline'
import { CoastlinePoint } from '@/types/wave-data'

export interface CoastlineSection {
  name: string
  pointSlice: [number, number]
  points: CoastlinePoint[]
  bounds: {
    north: number
    south: number
    west: number
    east: number
  }
}

// Calculate bounds from actual coastline points
function calculateSectionBounds(points: CoastlinePoint[]) {
  if (points.length === 0) return { north: 0, south: 0, west: 0, east: 0 }
  
  const lats = points.map(p => p.lat)
  const lngs = points.map(p => p.lng)
  
  const padding = 0.005 // Smaller padding for better precision
  
  return {
    north: Math.max(...lats) + padding,
    south: Math.min(...lats) - padding,
    west: Math.min(...lngs) - padding, // Most negative (westernmost)
    east: Math.max(...lngs) + padding  // Least negative (easternmost)
  }
}

// Shared coastline section definitions
// This is the single source of truth for all coastline sections
export const COASTLINE_SECTIONS: CoastlineSection[] = [
  {
    name: 'Oxnard/Ventura County',
    pointSlice: [0, 3], // North Starting Point to Silver Strand Beach
    points: LA_COASTLINE_POINTS.slice(0, 3),
    bounds: { north: 34.1950, south: 33.9900, west: -119.2785, east: -118.8200 }
  },
  {
    name: 'Zuma/Point Dume',
    pointSlice: [3, 6], // Zuma Beach to Point Dume
    points: LA_COASTLINE_POINTS.slice(3, 6),
    bounds: { north: 34.1823, south: 33.9745, west: -119.0001, east: -118.5200 }
  },
  {
    name: 'Malibu Point/Surfrider',
    pointSlice: [6, 10], // Malibu Point to Malibu Lagoon
    points: LA_COASTLINE_POINTS.slice(6, 10),
    bounds: { north: 34.1678, south: 33.9456, west: -118.9001, east: -118.4778 }
  },
  {
    name: 'Malibu Creek/Big Rock',
    pointSlice: [10, 13], // Malibu Creek to Las Flores Beach
    points: LA_COASTLINE_POINTS.slice(10, 13),
    bounds: { north: 34.1420, south: 33.9380, west: -118.7650, east: -118.3800 }
  },
  {
    name: 'Topanga/Sunset Point',
    pointSlice: [13, 16], // Topanga Beach to Castle Rock
    points: LA_COASTLINE_POINTS.slice(13, 16),
    bounds: { north: 34.1367, south: 33.9320, west: -118.6334, east: -118.3100 }
  },
  {
    name: 'Will Rogers/Santa Monica',
    pointSlice: [16, 21], // Will Rogers Beach to Santa Monica Pier
    points: LA_COASTLINE_POINTS.slice(16, 21),
    bounds: { north: 34.1301, south: 33.9189, west: -118.6001, east: -118.2445 }
  },
  {
    name: 'Santa Monica Pier/Venice',
    pointSlice: [21, 26], // Ocean Park to Marina del Rey
    points: LA_COASTLINE_POINTS.slice(21, 26),
    bounds: { north: 34.1150, south: 33.9050, west: -118.6350, east: -118.2000 }
  },
  {
    name: 'Venice/El Segundo',
    pointSlice: [26, 30], // Dockweiler State Beach to Playa del Rey Beach
    points: LA_COASTLINE_POINTS.slice(26, 30),
    bounds: { north: 34.0991, south: 33.8850, west: -118.5181, east: -118.2100 }
  },
  {
    name: 'Manhattan Beach/Hermosa',
    pointSlice: [30, 38], // Manhattan Beach North to Hermosa Beach South
    points: LA_COASTLINE_POINTS.slice(30, 38),
    bounds: { north: 33.9844, south: 33.7563, west: -118.5085, east: -118.1929 }
  },
  {
    name: 'Hermosa/Redondo Beach',
    pointSlice: [38, 41], // Redondo Beach North to Redondo Beach
    points: LA_COASTLINE_POINTS.slice(38, 41),
    bounds: { north: 33.9485, south: 33.7375, west: -118.4889, east: -118.1821 }
  },
  {
    name: 'Redondo/Palos Verdes',
    pointSlice: [41, 48], // Redondo Beach South to Bluff Cove
    points: LA_COASTLINE_POINTS.slice(41, 48),
    bounds: { north: 33.9320, south: 33.6800, west: -118.4787, east: -118.1400 }
  },
  {
    name: 'Palos Verdes Peninsula',
    pointSlice: [48, 53], // Palos Verdes Peninsula to Rancho Palos Verdes
    points: LA_COASTLINE_POINTS.slice(48, 53),
    bounds: { north: 33.9445, south: 33.6445, west: -118.4870, east: -118.1170 }
  }
]

// Helper function to recalculate bounds if needed
export function recalculateSectionBounds(): CoastlineSection[] {
  return COASTLINE_SECTIONS.map(section => ({
    ...section,
    bounds: calculateSectionBounds(section.points)
  }))
}
