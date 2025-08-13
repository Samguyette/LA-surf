export const SECTION_LOCATION_FACTOR: Record<string, number> = {
  'Oxnard/Ventura County': 1.15,        // increased from 1.05
  'Zuma/Point Dume': 1.20,             // increased from 1.10
  'Malibu Point/Surfrider': 1.30,      // increased from 1.20
  'Malibu Creek/Big Rock': 0.95,       // lowered from 1.00
  'Topanga/Sunset Point': 0.90,        // lowered from 0.95
  'Will Rogers/Santa Monica': 0.70,    // lowered from 0.80
  'Santa Monica Pier/Venice': 0.60,    // lowered from 0.70
  'Venice/El Segundo': 0.65,           // lowered from 0.75
  'Manhattan Beach/Hermosa': 1.05,     // raised from 0.90
  'Hermosa/Redondo Beach': 0.85,       // lowered from 0.90
  'Redondo/Palos Verdes': 1.05,        // raised from 0.95 (captures SV swell into PV)
  'Palos Verdes Peninsula': 1.20       // raised from 1.15
}

export const SECTION_CHARACTERISTICS: Record<string, {
  heightMultiplier: number
  periodMultiplier: number
  directionOffset: number
  windOffset: number
}> = {
  'Oxnard/Ventura County':       { heightMultiplier: 1.20, periodMultiplier: 1.15, directionOffset: -10, windOffset: +4 },
  'Zuma/Point Dume':             { heightMultiplier: 1.15, periodMultiplier: 1.10, directionOffset: -8,  windOffset: +2 },
  'Malibu Point/Surfrider':      { heightMultiplier: 1.05, periodMultiplier: 1.05, directionOffset: -2,  windOffset: -3 },
  'Malibu Creek/Big Rock':       { heightMultiplier: 0.90, periodMultiplier: 0.95, directionOffset: +2,  windOffset: -2 },
  'Topanga/Sunset Point':        { heightMultiplier: 0.85, periodMultiplier: 0.90, directionOffset: +5,  windOffset: +1 },
  'Will Rogers/Santa Monica':    { heightMultiplier: 0.80, periodMultiplier: 0.88, directionOffset: +10, windOffset: +3 },
  'Santa Monica Pier/Venice':    { heightMultiplier: 0.75, periodMultiplier: 0.85, directionOffset: +12, windOffset: +4 },
  'Venice/El Segundo':           { heightMultiplier: 0.80, periodMultiplier: 0.83, directionOffset: +15, windOffset: +5 },
  'Manhattan Beach/Hermosa':     { heightMultiplier: 1.00, periodMultiplier: 0.85, directionOffset: +18, windOffset: +4 },
  'Hermosa/Redondo Beach':       { heightMultiplier: 0.85, periodMultiplier: 0.85, directionOffset: +20, windOffset: +5 },
  'Redondo/Palos Verdes':        { heightMultiplier: 0.90, periodMultiplier: 0.88, directionOffset: +22, windOffset: +3 },
  'Palos Verdes Peninsula':      { heightMultiplier: 1.10, periodMultiplier: 1.05, directionOffset: +30, windOffset: -1 }
}
