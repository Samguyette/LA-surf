'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './RefreshIndicator.module.css'

interface RefreshIndicatorProps {
  lastUpdate: Date | null
  measurementTime?: Date | null
  error: string | null
  nextRefresh?: Date | null
  onRefresh?: () => void
  isRefreshing?: boolean
}

/**
 * Component that shows when data was last refreshed with countdown timer
 */
export default function RefreshIndicator({ 
  lastUpdate, 
  measurementTime,
  error,
  nextRefresh,
  onRefresh,
  isRefreshing = false
}: RefreshIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [showRefreshTooltip, setShowRefreshTooltip] = useState(false)
  const [countdown, setCountdown] = useState<string>('')

  const formatLastUpdate = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const formatMeasurementTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const updateCountdown = useCallback(() => {
    if (!nextRefresh) {
      setCountdown('')
      return
    }

    // Calculate time difference once and display as static
    const now = Date.now()
    const nextTime = nextRefresh.getTime()
    const diff = nextTime - now

    if (diff <= 0) {
      setCountdown('Now')
      return
    }

    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    if (minutes > 0) {
      setCountdown(`${minutes}m ${seconds}s`)
    } else {
      setCountdown(`${seconds}s`)
    }
  }, [nextRefresh])

  useEffect(() => {
    // Only update countdown when nextRefresh changes, not every second
    updateCountdown()
  }, [updateCountdown])

  return (
    <div className={styles.refreshIndicator}>
      <div 
        className={styles.container}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Primary timestamp - measurement time */}
        {measurementTime ? (
          <div className={styles.primaryInfo}>
            <span className={`${styles.statusDot} ${styles.statusDotGreen}`} />
            <span className={styles.label}>Data measured:</span>
            <span className={styles.value}>{formatMeasurementTime(measurementTime)}</span>
          </div>
        ) : lastUpdate ? (
          <div className={styles.primaryInfo}>
            <span className={`${styles.statusDot} ${styles.statusDotYellow}`} />
            <span className={styles.label}>Last update:</span>
            <span className={styles.value}>{formatLastUpdate(lastUpdate)}</span>
          </div>
        ) : (
          <div className={styles.primaryInfoNoData}>
            <span className={`${styles.statusDot} ${styles.statusDotGray}`} />
            No data available
          </div>
        )}
        
        {/* Secondary info row */}
        <div className={styles.secondaryRow}>
          <div className={styles.secondaryInfo}>
            {/* API fetch time as secondary info if we have measurement time */}
            {measurementTime && lastUpdate && (
              <div className={styles.fetchInfo}>
                Fetched: {formatLastUpdate(lastUpdate)}
              </div>
            )}
            
            {/* Countdown timer */}
            {countdown && (
              <div className={styles.countdown}>
                Next: {countdown}
              </div>
            )}
          </div>
          
          {/* Info button */}
          <div className={styles.infoButtonContainer}>
            <button
              className={styles.infoButton}
              aria-label="Show map usage guide and surf quality info"
              onClick={() => setShowTooltip(!showTooltip)}
            >
              i
            </button>
          </div>
        </div>
        
        {/* Tooltip - positioned relative to entire container */}
        {showTooltip && (
          <div className={styles.tooltip}>
            <div className={styles.tooltipTitle}>
              How to Use This Map
            </div>
            
            {/* Interactive Features Section */}
            <div className={styles.tooltipSection}>
              <div className={styles.tooltipSectionTitle}>
                Interactive Features
              </div>
              <div className={styles.tooltipDescription}>
                <strong>Coastline:</strong> Click anywhere along the colored coastline to view detailed wave conditions, including wave height, period, wind speed, and quality score for that specific location.
              </div>
              <div className={styles.tooltipDescription}>
                <strong>Section Ribbon:</strong> Click any section in the top ribbon to highlight and focus on that coastal area. Each section shows average wave height and quality score.
              </div>
            </div>

            {/* Surf Quality Grading Section */}
            <div className={styles.tooltipSection}>
              <div className={styles.tooltipSectionTitle}>
                Surf Quality Grading
              </div>
              <div className={styles.tooltipDescription}>
                Scores are based on wave height, period, wind speed, and location quality:
              </div>
              <div className={styles.tooltipGrades}>
                <div className={styles.tooltipGrade}>
                  <span className={`${styles.gradeRange} ${styles.gradeRangeExcellent}`}>75-100:</span> 
                  <span className={styles.gradeDescription}>Excellent conditions</span>
                </div>
                <div className={styles.tooltipGrade}>
                  <span className={`${styles.gradeRange} ${styles.gradeRangeGood}`}>55-74:</span> 
                  <span className={styles.gradeDescription}>Good surf</span>
                </div>
                <div className={styles.tooltipGrade}>
                  <span className={`${styles.gradeRange} ${styles.gradeRangeFair}`}>35-54:</span> 
                  <span className={styles.gradeDescription}>Fair conditions</span>
                </div>
                <div className={styles.tooltipGrade}>
                  <span className={`${styles.gradeRange} ${styles.gradeRangePoor}`}>0-34:</span> 
                  <span className={styles.gradeDescription}>Poor surf</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
