'use client'

import dynamic from 'next/dynamic'

// Dynamically import the SurfMap component to avoid SSR issues with Leaflet
const SurfMap = dynamic(() => import('@/components/SurfMap'), {
  ssr: false,
  loading: () => <LoadingFallback />
})

// Simple fallback component
function LoadingFallback() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f8f9fa'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '50%',
        borderTopColor: '#3498db',
        animation: 'spin 1s ease-in-out infinite'
      }}>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <main className="fullscreen">
      <SurfMap />
    </main>
  )
}
