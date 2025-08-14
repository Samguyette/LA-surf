'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint, WaveDataAPIResponse } from '@/types/wave-data'
import { getCoastlineBounds } from '@/data/coastline'
import CoastlineLayer from '@/components/CoastlineLayer'
import RefreshIndicator from '@/components/RefreshIndicator'
import SectionRibbon from '@/components/SectionRibbon'
import InteractiveHint from '@/components/InteractiveHint'
import BuoyLayer from '@/components/BuoyLayer'
import styles from './SurfMap.module.css'

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Extended bounds to include Oxnard/Ventura County
const LA_BOUNDS = L.latLngBounds(
  L.latLng(33.7, -119.3), // Southwest (extended west)
  L.latLng(34.5, -117.7)  // Northeast (extended north)
)

interface MapBoundsControllerProps {
  bounds: L.LatLngBounds
}

/**
 * Component to restrict map panning to LA County bounds
 */
function MapBoundsController({ bounds }: MapBoundsControllerProps) {
  const map = useMap()
  
  useEffect(() => {
    // Set max bounds to restrict panning
    map.setMaxBounds(bounds)
    map.setMinZoom(9)
    map.setMaxZoom(15)
    
    // Configure mobile touch handling
    if ('tap' in map && (map as any).tap) {
      (map as any).tap.enable()
    }
    
    // Ensure map stays within bounds
    map.on('drag', () => {
      map.panInsideBounds(bounds, { animate: false })
    })
    
    return () => {
      map.off('drag')
    }
  }, [map, bounds])
  
  return null
}

interface MapCenterTrackerProps {
  onCenterChange: (center: { lat: number; lng: number }) => void
  onMapReady: (map: L.Map) => void
}

/**
 * Component to track map center changes
 */
function MapCenterTracker({ onCenterChange, onMapReady }: MapCenterTrackerProps) {
  const map = useMap()
  
  useEffect(() => {
    // Set map reference for parent component
    onMapReady(map)
    
    // Set initial center
    const initialCenter = map.getCenter()
    onCenterChange({ lat: initialCenter.lat, lng: initialCenter.lng })
    
    // Listen for map movement events
    const handleMoveEnd = () => {
      const center = map.getCenter()
      onCenterChange({ lat: center.lat, lng: center.lng })
    }
    
    map.on('moveend', handleMoveEnd)
    map.on('zoomend', handleMoveEnd)
    
    return () => {
      map.off('moveend', handleMoveEnd)
      map.off('zoomend', handleMoveEnd)
    }
  }, [map, onCenterChange, onMapReady])
  
  return null
}

interface MapClickHandlerProps {
  onMapClick: () => void
}

/**
 * Component to handle map clicks for resetting selection
 */
function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  const map = useMap()
  
  useEffect(() => {
    const handleClick = () => {
      onMapClick()
    }
    
    map.on('click', handleClick)
    
    return () => {
      map.off('click', handleClick)
    }
  }, [map, onMapClick])
  
  return null
}

/**
 * Main surf map component displaying LA County coastline with wave conditions
 */
