'use client'

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import styles from './WindStationLayer.module.css'

// Physical wind measurement stations that likely feed into Open-Meteo models
const WIND_STATIONS = [
  // NDBC Ocean Buoys (Offshore Wind Measurements)
  {
    id: 'NDBC-46025',
    lat: 33.749,
    lng: -119.053,
    name: 'Santa Monica Bay',
    type: 'NDBC Ocean Buoy',
    description: 'Offshore wind and wave measurements ~25 miles west of Santa Monica',
    status: 'Active',
    dataSource: 'NOAA NDBC',
    category: 'offshore'
  },
  {
    id: 'NDBC-46221',
    lat: 33.618,
    lng: -118.317,
    name: 'San Pedro Channel',
    type: 'NDBC Ocean Buoy',
    description: 'Offshore wind measurements ~12 miles south of San Pedro',
    status: 'Active',
    dataSource: 'NOAA NDBC',
    category: 'offshore'
  },
  {
    id: 'NDBC-46222',
    lat: 33.610,
    lng: -118.630,
    name: 'Long Beach Offshore',
    type: 'NDBC Ocean Buoy',
    description: 'Offshore wind measurements ~20 miles southwest of Long Beach',
    status: 'Active',
    dataSource: 'NOAA NDBC',
    category: 'offshore'
  },
  
  // ASOS/AWOS Airport Stations (Land-Based Wind)
  {
    id: 'KLAX',
    lat: 33.9425,
    lng: -118.4081,
    name: 'LAX Airport',
    type: 'ASOS Weather Station',
    description: 'Los Angeles International Airport - coastal wind measurements',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'KLGB',
    lat: 33.8177,
    lng: -118.1516,
    name: 'Long Beach Airport',
    type: 'ASOS Weather Station',
    description: 'Long Beach Airport - southeastern coastal wind reference',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'KSMO',
    lat: 34.0158,
    lng: -118.4513,
    name: 'Santa Monica Airport',
    type: 'AWOS Weather Station',
    description: 'Santa Monica Airport - near-shore wind conditions',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'KTOA',
    lat: 33.8034,
    lng: -118.3396,
    name: 'Torrance Airport',
    type: 'AWOS Weather Station',
    description: 'Torrance Airport - South Bay wind measurements',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'KVNY',
    lat: 34.2098,
    lng: -118.4898,
    name: 'Van Nuys Airport',
    type: 'ASOS Weather Station',
    description: 'Van Nuys Airport - San Fernando Valley wind conditions',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'inland'
  },
  
  // Coastal Weather Stations
  {
    id: 'POINT-DUME',
    lat: 34.080,
    lng: -118.800,
    name: 'Point Dume Area',
    type: 'Coastal Weather Station',
    description: 'Northwestern LA County coastal wind monitoring',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'PALOS-VERDES',
    lat: 33.750,
    lng: -118.400,
    name: 'Palos Verdes Peninsula',
    type: 'Coastal Weather Station',
    description: 'Southern LA County coastal wind monitoring',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  },
  {
    id: 'MALIBU-ZUMA',
    lat: 34.030,
    lng: -118.820,
    name: 'Malibu/Zuma Beach',
    type: 'Coastal Weather Station',
    description: 'Northwestern coastal wind monitoring for surf conditions',
    status: 'Active',
    dataSource: 'NOAA NWS',
    category: 'coastal'
  }
]

interface WindStationLayerProps {
  showLabels?: boolean
}

/**
 * Component to display wind measurement stations on the map
 * Shows the physical stations that likely provide wind data for surf forecasting
 */
export default function WindStationLayer({ showLabels = false }: WindStationLayerProps) {
  const map = useMap()
  const [windMarkers, setWindMarkers] = useState<L.CircleMarker[]>([])

  useEffect(() => {
    if (!map) return

    // Create wind station markers
    const markers: L.CircleMarker[] = WIND_STATIONS.map((station) => {
      // All wind stations use blue color for consistency
      const getStationColor = (category: string) => {
        return '#0066cc' // Blue for all wind measurement stations
      }

      const marker = L.circleMarker([station.lat, station.lng], {
        radius: 4,
        fillColor: getStationColor(station.category),
        color: '#ffffff',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.85,
      })

      // Add popup with station info
      const popupContent = `
        <div style="text-align: center; min-width: 200px;">
          <strong style="color: ${getStationColor(station.category)};">${station.name}</strong><br>
          <small style="color: #666; font-weight: 600;">${station.type}</small><br>
          <small style="color: ${station.status === 'Active' ? '#22c55e' : '#f59e0b'}; font-weight: 600;">${station.status}</small><br>
          <small>${station.description}</small><br>
          <small>Lat: ${station.lat.toFixed(3)}°N</small><br>
          <small>Lng: ${Math.abs(station.lng).toFixed(3)}°W</small><br>
          <small style="color: #666; margin-top: 4px; display: block;">
            Data Source: ${station.dataSource}
          </small>
        </div>
      `
      marker.bindPopup(popupContent)

      // Add hover effect
      marker.on('mouseover', function(this: L.CircleMarker) {
        this.setRadius(6)
        this.setStyle({ fillOpacity: 1, opacity: 1 })
      })
      
      marker.on('mouseout', function(this: L.CircleMarker) {
        this.setRadius(4)
        this.setStyle({ 
          fillOpacity: 0.85, 
          opacity: 0.9 
        })
      })

      // Add click effect
      marker.on('click', function(this: L.CircleMarker) {
        // Temporarily increase size to show click feedback
        this.setRadius(7)
        this.setStyle({ fillColor: '#ffff00', fillOpacity: 1, opacity: 1 })
        
        // Reset after a short delay
        setTimeout(() => {
          this.setRadius(4)
          this.setStyle({ 
            fillColor: getStationColor(station.category),
            fillOpacity: 0.85, 
            opacity: 0.9 
          })
        }, 300)
      })

      return marker
    })

    // Add markers to map
    markers.forEach(marker => marker.addTo(map))
    setWindMarkers(markers)

    // Cleanup function
    return () => {
      markers.forEach(marker => {
        if (map.hasLayer(marker)) {
          map.removeLayer(marker)
        }
      })
    }
  }, [map])

  // Add labels if requested
  useEffect(() => {
    if (!map || !showLabels) return

    const labels: L.Marker[] = WIND_STATIONS.map((station) => {
      const label = L.marker([station.lat, station.lng], {
        icon: L.divIcon({
          className: styles.windStationLabel,
          html: `<div style="
            background: rgba(0, 102, 204, 0.9);
            color: white;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            white-space: nowrap;
            border: 1px solid white;
            max-width: 60px;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${station.id}</div>`,
          iconSize: [60, 16],
          iconAnchor: [30, 8]
        })
      })

      return label
    })

    // Add labels to map
    labels.forEach(label => label.addTo(map))

    // Cleanup function
    return () => {
      labels.forEach(label => {
        if (map.hasLayer(label)) {
          map.removeLayer(label)
        }
      })
    }
  }, [map, showLabels])

  return null
}
