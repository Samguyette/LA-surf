'use client'

import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import styles from './BuoyLayer.module.css'

// Open-Meteo API data collection points used for wave forecasting
const OPEN_METEO_LOCATIONS = [
  {
    id: 'OM-1',
    lat: 33.755,
    lng: -119.045,
    name: 'Santa Monica Basin',
    type: 'Open-Meteo API Point',
    description: 'Wave data collection point for Santa Monica Basin area',
    status: 'Active',
    dataSource: 'Open-Meteo'
  },
  {
    id: 'OM-2',
    lat: 34.241,
    lng: -119.839,
    name: 'Santa Barbara',
    type: 'Open-Meteo API Point',
    description: 'Wave data collection point for Santa Barbara area',
    status: 'Active',
    dataSource: 'Open-Meteo'
  },
  {
    id: 'OM-3',
    lat: 34.274,
    lng: -120.468,
    name: 'West Santa Barbara',
    type: 'Open-Meteo API Point',
    description: 'Wave data collection point for West Santa Barbara area',
    status: 'Active',
    dataSource: 'Open-Meteo'
  }
]

interface BuoyLayerProps {
  showLabels?: boolean
}

/**
 * Component to display Open-Meteo API data collection points on the map
 * Shows the three grid points used for wave forecasting in the LA area
 */
export default function BuoyLayer({ showLabels = false }: BuoyLayerProps) {
  const map = useMap()
  const [buoyMarkers, setBuoyMarkers] = useState<L.CircleMarker[]>([])

  useEffect(() => {
    if (!map) return

    // Create buoy markers
    const markers: L.CircleMarker[] = OPEN_METEO_LOCATIONS.map((buoy) => {
      const marker = L.circleMarker([buoy.lat, buoy.lng], {
        radius: 5,
        fillColor: '#00aa66',
        color: '#ffffff',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.95,
      })

      // Add popup with buoy info
      const popupContent = `
        <div class="${styles.buoyPopup}">
          <strong class="${styles.buoyPopupTitle}">${buoy.name}</strong><br>
          <small class="${styles.buoyPopupType}">${buoy.type}</small><br>
          <small class="${styles.buoyPopupStatus}">${buoy.status}</small><br>
          <small class="${styles.buoyPopupDescription}">${buoy.description}</small><br>
          <small class="${styles.buoyPopupCoords}">Lat: ${buoy.lat.toFixed(3)}°N</small><br>
          <small class="${styles.buoyPopupCoords}">Lng: ${buoy.lng.toFixed(3)}°W</small><br>
          <small class="${styles.buoyPopupSource}">
            Data Source: ${buoy.dataSource}
          </small>
        </div>
      `
      marker.bindPopup(popupContent)

      // Add hover effect
      marker.on('mouseover', function(this: L.CircleMarker) {
        this.setRadius(7)
        this.setStyle({ fillOpacity: 1, opacity: 1 })
      })
      
      marker.on('mouseout', function(this: L.CircleMarker) {
        this.setRadius(5)
        this.setStyle({ 
          fillOpacity: 0.95, 
          opacity: 0.9 
        })
      })

      // Add click effect
      marker.on('click', function(this: L.CircleMarker) {
        // Temporarily increase size to show click feedback
        this.setRadius(8)
        this.setStyle({ fillColor: '#ff6600', fillOpacity: 1, opacity: 1 })
        
        // Reset after a short delay
        setTimeout(() => {
          this.setRadius(5)
          this.setStyle({ 
            fillColor: '#00aa66',
            fillOpacity: 0.95, 
            opacity: 0.9 
          })
        }, 300)
      })

      return marker
    })

    // Add markers to map
    markers.forEach(marker => marker.addTo(map))
    setBuoyMarkers(markers)

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

    const labels: L.Marker[] = OPEN_METEO_LOCATIONS.map((buoy) => {
      const label = L.marker([buoy.lat, buoy.lng], {
        icon: L.divIcon({
          className: styles.buoyLabel,
          html: `<div class="${styles.buoyLabelContent}">${buoy.id}</div>`,
          iconSize: [80, 20],
          iconAnchor: [40, 10]
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
