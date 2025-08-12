'use client'

interface RefreshIndicatorProps {
  lastUpdate: Date | null
  error: string | null
}

/**
 * Component that shows when data was last refreshed
 */
export default function RefreshIndicator({ 
  lastUpdate, 
  error
}: RefreshIndicatorProps) {
  const formatLastUpdate = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
  }

  return (
    <div className="refresh-indicator">
      <div>
        {lastUpdate ? (
          <div style={{ fontSize: '11px', opacity: 0.8 }}>
            Last update: {formatLastUpdate(lastUpdate)}
          </div>
        ) : (
          <div style={{ fontSize: '11px' }}>
            No data available
          </div>
        )}
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
