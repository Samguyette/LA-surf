'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { WaveDataPoint, WaveDataAPIResponse } from '@/types/wave-data'
import { getCoastlineBounds } from '@/data/coastline'
import CoastlineLayer from '@/components/CoastlineLayer'
import RefreshIndicator from '@/components/RefreshIndicator'

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

/**
 * Main surf map component displaying LA County coastline with wave conditions
 */
export default function SurfMap() {
  const [waveData, setWaveData] = useState<WaveDataPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCoastlineLoading, setIsCoastlineLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch wave data from the API
   */
  const fetchWaveData = useCallback(async () => {
    try {
      setError(null)
      
      const response = await fetch('/api/wave-data', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
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
      
      if (result.error) {
        setError(`Using cached data: ${result.error}`)
      }
      
    } catch (err) {
      console.error('Failed to fetch wave data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch wave data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial data load
  useEffect(() => {
    fetchWaveData()
  }, [fetchWaveData])

  // Auto-refresh every 20 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWaveData()
    }, 20 * 60 * 1000) // 20 minutes

    return () => clearInterval(interval)
  }, [fetchWaveData])

  // Get center point for map
  const bounds = getCoastlineBounds()
  const center: [number, number] = [
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2
  ]

  if (error && waveData.length === 0) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        color: '#666',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h2 style={{ marginBottom: '16px', color: '#333' }}>
          Unable to Load Wave Data
        </h2>
        <p style={{ marginBottom: '24px', textAlign: 'center', maxWidth: '400px' }}>
          {error}
        </p>
        <button
          onClick={() => fetchWaveData()}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <MapContainer
        center={center}
        zoom={10}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        keyboard={true}
        attributionControl={true}
        touchZoom={true}
      >
        {/* Map tiles - Using MapTiler custom theme */}
        <TileLayer
          attribution='&copy; <a href="https://www.maptiler.com/copyright">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://api.maptiler.com/maps/062c0d04-1842-4a45-8181-c5bec3bf2214/256/{z}/{x}/{y}.png?key=3tFgnOQBQixe61aigsBT"
          maxZoom={15}
          minZoom={9}
        />
        
        {/* Bounds controller */}
        <MapBoundsController bounds={LA_BOUNDS} />
        
        {/* Coastline with wave data */}
        {waveData.length > 0 && (
          <CoastlineLayer 
            waveData={waveData} 
            onLoadingChange={setIsCoastlineLoading}
          />
        )}
      </MapContainer>
      
      {/* Loading indicator */}
      {(isLoading || isCoastlineLoading) && (
        <div className="loading-spinner" />
      )}
      
      {/* Refresh indicator */}
      <RefreshIndicator
        lastUpdate={lastUpdate}
        error={error}
      />
    </div>
  )
}
