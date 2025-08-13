'use client'

import { useEffect, useState } from 'react'
import { Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColorRGB, getWaveQualityLevel } from '@/utils/waveQuality'
import { findNearestCoastlinePoint } from '@/data/coastline'
import { staticCoastlineGeometry } from '@/data/coastline'

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
  const map = useMap()

    // Use hardcoded coastline geometry (static data from OpenStreetMap Overpass API)
  useEffect(() => {
    // Complete coastline coordinates from Overpass API (processed and filtered)
    // This eliminates the need for API fetches and makes the coastline load instantly
    setCoastlineGeometry(staticCoastlineGeometry)
    onLoadingChange?.(false)
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
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Only close if the click wasn't prevented by a segment
      if (!e.originalEvent.defaultPrevented) {
        setSelectedPoint(null)
      }
    }
    
    map.on('click', handleMapClick)
    
    return () => {
      map.off('click', handleMapClick)
    }
  }, [map])



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
              e.originalEvent.preventDefault() // Prevent default behavior
              handleSegmentClick(e, segment)
            },
            // Add mousedown for better mobile compatibility
            mousedown: (e) => {
              e.originalEvent.stopPropagation()
              e.originalEvent.preventDefault()
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
  const qualityColor = getQualityColorRGB(point.qualityScore)
  
  // Format timestamp
  const updateTime = new Date(point.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  return (
    <div className="wave-quality-tooltip">
      <div className="wave-tooltip-header">
        <h3 className="wave-tooltip-title">{coastlinePointName}</h3>
        <span className={`wave-quality-badge ${qualityLevel}`}>
          {qualityLevel.toUpperCase()} <span className="badge-score">{point.qualityScore}</span>
        </span>
      </div>

      <div className="wave-quality-meter" aria-label="Quality score">
        <div
          className="wave-quality-meter-fill"
          style={{ width: `${point.qualityScore}%`, background: qualityColor }}
        />
      </div>

      <div className="metric-grid">
        <div className="metric-item">
          <div className="metric-label">Wave Height</div>
          <div className="metric-value">{point.waveHeight} ft</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Wave Period</div>
          <div className="metric-value">{point.wavePeriod} sec</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Wind Speed</div>
          <div className="metric-value">{point.windSpeed} kts</div>
        </div>
        <div className="metric-item">
          <div className="metric-label">Water Temp</div>
          <div className="metric-value">{point.waterTemp}°F</div>
        </div>
      </div>

      {point.waveDirection && (
        <div className="metric-row">
          <span className="metric-label">Wave Direction</span>{' '}
          <span className="metric-value">{point.waveDirection}°</span>
        </div>
      )}

      <div className="updated-time">Updated: {updateTime}</div>
    </div>
  )
}