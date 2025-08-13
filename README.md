# LA Surf Conditions

Real-time surf condition visualization for Los Angeles County coastline, powered by NOAA wave data.

## Features

- 🗺️ **Interactive Map**: Fullscreen map with custom tiles and zoom controls
- 🏄 **Section-Based View**: 12 distinct coastal sections from Oxnard to Palos Verdes
- 🌊 **Live Wave Data**: NOAA WAVEWATCH III integration with quality scoring
- 🎨 **Color-Coded Coastline**: Red (poor) to green (excellent) surf conditions
- 📊 **Section Ribbon**: Top bar showing all sections with scores and wave heights
- 🔄 **Auto-refresh**: Updates every 20 minutes with caching
- 📱 **Responsive**: Works on desktop and mobile

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Mapping**: React Leaflet with custom MapTiler tiles
- **Data**: NOAA WAVEWATCH III via ERDDAP API
- **Caching**: Server-side with Node-cache

## Quick Start

```bash
git clone https://github.com/yourusername/la-surf.git
cd la-surf
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/la-surf)

## How It Works

**Quality Algorithm**: Combines wave height (40%), period (35%), and wind speed (25%) from NOAA data into scores of 0-100.

**Coastal Sections**: 12 sections from Oxnard to Palos Verdes, each with averaged wave data and quality scores.

**Data**: NOAA WAVEWATCH III via ERDDAP API, cached for 20 minutes, auto-refreshes.

---

Made by [Sam Guyette](https://www.samguyette.com) • Data: NOAA • For informational purposes only
