'use client'

import { useEffect, useState } from 'react'

interface RefreshIndicatorProps {
  lastUpdate: Date | null
  isRefreshing: boolean
  error: string | null
  onRefresh: () => void
}

/**
 * Component that shows data refresh status and next update countdown
 */
export default function RefreshIndicator({ 
  lastUpdate, 
  isRefreshing, 
  error, 
  onRefresh 
}: RefreshIndicatorProps) {
  const [timeUntilNext, setTimeUntilNext] = useState<string>('')

  useEffect(() => {
    if (!lastUpdate) return

    const updateCountdown = () => {
      const now = new Date()
      const nextUpdate = new Date(lastUpdate.getTime() + 20 * 60 * 1000) // 20 minutes from last update
      const timeLeft = nextUpdate.getTime() - now.getTime()

      if (timeLeft <= 0) {
        setTimeUntilNext('Updating...')
      } else {
        const minutes = Math.floor(timeLeft / 60000)
        const seconds = Math.floor((timeLeft % 60000) / 1000)
        setTimeUntilNext(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [lastUpdate])

  const formatLastUpdate = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  const handleRefreshClick = () => {
    if (!isRefreshing) {
      onRefresh()
    }
  }

  return (
    <div className={`refresh-indicator ${isRefreshing ? 'updating' : ''}`}>
      {isRefreshing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div 
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}
          />
          Updating wave data...
        </div>
      ) : (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: 'pointer'
          }}
          onClick={handleRefreshClick}
          title="Click to refresh now"
        >
          <div>
            {lastUpdate ? (
              <>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  Last update: {formatLastUpdate(lastUpdate)}
                </div>
                <div style={{ fontSize: '10px', opacity: 0.7 }}>
                  Next update: {timeUntilNext}
                </div>
              </>
            ) : (
              <div style={{ fontSize: '11px' }}>
                No data available
              </div>
            )}
          </div>
          
          <div 
            style={{
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.7,
              fontSize: '12px'
            }}
          >
            ↻
          </div>
        </div>
      )}
      
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
