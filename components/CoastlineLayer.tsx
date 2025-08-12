'use client'

import { useEffect, useState } from 'react'
import { Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColorRGB, getWaveQualityLevel } from '@/utils/waveQuality'
import { findNearestCoastlinePoint } from '@/data/coastline'

interface CoastlineLayerProps {
  waveData: WaveDataPoint[]
  onLoadingChange?: (isLoading: boolean) => void
}

interface TooltipData {
  point: WaveDataPoint
  position: L.LatLng
  coastlinePointName: string
}

interface CoastlineSegment {
  id: string
  positions: [number, number][]
  color: string
  weight: number
  opacity: number
  wavePoint: WaveDataPoint
  coastlinePointName: string
}

/**
 * Component that renders the LA County coastline with wave quality visualization
 * Uses OpenStreetMap Overpass API to get actual coastline geometry
 * 
 * Interactive behavior:
 * - On desktop: Click any part of the coastline to view wave conditions
 * - On mobile: Tap any part of the coastline to view wave conditions
 * - Tap elsewhere on the map or the close button to dismiss the popup
 * - Each coastline segment shows color-coded wave quality data
 */
export default function CoastlineLayer({ waveData, onLoadingChange }: CoastlineLayerProps) {
  const [selectedPoint, setSelectedPoint] = useState<TooltipData | null>(null)
  const [coastlineGeometry, setCoastlineGeometry] = useState<[number, number][]>([])
  const [isLoadingCoastline, setIsLoadingCoastline] = useState(true)
  const map = useMap()

  // Fetch actual coastline geometry from OpenStreetMap
  useEffect(() => {
    const fetchCoastlineGeometry = async () => {
      try {
        setIsLoadingCoastline(true)
        onLoadingChange?.(true)
        
        // Query Overpass API for coastline from specified north point to Rancho Palos Verdes
        const overpassQuery = `
          [out:json][timeout:25];
          (
            way["natural"="coastline"]
            (33.7,-119.1,34.1,-118.0);
          );
          out geom;
        `
        
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `data=${encodeURIComponent(overpassQuery)}`
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch coastline data')
        }
        
        const data = await response.json()
        
        // Extract and process coordinates from the response
        const coastlineCoords: [number, number][] = []
        
        if (data.elements && data.elements.length > 0) {
          // Collect all coordinate segments
          const allSegments: [number, number][][] = []
          
          data.elements.forEach((element: any) => {
            if (element.geometry && element.geometry.length > 0) {
              const segment: [number, number][] = element.geometry.map((coord: any) => [coord.lat, coord.lon])
              allSegments.push(segment)
            }
          })
          
          // Process each segment separately to preserve natural coastline geometry
          if (allSegments.length > 0) {
            // Sort segments by their northernmost point to maintain coastal order
            allSegments.sort((a, b) => {
              const aMaxLat = Math.max(...a.map(coord => coord[0]))
              const bMaxLat = Math.max(...b.map(coord => coord[0]))
              return bMaxLat - aMaxLat
            })
            
            // Keep segments separate - don't artificially connect them
            for (const segment of allSegments) {
              if (segment.length > 1) {
                // Simplify each segment individually
                const simplifiedSegment: [number, number][] = []
                
                for (let i = 0; i < segment.length; i++) {
                  if (i === 0 || i === segment.length - 1) {
                    // Always keep first and last points of each segment
                    simplifiedSegment.push(segment[i])
                  } else {
                    const prev = simplifiedSegment[simplifiedSegment.length - 1]
                    const curr = segment[i]
                    const distance = Math.sqrt(
                      Math.pow(curr[0] - prev[0], 2) + 
                      Math.pow(curr[1] - prev[1], 2)
                    )
                    // Only keep points that are sufficiently spaced
                    if (distance > 0.002) {
                      simplifiedSegment.push(curr)
                    }
                  }
                }
                
                // Add this segment to our coastline coordinates
                coastlineCoords.push(...simplifiedSegment)
              }
            }
          }
        }
        
        // Filter coastline to only include points between specified north point and Rancho Palos Verdes
        const filteredCoords = coastlineCoords.filter(coord => {
          const lat = coord[0]
          const lng = coord[1]
          // North point: 34.09413904941302, -119.07850285736356
          // Rancho Palos Verdes: 33.7445, -118.3870
          
          // Basic bounds check
          const withinBounds = lat >= 33.7445 && lat <= 34.09413904941302 && lng >= -119.07850285736356 && lng <= -118.3870
          
          // Exclude Long Beach area (approximately 33.7-33.8 lat, -118.2 to -118.1 lng)
          const inLongBeach = lat >= 33.7 && lat <= 33.8 && lng >= -118.2 && lng <= -118.1
          
          // Exclude marina area (33.96473731214972,-118.45981872167121 to 33.96097999713439,-118.45598554857159)
          const inMarina = lat >= 33.96097999713439 && lat <= 33.96473731214972 && 
                           lng >= -118.45981872167121 && lng <= -118.45598554857159
          
          return withinBounds && !inLongBeach && !inMarina
        })
        
        console.log('Fetched coastline coordinates:', coastlineCoords.length, 'points')
        console.log('Filtered coastline coordinates:', filteredCoords.length, 'points (North point to Rancho Palos Verdes, excluding marina)')
        console.log('Marina exclusion created gap in coastline at:', {
          marina: {
            north: 33.96473731214972,
            south: 33.96097999713439,
            west: -118.45981872167121,
            east: -118.45598554857159
          }
        })
        setCoastlineGeometry(filteredCoords)
        
      } catch (error) {
        console.error('Error fetching coastline:', error)
        // Fallback to coastline from specified north point to Rancho Palos Verdes
        setCoastlineGeometry([
          [34.09413904941302, -119.07850285736356], // North starting point
          [34.0823, -118.8001], // Zuma Beach
          [34.0456, -118.6778], // Malibu Lagoon
          [34.0189, -118.4445], // Santa Monica Pier
          [34.0101, -118.4001], // Venice Beach
          [33.9823, -118.2001], // Hermosa Beach
          [33.9456, -118.0556], // Palos Verdes
          [33.8445, -118.3170], // Palos Verdes Peninsula
          [33.7945, -118.3370], // Point Vicente
          [33.7445, -118.3870]  // Rancho Palos Verdes
        ])
      } finally {
        setIsLoadingCoastline(false)
        onLoadingChange?.(false)
      }
    }
    
    fetchCoastlineGeometry()
  }, [])

  // Create segments that respect natural coastline geometry
  const createCoastlineSegments = (): CoastlineSegment[] => {
    if (coastlineGeometry.length < 2 || waveData.length === 0) {
      return []
    }

    const segments: CoastlineSegment[] = []
    
    // Split coastline into natural segments based on gaps between points
    const naturalSegments: [number, number][][] = []
    let currentSegment: [number, number][] = []
    
    for (let i = 0; i < coastlineGeometry.length; i++) {
      const currentPoint = coastlineGeometry[i]
      
      if (currentSegment.length === 0) {
        currentSegment.push(currentPoint)
      } else {
        const prevPoint = currentSegment[currentSegment.length - 1]
        const distance = Math.sqrt(
          Math.pow(currentPoint[0] - prevPoint[0], 2) + 
          Math.pow(currentPoint[1] - prevPoint[1], 2)
        )
        
        // If there's a large gap (>0.01 degrees ~1km), start a new segment
        // This prevents connecting across bays
        if (distance > 0.01) {
          if (currentSegment.length > 1) {
            naturalSegments.push([...currentSegment])
          }
          currentSegment = [currentPoint]
        } else {
          currentSegment.push(currentPoint)
        }
      }
    }
    
    // Add the last segment
    if (currentSegment.length > 1) {
      naturalSegments.push(currentSegment)
    }
    
    console.log('Created', naturalSegments.length, 'natural coastline segments')
    
    // Create visual segments from natural segments
    naturalSegments.forEach((segment, segmentIndex) => {
      if (segment.length < 2) return
      
      // For longer segments, subdivide them to get better color variation
      const maxPointsPerSegment = 8
      
      if (segment.length <= maxPointsPerSegment) {
        // Small segment - use as is
        const segmentCenter = [
          segment.reduce((sum, p) => sum + p[0], 0) / segment.length,
          segment.reduce((sum, p) => sum + p[1], 0) / segment.length
        ]
        
        let nearestWavePoint = waveData[0]
        let minDistance = Infinity
        
        for (const wavePoint of waveData) {
          const distance = Math.sqrt(
            Math.pow(wavePoint.lat - segmentCenter[0], 2) + 
            Math.pow(wavePoint.lng - segmentCenter[1], 2)
          )
          
          if (distance < minDistance) {
            minDistance = distance
            nearestWavePoint = wavePoint
          }
        }
        
        const color = getQualityColorRGB(nearestWavePoint.qualityScore)
        const weight = Math.max(5, Math.min(8, (nearestWavePoint.qualityScore / 100) * 3 + 5))
        
        // Find nearest coastline point name
        const nearestCoastlinePoint = findNearestCoastlinePoint(segmentCenter[0], segmentCenter[1])
        
        segments.push({
          id: `natural-segment-${segmentIndex}`,
          positions: segment,
          color,
          weight,
          opacity: 0.8,
          wavePoint: nearestWavePoint,
          coastlinePointName: nearestCoastlinePoint.name || 'Unknown Location'
        })
      } else {
        // Large segment - subdivide it
        const chunkSize = Math.ceil(segment.length / Math.ceil(segment.length / maxPointsPerSegment))
        
        for (let i = 0; i < segment.length - 1; i += chunkSize) {
          const subSegment = segment.slice(i, i + chunkSize + 1) // +1 for overlap
          
          if (subSegment.length < 2) continue
          
          const segmentCenter = [
            subSegment.reduce((sum, p) => sum + p[0], 0) / subSegment.length,
            subSegment.reduce((sum, p) => sum + p[1], 0) / subSegment.length
          ]
          
          let nearestWavePoint = waveData[0]
    let minDistance = Infinity
    
          for (const wavePoint of waveData) {
      const distance = Math.sqrt(
              Math.pow(wavePoint.lat - segmentCenter[0], 2) + 
              Math.pow(wavePoint.lng - segmentCenter[1], 2)
      )
      
      if (distance < minDistance) {
        minDistance = distance
              nearestWavePoint = wavePoint
            }
          }
          
          const color = getQualityColorRGB(nearestWavePoint.qualityScore)
          const weight = Math.max(5, Math.min(8, (nearestWavePoint.qualityScore / 100) * 3 + 5))
          
          // Find nearest coastline point name
          const nearestCoastlinePoint = findNearestCoastlinePoint(segmentCenter[0], segmentCenter[1])
          
          segments.push({
            id: `natural-segment-${segmentIndex}-${i}`,
            positions: subSegment,
            color,
            weight,
            opacity: 0.8,
            wavePoint: nearestWavePoint,
            coastlinePointName: nearestCoastlinePoint.name || 'Unknown Location'
          })
        }
      }
    })
    
    return segments
  }

  const coastlineSegments = createCoastlineSegments()

  // Handle click/tap events for mobile-friendly tooltips
  const handleSegmentClick = (event: L.LeafletMouseEvent, segment: CoastlineSegment) => {
    // Use the actual click position to find the nearest surf spot name
    // This ensures accuracy when tapping different parts of the coastline
    const actualClickPoint = findNearestCoastlinePoint(event.latlng.lat, event.latlng.lng)
    
    setSelectedPoint({
      point: segment.wavePoint,
      position: event.latlng,
      coastlinePointName: actualClickPoint.name || 'Unknown Location'
    })
  }

  // Clear tooltip when map is clicked (but not on a segment)
  useEffect(() => {
    const handleMapClick = () => setSelectedPoint(null)
    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [map])

  // Debug logging
  console.log('CoastlineLayer Debug:', {
    waveDataLength: waveData.length,
    coastlineGeometryLength: coastlineGeometry.length,
    segmentsLength: coastlineSegments.length,
    isLoadingCoastline
  })

  if (isLoadingCoastline) {
    return null // Show nothing while loading coastline
  }

  return (
    <>
      {/* Render coastline segments with wave quality colors */}
      {coastlineSegments.map((segment) => (
        <Polyline
          key={segment.id}
          positions={segment.positions}
          pathOptions={{
            color: segment.color,
            weight: segment.weight,
            opacity: segment.opacity,
            lineCap: 'round',
            lineJoin: 'round',
          }}
          eventHandlers={{
            click: (e) => {
              e.originalEvent.stopPropagation() // Prevent map click event
              handleSegmentClick(e, segment)
            },
          }}
        />
      ))}

      {/* Tooltip popup */}
      {selectedPoint && (
        <Popup
          position={selectedPoint.position}
          closeButton={true}
          autoPan={true}
          className="wave-tooltip"
          eventHandlers={{
            remove: () => setSelectedPoint(null)
          }}
        >
          <WaveTooltipContent 
            point={selectedPoint.point} 
            coastlinePointName={selectedPoint.coastlinePointName}
          />
        </Popup>
      )}
    </>
  )
}

