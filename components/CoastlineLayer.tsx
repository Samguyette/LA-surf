'use client'

import { useEffect, useMemo, useState } from 'react'
import { Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColorRGB, getWaveQualityLevel } from '@/utils/waveQuality'
import { findNearestCoastlinePoint, groupedCoastlineGeometry } from '@/data/coastline'
import styles from './CoastlineLayer.module.css'

interface CoastlineLayerProps {
  waveData: WaveDataPoint[]
  onLoadingChange?: (isLoading: boolean) => void
  selectedSection?: string | null
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
  sectionName: string
}



/**
 * Component that renders the LA County coastline with wave quality visualization
 * Shows color-coded wave quality data with optional section highlighting
 * 
 * Interactive behavior:
 * - On desktop: Click any part of the coastline to view wave conditions
 * - On mobile: Tap any part of the coastline to view wave conditions
 * - Tap elsewhere on the map or the close button to dismiss the popup
 * - Coastline shows wave quality gradient colors (red/yellow/green)
 * - Selected sections highlight in blue when clicked from ribbon
 */
export default function CoastlineLayer({ waveData, onLoadingChange, selectedSection }: CoastlineLayerProps) {
  const [selectedPoint, setSelectedPoint] = useState<TooltipData | null>(null)
  const map = useMap()

  useEffect(() => {
    onLoadingChange?.(false)
  }, [])

  // Create segments based on grouped coastline sections
  const createCoastlineSegments = (): CoastlineSegment[] => {
    if (waveData.length === 0) {
      return []
    }

    const segments: CoastlineSegment[] = []
    
    // Iterate through each section in the grouped geometry
    Object.entries(groupedCoastlineGeometry).forEach(([sectionName, coordinates]) => {
      if (coordinates.length < 2) return
      
      // Split section coordinates into natural segments based on gaps
      const naturalSegments: [number, number][][] = []
      let currentSegment: [number, number][] = []
      
      for (let i = 0; i < coordinates.length; i++) {
        const currentPoint = coordinates[i]
        
        if (currentSegment.length === 0) {
          currentSegment.push(currentPoint)
        } else {
          const prevPoint = currentSegment[currentSegment.length - 1]
          const distance = Math.sqrt(
            Math.pow(currentPoint[0] - prevPoint[0], 2) + 
            Math.pow(currentPoint[1] - prevPoint[1], 2)
          )
          
          // If there's a large gap (>0.01 degrees ~1km), start a new segment
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
      
      // Create visual segments from natural segments within this section
      naturalSegments.forEach((segment, segmentIndex) => {
        if (segment.length < 2) return
        
        const segmentCenter = [
          segment.reduce((sum, p) => sum + p[0], 0) / segment.length,
          segment.reduce((sum, p) => sum + p[1], 0) / segment.length
        ]
        
        const nearestWavePoint = findNearestWavePoint(waveData, segmentCenter[0], segmentCenter[1])
        const nearestCoastlinePoint = findNearestCoastlinePoint(segmentCenter[0], segmentCenter[1])
        
        // Use wave quality coloring instead of section colors
        const color = getQualityColorRGB(nearestWavePoint.qualityScore)
        const weight = Math.max(5, Math.min(8, (nearestWavePoint.qualityScore / 100) * 3 + 5))
        
        segments.push({
          id: `${sectionName}-segment-${segmentIndex}`,
          positions: segment,
          color,
          weight,
          opacity: 0.8,
          wavePoint: nearestWavePoint,
          coastlinePointName: nearestCoastlinePoint.name || 'Unknown Location',
          sectionName: sectionName
        })
      })
    })
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Created', segments.length, 'coastline segments across', Object.keys(groupedCoastlineGeometry).length, 'sections')
    }
    
    return segments
  }

  const coastlineSegments = useMemo(() => createCoastlineSegments(), [waveData, selectedSection])

  const handleSegmentClick = (event: L.LeafletMouseEvent, segment: CoastlineSegment) => {
    // Use the actual click position to find the nearest surf spot name
    const actualClickPoint = findNearestCoastlinePoint(event.latlng.lat, event.latlng.lng)
    
    setSelectedPoint({
      point: segment.wavePoint,
      position: event.latlng,
      coastlinePointName: actualClickPoint.name || 'Unknown Location'
    })
  }

  // Handle map clicks - check if close to coastline and show data
  useEffect(() => {
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      // Only process if the click wasn't prevented by a segment
      if (!e.originalEvent.defaultPrevented) {
        // Check if click is close to any coastline segment
        const clickLat = e.latlng.lat
        const clickLng = e.latlng.lng
        const clickTolerance = 0.005 // About 500 meters in LA area
        
        let closestSegment: CoastlineSegment | null = null
        let closestDistance = Infinity
        
        for (const segment of coastlineSegments) {
          // Check distance to each point in the segment
          for (const position of segment.positions) {
            const distance = Math.sqrt(
              Math.pow(position[0] - clickLat, 2) + 
              Math.pow(position[1] - clickLng, 2)
            )
            if (distance < closestDistance) {
              closestDistance = distance
              closestSegment = segment
            }
          }
        }
        
        // If click is within tolerance of coastline, show the data
        if (closestSegment && closestDistance < clickTolerance) {
          const actualClickPoint = findNearestCoastlinePoint(clickLat, clickLng)
          setSelectedPoint({
            point: closestSegment.wavePoint,
            position: e.latlng,
            coastlinePointName: actualClickPoint.name || 'Unknown Location'
          })
        } else {
          // Click is far from coastline, close any existing popup
          setSelectedPoint(null)
        }
      }
    }
    
    map.on('click', handleMapClick)
    
    return () => {
      map.off('click', handleMapClick)
    }
  }, [map, coastlineSegments])



  return (
    <>
      {coastlineSegments.map((segment) => {
        // Fix case sensitivity issue
        const isSelected = selectedSection?.toLowerCase() === segment.sectionName.toLowerCase()
        
        return (
          <Polyline
            key={segment.id}
            positions={segment.positions}
            pathOptions={{
              color: isSelected ? '#3B82F6' : segment.color,
              weight: isSelected ? Math.max(segment.weight, 8) + 2 : Math.max(segment.weight, 8),
              opacity: isSelected ? 0.8 : segment.opacity,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation()
                e.originalEvent.preventDefault()
                handleSegmentClick(e, segment)
              },
              mousedown: (e) => {
                e.originalEvent.stopPropagation()
                e.originalEvent.preventDefault()
              },
            }}
          />
        )
      })}

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

function findNearestWavePoint(waveData: WaveDataPoint[], lat: number, lng: number) {
  let nearest = waveData[0]
  let best = Infinity
  for (const p of waveData) {
    const d2 = Math.pow(p.lat - lat, 2) + Math.pow(p.lng - lng, 2)
    if (d2 < best) { best = d2; nearest = p }
  }
  return nearest
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
  
  const updateTime = new Date(point.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  })

  return (
    <div className={styles.waveQualityTooltip}>
      <div className={styles.waveTooltipHeader}>
        <h3 className={styles.waveTooltipTitle}>{coastlinePointName}</h3>
        <span className={`${styles.waveQualityBadge} ${styles[qualityLevel]}`}>
          {qualityLevel.toUpperCase()} <span className={styles.badgeScore}>{point.qualityScore}</span>
        </span>
      </div>

      <div className={styles.waveQualityMeter} aria-label="Quality score">
        <div
          className={styles.waveQualityMeterFill}
          style={{ width: `${point.qualityScore}%`, background: qualityColor }}
        />
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>Wave Height</div>
          <div className={styles.metricValue}>{point.waveHeight} ft</div>
        </div>
        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>Tide</div>
          <div className={styles.metricValue}>
            {point.tideHeight} ft {point.tideTrend === 'rising' ? '↑' : '↓'}
          </div>
        </div>
        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>Wind Speed</div>
          <div className={styles.metricValue}>{point.windSpeed} kts</div>
        </div>
        <div className={styles.metricItem}>
          <div className={styles.metricLabel}>Temp</div>
          <div className={styles.metricValue}>
            <div>🌊&nbsp; {point.waterTemp} °F</div>
            <div>☀️&nbsp; {point.airTemp} °F</div>
          </div>
        </div>
      </div>

      {point.waveDirection && (
        <div className={styles.metricRow}>
          <span className={styles.metricLabel}>Wave Direction</span>{' '}
          <span className={styles.metricValue}>{point.waveDirection}°</span>
        </div>
      )}

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Wave Period</span>{' '}
        <span className={styles.metricValue}>{point.wavePeriod} sec</span>
      </div>

      <div className={styles.updatedTime}>Updated: {updateTime}</div>
      <div className={styles.dataSource}>
        Data sourced from{' '}
        <a 
          href="https://open-meteo.com/en/docs/marine-weather-api" 
          target="_blank" 
          rel="noopener noreferrer"
          className={styles.dataSourceLink}
        >
          Open Meteo
        </a>
      </div>
    </div>
  )
}