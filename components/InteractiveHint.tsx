'use client'

import { useState, useEffect } from 'react'

interface InteractiveHintProps {
  onDismiss?: () => void
}

/**
 * Component that shows a helpful hint about coastline interactivity
 * Auto-dismisses after a delay or when user interacts with the map
 */
export default function InteractiveHint({ onDismiss }: InteractiveHintProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if user has already dismissed this hint (localStorage)
    const dismissed = localStorage.getItem('surf-map-hint-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
      return
    }

    // Show hint after a short delay to let the map load
    const showTimer = setTimeout(() => {
      setIsVisible(true)
    }, 2000)

    // Auto-hide after 8 seconds
    const hideTimer = setTimeout(() => {
      setIsVisible(false)
    }, 10000)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('surf-map-hint-dismissed', 'true')
    onDismiss?.()
  }

  if (isDismissed || !isVisible) {
    return null
  }

  return (
    <div className="interactive-hint">
      <div className="interactive-hint-content">
        <span className="interactive-hint-icon">👆</span>
        <span className="interactive-hint-text">
          Click the coastline to view surf conditions
        </span>
        <button
          className="interactive-hint-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss hint"
        >
          ×
        </button>
      </div>
    </div>
  )
}
