// Short comment: single source of truth for section metadata to prevent drift across API and UI
export const SECTION_LOCATION_FACTOR: Record<string, number> = {
  'Malibu Point/Surfrider': 1.2,
  'Palos Verdes Peninsula': 1.15,
  'Zuma/Point Dume': 1.1,
  'Oxnard/Ventura County': 1.05,
  'Malibu Creek/Big Rock': 1.0,
  'Topanga/Sunset Point': 0.95,
  'Hermosa/Redondo Beach': 0.9,
  'Manhattan Beach/Hermosa': 0.9,
  'Redondo/Palos Verdes': 0.95,
  'Will Rogers/Santa Monica': 0.8,
  'Santa Monica Pier/Venice': 0.7,
  'Venice/El Segundo': 0.75,
}

export const SECTION_CHARACTERISTICS: Record<string, {
  heightMultiplier: number
  periodMultiplier: number
  directionOffset: number
  windOffset: number
  tempOffset: number
}> = {
  'Oxnard/Ventura County': { heightMultiplier: 1.15, periodMultiplier: 1.1, directionOffset: -8, windOffset: 3, tempOffset: -2 },
  'Zuma/Point Dume': { heightMultiplier: 1.1, periodMultiplier: 1.05, directionOffset: -5, windOffset: 1, tempOffset: -1 },
  'Malibu Point/Surfrider': { heightMultiplier: 1.0, periodMultiplier: 1.0, directionOffset: 0, windOffset: -2, tempOffset: 0 },
  'Malibu Creek/Big Rock': { heightMultiplier: 0.95, periodMultiplier: 0.98, directionOffset: 2, windOffset: -1, tempOffset: 0 },
  'Topanga/Sunset Point': { heightMultiplier: 0.9, periodMultiplier: 0.95, directionOffset: 5, windOffset: 0, tempOffset: 1 },
  'Will Rogers/Santa Monica': { heightMultiplier: 0.85, periodMultiplier: 0.92, directionOffset: 8, windOffset: 2, tempOffset: 1 },
  'Santa Monica Pier/Venice': { heightMultiplier: 0.8, periodMultiplier: 0.9, directionOffset: 10, windOffset: 3, tempOffset: 2 },
  'Venice/El Segundo': { heightMultiplier: 0.85, periodMultiplier: 0.88, directionOffset: 12, windOffset: 4, tempOffset: 2 },
  'Manhattan Beach/Hermosa': { heightMultiplier: 0.9, periodMultiplier: 0.9, directionOffset: 15, windOffset: 3, tempOffset: 2 },
  'Hermosa/Redondo Beach': { heightMultiplier: 0.88, periodMultiplier: 0.88, directionOffset: 18, windOffset: 4, tempOffset: 3 },
  'Redondo/Palos Verdes': { heightMultiplier: 0.92, periodMultiplier: 0.9, directionOffset: 20, windOffset: 2, tempOffset: 2 },
  'Palos Verdes Peninsula': { heightMultiplier: 1.05, periodMultiplier: 1.0, directionOffset: 25, windOffset: 0, tempOffset: 1 },
}


