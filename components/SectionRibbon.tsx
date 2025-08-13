'use client'

import { useMemo } from 'react'
import { WaveDataPoint } from '@/types/wave-data'
import { getQualityColor, getWaveQualityLevel } from '@/utils/waveQuality'
import { COASTLINE_SECTIONS } from '@/data/coastlineSections'
import styles from './SectionRibbon.module.css'

interface SectionRibbonProps {
  waveData: WaveDataPoint[]
  mapCenter?: { lat: number; lng: number }
}

interface SectionInfo {
  name: string
  bounds: { north: number; south: number; west: number; east: number }
  avgQualityScore: number
  avgWaveHeight: number
  pointCount: number
}

/**
 * Component that displays a ribbon at the top showing all sections with
 * their names, quality indicators, and average wave heights
 */
export default function SectionRibbon({ waveData, mapCenter }: SectionRibbonProps) {
  // Short comment: memoize derived sections to avoid recalculation on render; mapCenter dependency kept to match original change pattern
  const allSections = useMemo<SectionInfo[]>(() => {
    if (!waveData || waveData.length === 0) {
      return []
    }

    const sectionData: { [key: string]: WaveDataPoint[] } = {}
    
    waveData.forEach(point => {
      const sectionKey = point.id.split('-').slice(0, -1).join('-')
      if (!sectionData[sectionKey]) {
        sectionData[sectionKey] = []
      }
      sectionData[sectionKey].push(point)
    })

    const sections: SectionInfo[] = Object.entries(sectionData).map(([key, points]) => {
      const matchingSection = COASTLINE_SECTIONS.find(s => 
        s.name.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-') === key
      )
      
      const sectionName = matchingSection?.name || key.replace(/-/g, ' ')

      const avgQualityScore = points.reduce((sum, p) => sum + p.qualityScore, 0) / points.length
      const avgWaveHeight = points.reduce((sum, p) => sum + p.waveHeight, 0) / points.length

      return {
        name: sectionName,
        bounds: matchingSection?.bounds || { north: 0, south: 0, west: 0, east: 0 },
        avgQualityScore: Math.round(avgQualityScore),
        avgWaveHeight: Math.round(avgWaveHeight * 10) / 10,
        pointCount: points.length
      }
    })

    return sections.sort((a, b) => {
      const aIndex = COASTLINE_SECTIONS.findIndex(s => s.name === a.name)
      const bIndex = COASTLINE_SECTIONS.findIndex(s => s.name === b.name)
      return aIndex - bIndex
    })
  }, [waveData, mapCenter])

  if (allSections.length === 0) {
    return null
  }

  return (
    <>
      <div className={styles.sectionRibbon}>
        <div className={styles.sectionRibbonContent}>
          <div className={styles.sectionsContainer}>
            {allSections.map((section, index) => {
              const qualityLevel = getWaveQualityLevel(section.avgQualityScore)
              const qualityColor = getQualityColor(section.avgQualityScore)
              
              return (
                <div 
                  key={section.name} 
                  className={styles.sectionItem}
                >
                  <div 
                    className={styles.qualityDot} 
                    style={{ backgroundColor: qualityColor }}
                    title={`${section.avgQualityScore}/100 (${qualityLevel.toUpperCase()})`}
                  />
                  <div className={styles.sectionText}>
                    <h3 className={styles.sectionName}>
                      {section.name
                        .split('/')
                        .map(part =>
                          part
                            .trim()
                            .split(' ')
                            .map(
                              word =>
                                word.charAt(0).toUpperCase() + word.slice(1)
                            )
                            .join(' ')
                        )
                        .join(' - ')}
                    </h3>
                    <div className={styles.sectionStats}>
                      <span className={styles.waveHeight}>{section.avgWaveHeight}ft</span>
                      <span className={styles.qualityScore}>{section.avgQualityScore}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      <div className="attribution">
        <a 
          href="https://www.samguyette.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="attributionLink"
        >
          Made by Sam Guyette
        </a>
      </div>
    </>
  )
}
