'use client'

import { useState } from 'react'
import L from 'leaflet'
import styles from './StationInfo.module.css'

// Station data (copied from the respective layer components)
const BUOY_LOCATIONS = [
  { lat: 33.755, lng: -119.045, name: 'Santa Monica Basin' },
  { lat: 34.241, lng: -119.839, name: 'Santa Barbara' },
  { lat: 34.274, lng: -120.468, name: 'West Santa Barbara' }
]

const WIND_STATIONS = [
  { lat: 33.749, lng: -119.053, name: 'Santa Monica Bay' },
  { lat: 33.618, lng: -118.317, name: 'San Pedro Channel' },
  { lat: 33.610, lng: -118.630, name: 'Long Beach Offshore' },
  { lat: 33.9425, lng: -118.4081, name: 'LAX Airport' },
  { lat: 33.8177, lng: -118.1516, name: 'Long Beach Airport' },
  { lat: 34.0158, lng: -118.4513, name: 'Santa Monica Airport' },
  { lat: 33.8034, lng: -118.3396, name: 'Torrance Airport' },
  { lat: 34.2098, lng: -118.4898, name: 'Van Nuys Airport' },
  { lat: 34.080, lng: -118.800, name: 'Point Dume Area' },
  { lat: 33.750, lng: -118.400, name: 'Palos Verdes Peninsula' },
  { lat: 34.030, lng: -118.820, name: 'Malibu/Zuma Beach' }
]

/**
 * Calculate bounds that include all measurement stations
 */
function getAllStationsBounds(): L.LatLngBounds {
  const allStations = [...BUOY_LOCATIONS, ...WIND_STATIONS]
  const lats = allStations.map(station => station.lat)
  const lngs = allStations.map(station => station.lng)
  
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  
  // Add some padding around the bounds
  const latPadding = (maxLat - minLat) * 0.1
  const lngPadding = (maxLng - minLng) * 0.1
  
  return L.latLngBounds(
    L.latLng(minLat - latPadding, minLng - lngPadding),
    L.latLng(maxLat + latPadding, maxLng + lngPadding)
  )
}

interface StationInfoProps {
  mapInstance: L.Map | null
}

/**
 * Component to display station information button and panel
 * Shows information about wave buoys and wind measurement stations
 */
export default function StationInfo({ mapInstance }: StationInfoProps) {
  const [showStationInfo, setShowStationInfo] = useState(false)

  /**
   * Zoom the map to show all measurement stations
   */
  const handleZoomToAllStations = () => {
    if (!mapInstance) return
    
    const bounds = getAllStationsBounds()
    mapInstance.fitBounds(bounds, {
      padding: [20, 20],
      maxZoom: 10 // Don't zoom in too much
    })
  }

  return (
    <>
      {/* Station information button */}
      <button
        onClick={() => setShowStationInfo(!showStationInfo)}
        className={`${styles.stationInfoButton} ${showStationInfo ? styles.active : ''}`}
        title="Wave & Wind Measurement Stations Info"
      >
        Station Info
      </button>
      
      {/* Station legend - only show when info button is clicked */}
      {showStationInfo && (
        <div className={styles.stationInfoPanel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              Wave & Wind Measurement Stations
            </div>
            <button
              onClick={() => setShowStationInfo(false)}
              className={styles.closeButton}
              title="Close"
            >
              ×
            </button>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot} ${styles.legendDotOpenMeteo}`} style={{flexShrink: '0'}}></div>
            <span className={styles.legendText}>Wave Buoys — Data collection points for surf forecasting</span>
          </div>
          <div className={styles.legendItem}>
            <div className={`${styles.legendDot}`} style={{backgroundColor: '#0066cc', width: '12px', height: '12px', flexShrink: '0'}}></div>
            <span className={styles.legendText}>Wind Stations — Physical measurement stations (offshore, coastal & inland)</span>
          </div>
          <div className={styles.panelFooter}>
            Total: 15 measurement stations • <a 
              href="https://open-meteo.com/en/docs/marine-weather-api" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.dataSourceLink}
            >
              Learn more
            </a>
          </div>
          <div className={styles.zoomButtonContainer}>
            <button
              onClick={handleZoomToAllStations}
              className={styles.zoomButton}
              title="Zoom out to view all measurement stations"
              disabled={!mapInstance}
            >
              📍 View All Stations
            </button>
          </div>
        </div>
      )}
    </>
  )
}
