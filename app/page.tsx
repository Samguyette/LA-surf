'use client'

import dynamic from 'next/dynamic'

// Dynamically import the SurfMap component to avoid SSR issues with Leaflet
const SurfMap = dynamic(() => import('@/components/SurfMap'), {
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f8f9fa'
    }}>
      <div className="loading-spinner"></div>
    </div>
  )
})

export default function Home() {
  return (
    <main style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <SurfMap />
    </main>
  )
}
