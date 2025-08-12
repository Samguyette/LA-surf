'use client'

import { useEffect, useState } from 'react'
import { Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColorRGB, getWaveQualityLevel } from '@/utils/waveQuality'

interface CoastlineLayerProps {
  waveData: WaveDataPoint[]
}

interface TooltipData {
  point: WaveDataPoint
  position: L.LatLng
}

interface CoastlineSegment {
  id: string
  positions: [number, number][]
  color: string
  weight: number
  opacity: number
  wavePoint: WaveDataPoint
}

/**
 * Component that renders the LA County coastline with wave quality visualization
 * Uses OpenStreetMap Overpass API to get actual coastline geometry
 */
export default function CoastlineLayer({ waveData }: CoastlineLayerProps) {
  const [hoveredPoint, setHoveredPoint] = useState<TooltipData | null>(null)
  const [coastlineGeometry, setCoastlineGeometry] = useState<[number, number][]>([])
  const [isLoadingCoastline, setIsLoadingCoastline] = useState(true)
  const map = useMap()

  // Fetch actual coastline geometry from OpenStreetMap
  useEffect(() => {
    const fetchCoastlineGeometry = async () => {
      try {
        setIsLoadingCoastline(true)
        
        // Query Overpass API for LA County + Ventura County coastline (extended to Oxnard)
        const overpassQuery = `
          [out:json][timeout:25];
          (
            way["natural"="coastline"]
            (33.7,-119.5,34.5,-118.1);
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
        
        console.log('Fetched coastline coordinates:', coastlineCoords.length, 'points')
        setCoastlineGeometry(coastlineCoords)
        
      } catch (error) {
        console.error('Error fetching coastline:', error)
        // Fallback to extended coastline including Oxnard area
        setCoastlineGeometry([
          [34.3989, -119.2445], // Oxnard State Beach
          [34.3678, -119.2001], // Port Hueneme
          [34.3356, -119.1556], // Silver Strand Beach
          [34.3045, -119.1112], // Point Mugu
          [34.2734, -119.0667], // Mugu Rock
          [34.2423, -119.0223], // County Line Beach
          [34.2112, -118.9778], // Deer Creek Beach
          [34.1801, -118.9334], // Trancas Canyon
          [34.1490, -118.8889], // Encinal Canyon
          [34.1157, -118.8445], // Leo Carrillo
          [34.0823, -118.8001], // Zuma Beach
          [34.0456, -118.6778], // Malibu Lagoon
          [34.0189, -118.4445], // Santa Monica Pier
          [34.0101, -118.4001], // Venice Beach
          [33.9823, -118.2001], // Hermosa Beach
          [33.9456, -118.0556], // Palos Verdes
          [33.9123, -117.8889]  // Long Beach
        ])
      } finally {
        setIsLoadingCoastline(false)
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
        
        segments.push({
          id: `natural-segment-${segmentIndex}`,
          positions: segment,
          color,
          weight,
          opacity: 0.8,
          wavePoint: nearestWavePoint
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
          
          segments.push({
            id: `natural-segment-${segmentIndex}-${i}`,
            positions: subSegment,
            color,
            weight,
            opacity: 0.8,
            wavePoint: nearestWavePoint
          })
        }
      }
    })
    
    return segments
  }

  const coastlineSegments = createCoastlineSegments()

  // Handle mouse events for tooltips
  const handleMouseOver = (event: L.LeafletMouseEvent, wavePoint: WaveDataPoint) => {
    setHoveredPoint({
      point: wavePoint,
      position: event.latlng
    })
  }

  const handleMouseOut = () => {
    setHoveredPoint(null)
  }

  // Clear tooltip when map is clicked
  useEffect(() => {
    const handleMapClick = () => setHoveredPoint(null)
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
            mouseover: (e) => handleMouseOver(e, segment.wavePoint),
            mouseout: handleMouseOut,
          }}
        />
      ))}

      {/* Tooltip popup */}
      {hoveredPoint && (
        <Popup
          position={hoveredPoint.position}
          closeButton={false}
          autoPan={false}
          className="wave-tooltip"
        >
          <WaveTooltipContent point={hoveredPoint.point} />
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
}

function WaveTooltipContent({ point }: WaveTooltipContentProps) {
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
      <h3>Surf Conditions</h3>
      
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