/**
 * Tooltip content component showing wave conditions
 */
interface WaveTooltipContentProps {
  point: WaveDataPoint
  coastlinePointName: string
}

function WaveTooltipContent({ point, coastlinePointName }: WaveTooltipContentProps) {
  const qualityLevel = getWaveQualityLevel(point.qualityScore)
  const qualityClass = `wave-quality-score ${qualityLevel}`
  
  // Format timestamp
  const updateTime = new Date(point.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  return (
    <div className="wave-quality-tooltip">
      <h3>{coastlinePointName}</h3>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
        Surf Conditions
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <span className={qualityClass}>
          {point.qualityScore}/100 ({qualityLevel.toUpperCase()})
        </span>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '11px' }}>
        <div>
          <strong>Wave Height:</strong><br />
          {point.waveHeight} ft
        </div>
        <div>
          <strong>Wave Period:</strong><br />
          {point.wavePeriod} sec
        </div>
        <div>
          <strong>Wind Speed:</strong><br />
          {point.windSpeed} kts
        </div>
        <div>
          <strong>Water Temp:</strong><br />
          {point.waterTemp}°F
        </div>
      </div>
      
      {point.waveDirection && (
        <div style={{ marginTop: '4px', fontSize: '11px' }}>
          <strong>Wave Direction:</strong> {point.waveDirection}°
        </div>
      )}
      
      <div style={{ 
        marginTop: '8px', 
        fontSize: '10px', 
        color: '#888',
        borderTop: '1px solid #eee',
        paddingTop: '4px'
      }}>
        Updated: {updateTime}
      </div>
    </div>
  )
}