export default function SurfMap() {
  const [waveData, setWaveData] = useState<WaveDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCoastlineLoading, setIsCoastlineLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [measurementTime, setMeasurementTime] = useState<Date | null>(null)
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined)
  const [showBuoyInfo, setShowBuoyInfo] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const handleMapReady = useCallback((map: L.Map) => {}, [])

  /**
   * Fetch wave data from the API
   */
  const fetchWaveData = useCallback(async () => {
    try {
      setError(null)
      console.log('Fetching fresh wave data at:', new Date().toISOString())
      
      const response = await fetch('/api/wave-data', { 
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const result: WaveDataAPIResponse = await response.json()
      
      if (result.error && !result.data) {
        throw new Error(result.error)
      }
      
      setWaveData(result.data)
      setLastUpdate(new Date(result.timestamp))
      
      if (result.measurementTime) {
        setMeasurementTime(new Date(result.measurementTime))
      }
      
      if (result.nextRefresh) {
        setNextRefresh(new Date(result.nextRefresh))
      }
      
      if (result.error) {
        setError(`Using cached data: ${result.error}`)
      } else {
        setError(null)
        setRetryCount(0)
      }
      
    } catch (err) {
      console.error('Failed to fetch wave data:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch wave data'
      setError(errorMessage)
      
      // Exponential backoff retry logic
      const newRetryCount = retryCount + 1
      setRetryCount(newRetryCount)
      
      if (newRetryCount <= 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 30000)
        console.log(`Retrying in ${retryDelay}ms (attempt ${newRetryCount}/3)`)
        
        setTimeout(() => {
          fetchWaveData()
        }, retryDelay)
      }
    } finally {
      setIsLoading(false)
    }
  }, [retryCount])

  // Initial data load
  useEffect(() => {
    fetchWaveData()
  }, [fetchWaveData])

  // Auto-refresh every 10 minutes (matching server cache TTL)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWaveData()
    }, 10 * 60 * 1000)

    return () => clearInterval(interval)
  }, [fetchWaveData])

  const center: [number, number] = [
    33.99025038212213,-118.65394136580532
  ]

  if (error && waveData.length === 0) {
    return (
      <div className={styles.errorContainer}>
        <h2 className={styles.errorTitle}>
          Unable to Load Wave Data
        </h2>
        <p className={styles.errorMessage}>
          {error}
        </p>
        <button
          onClick={() => fetchWaveData()}
          className={styles.retryButton}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className={styles.mapContainer}>
      {/* Section ribbon */}
      {waveData.length > 0 && (
        <SectionRibbon 
          waveData={waveData} 
          mapCenter={mapCenter}
          selectedSection={selectedSection}
          onSectionSelect={setSelectedSection}
        />
      )}
      
      <MapContainer
        center={center}
        zoom={11}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        keyboard={true}
        attributionControl={true}
        touchZoom={true}
      >
        {/* Map tiles - Using MapTiler custom theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.maptiler.com/copyright">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          // Short comment: read the key from env for safety; falls back to existing behavior if unset
          url={`https://api.maptiler.com/maps/062c0d04-1842-4a45-8181-c5bec3bf2214/256/{z}/{x}/{y}.png?key=${process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '3tFgnOQBQixe61aigsBT'}`}
          maxZoom={15}
          minZoom={9}
        />
        
        {/* Bounds controller */}
        <MapBoundsController bounds={LA_BOUNDS} />
        
        {/* Map center tracker */}
        <MapCenterTracker onCenterChange={setMapCenter} onMapReady={handleMapReady} />
        
        {/* Map click handler to reset selection */}
        <MapClickHandler onMapClick={() => setSelectedSection(null)} />
        
        {/* Coastline with wave data */}
        {waveData.length > 0 && (
          <CoastlineLayer 
            waveData={waveData} 
            onLoadingChange={setIsCoastlineLoading}
            selectedSection={selectedSection}
          />
        )}
        

        
        {/* Buoy locations layer */}
        <BuoyLayer showLabels={false} />
      </MapContainer>
      
      {/* Loading indicator */}
      {(isLoading || isCoastlineLoading) && (
        <div className={styles.loadingSpinner} />
      )}
      
      {/* Refresh indicator */}
      <RefreshIndicator
        lastUpdate={lastUpdate}
        measurementTime={measurementTime}
        nextRefresh={nextRefresh}
        error={error}
      />
      
      {/* Buoy information button */}
      <button
        onClick={() => setShowBuoyInfo(!showBuoyInfo)}
        className={`${styles.buoyInfoButton} ${showBuoyInfo ? styles.active : ''}`}
        title="Wave Measurement Stations Info"
      >
        Buoy Info
      </button>
      
      {/* Buoy legend - only show when info button is clicked */}
      {showBuoyInfo && (
        <div className={styles.buoyInfoPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              Wave Measurement Stations
            </div>
            <button
              onClick={() => setShowBuoyInfo(false)}
              className={styles.closeButton}
              title="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendDotOpenMeteo}`}></div>
            <span className={styles.legendText}>Open-Meteo API Points</span>
          </div>
          <div className={styles.panelDescription}>
            Open-Meteo API data collection points used for wave forecasting in the LA area. These three strategic locations provide wave, wind, and temperature data for surf forecasting. Click on any point for detailed information.
            <br /><br />
            <em>Zoom out to see all buoy locations on the map</em>
          </div>
          <div className={styles.panelFooter}>
            Total: 3 Open-Meteo API points • <a 
              href="https://open-meteo.com/en/docs/marine-weather-api" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.dataSourceLink}
            >
              Learn more
            </a>
          </div>
        </div>
      )}
      
      {/* Interactive hint for new users */}
      {waveData.length > 0 && !isLoading && !isCoastlineLoading && (
        <InteractiveHint />
      )}
    </div>
  )
}
