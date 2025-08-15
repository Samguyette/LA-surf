'use client'

import { useState } from 'react'
import styles from './StationInfo.module.css'

/**
 * Component to display station information button and panel
 * Shows information about wave buoys and wind measurement stations
 */
export default function StationInfo() {
  const [showStationInfo, setShowStationInfo] = useState(false)

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
        </div>
      )}
    </>
  )
}
