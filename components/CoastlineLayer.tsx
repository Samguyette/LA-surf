'use client'

import { useEffect, useMemo, useState } from 'react'
import { Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColorRGB, getWaveQualityLevel } from '@/utils/waveQuality'
import { findNearestCoastlinePoint, staticCoastlineGeometry } from '@/data/coastline'
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

  // Create segments based on continuous coastline with gap detection
  const createCoastlineSegments = (): CoastlineSegment[] => {
    if (waveData.length === 0) {
      return []
    }

    const segments: CoastlineSegment[] = []
    const coordinates = staticCoastlineGeometry
    
    if (coordinates.length < 2) return []
    
    // Track current section and build segments, breaking on large gaps or section changes
    let currentSection = determineCoastlineSection(coordinates[0][0], coordinates[0][1])
    let currentSegment: [number, number][] = [coordinates[0]]
    
    for (let i = 1; i < coordinates.length; i++) {
      const [lat, lng] = coordinates[i]
      const prevPoint = coordinates[i - 1]
      const pointSection = determineCoastlineSection(lat, lng)
      
      // Calculate distance between consecutive points
      const distance = Math.sqrt(
        Math.pow(lat - prevPoint[0], 2) + 
        Math.pow(lng - prevPoint[1], 2)
      )
      
      // Break segment if there's a large gap (>0.01 degrees ~1km) OR section changes
      const hasLargeGap = distance > 0.01
      const sectionChanged = pointSection !== currentSection
      
      if (hasLargeGap || sectionChanged) {
        // Finish current segment if it has enough points
        if (currentSegment.length >= 2) {
          const segmentCenter = [
            currentSegment.reduce((sum, p) => sum + p[0], 0) / currentSegment.length,
            currentSegment.reduce((sum, p) => sum + p[1], 0) / currentSegment.length
          ]
          
          const nearestWavePoint = findNearestWavePoint(waveData, segmentCenter[0], segmentCenter[1])
          const nearestCoastlinePoint = findNearestCoastlinePoint(segmentCenter[0], segmentCenter[1])
          
          const color = getQualityColorRGB(nearestWavePoint.qualityScore)
          const weight = Math.max(5, Math.min(8, (nearestWavePoint.qualityScore / 100) * 3 + 5))
          
          segments.push({
            id: `section-${currentSection}-${segments.length}`,
            positions: [...currentSegment],
            color,
            weight,
            opacity: 0.8,
            wavePoint: nearestWavePoint,
            coastlinePointName: nearestCoastlinePoint.name || 'Unknown Location',
            sectionName: currentSection
          })
        }
        
        // Start new segment - only include previous point if gap is small and we're just changing sections
        currentSection = pointSection
        if (!hasLargeGap && sectionChanged) {
          currentSegment = [coordinates[i - 1], [lat, lng]] // Include last point for continuity
        } else {
          currentSegment = [[lat, lng]] // Start fresh for large gaps
        }
      } else {
        // Same section and no large gap, add to current segment
        currentSegment.push([lat, lng])
      }
    }
    
    // Add the final segment
    if (currentSegment.length >= 2) {
      const segmentCenter = [
        currentSegment.reduce((sum, p) => sum + p[0], 0) / currentSegment.length,
        currentSegment.reduce((sum, p) => sum + p[1], 0) / currentSegment.length
      ]
      
      const nearestWavePoint = findNearestWavePoint(waveData, segmentCenter[0], segmentCenter[1])
      const nearestCoastlinePoint = findNearestCoastlinePoint(segmentCenter[0], segmentCenter[1])
      
      const color = getQualityColorRGB(nearestWavePoint.qualityScore)
      const weight = Math.max(5, Math.min(8, (nearestWavePoint.qualityScore / 100) * 3 + 5))
      
      segments.push({
        id: `section-${currentSection}-${segments.length}`,
        positions: [...currentSegment],
        color,
        weight,
        opacity: 0.8,
        wavePoint: nearestWavePoint,
        coastlinePointName: nearestCoastlinePoint.name || 'Unknown Location',
        sectionName: currentSection
      })
    }
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('Created', segments.length, 'coastline segments with gap detection and section breaks')
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
 * Determine which coastline section a coordinate belongs to based on geographic bounds
 */
function determineCoastlineSection(lat: number, lng: number): string {
  const sections = [
    {
      name: 'Oxnard/Ventura County',
      bounds: { north: 34.1950, south: 34.0800, west: -119.2785, east: -118.9000 }
    },
    {
      name: 'Zuma/Point Dume',
      bounds: { north: 34.0900, south: 34.0700, west: -118.9000, east: -118.7000 }
    },
    {
      name: 'Malibu Point/Surfrider',
      bounds: { north: 34.0750, south: 34.0400, west: -118.7200, east: -118.6700 }
    },
    {
      name: 'Malibu Creek/Big Rock',
      bounds: { north: 34.0500, south: 34.0300, west: -118.6700, east: -118.5700 }
    },
    {
      name: 'Topanga/Sunset Point',
      bounds: { north: 34.0400, south: 34.0250, west: -118.5700, east: -118.5000 }
    },
    {
      name: 'Will Rogers/Santa Monica',
      bounds: { north: 34.0350, south: 34.0000, west: -118.5300, east: -118.4900 }
    },
    {
      name: 'Santa Monica Pier/Venice',
      bounds: { north: 34.0100, south: 33.9700, west: -118.4950, east: -118.4500 }
    },
    {
      name: 'Venice/El Segundo',
      bounds: { north: 33.9700, south: 33.9200, west: -118.4500, east: -118.4200 }
    },
    {
      name: 'Manhattan Beach/Hermosa',
      bounds: { north: 33.9000, south: 33.8500, west: -118.4200, east: -118.3900 }
    },
    {
      name: 'Hermosa/Redondo Beach',
      bounds: { north: 33.8600, south: 33.8300, west: -118.4000, east: -118.3800 }
    },
    {
      name: 'Redondo/Palos Verdes',
      bounds: { north: 33.8400, south: 33.7700, west: -118.3900, east: -118.3400 }
    },
    {
      name: 'Palos Verdes Peninsula',
      bounds: { north: 33.8500, south: 33.7400, west: -118.3900, east: -118.3100 }
    }
  ]

  // Check each section to see if the coordinate falls within its bounds
  for (const section of sections) {
    const { bounds } = section
    if (lat >= bounds.south && lat <= bounds.north && 
        lng >= bounds.west && lng <= bounds.east) {
      return section.name
    }
  }
  
  // If no section matches, find the closest section based on distance to center
  let closestSection = sections[0]
  let minDistance = Infinity
  
  for (const section of sections) {
    const centerLat = (section.bounds.north + section.bounds.south) / 2
    const centerLng = (section.bounds.east + section.bounds.west) / 2
    const distance = Math.sqrt(
      Math.pow(lat - centerLat, 2) + Math.pow(lng - centerLng, 2)
    )
    
    if (distance < minDistance) {
      minDistance = distance
      closestSection = section
    }
  }
  
  return closestSection.name
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