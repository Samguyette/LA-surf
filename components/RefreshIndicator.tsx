'use client'

import { useState, useEffect, useCallback } from 'react'

interface RefreshIndicatorProps {
  lastUpdate: Date | null
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
    <div className="refresh-indicator">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {lastUpdate ? (
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            Last update: {formatLastUpdate(lastUpdate)}
          </div>
        ) : (
          <div style={{ fontSize: '11px' }}>
            No data available
          </div>
        )}
        
        {/* Countdown timer */}
        {countdown && (
          <div style={{ 
            fontSize: '10px', 
            opacity: 0.7,
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '2px 6px',
            borderRadius: '10px'
          }}>
            Next: {countdown}
          </div>
        )}
        
        {/* Info button */}
        <div style={{ position: 'relative' }}>
          <button
            className="info-button"
            aria-label="Show grading info"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '9px',
              color: 'white'
            }}
          >
            i
          </button>
          
          {/* Tooltip */}
          {showTooltip && (
            <div className="grading-info-tooltip">
              <div style={{ fontWeight: '600', marginBottom: '6px', fontSize: '12px' }}>
                Surf Quality Grading
              </div>
              <div style={{ fontSize: '10px', lineHeight: '1.4', marginBottom: '6px' }}>
                Scores are based on wave height, period, wind speed, and location quality:
              </div>
              <div style={{ fontSize: '9px', lineHeight: '1.3' }}>
                <div><strong>75-100:</strong> Excellent conditions</div>
                <div><strong>55-74:</strong> Good surf</div>
                <div><strong>35-54:</strong> Fair conditions</div>
                <div><strong>0-34:</strong> Poor surf</div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div style={{ 
          fontSize: '10px', 
          color: '#ffeb3b',
          marginTop: '4px',
          opacity: 0.9
        }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
