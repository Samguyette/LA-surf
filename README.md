# LA Surf Conditions

A production-ready Next.js application that provides real-time surf condition visualization for Los Angeles County coastline, powered by NOAA's WAVEWATCH III wave model data.

![LA Surf Conditions](https://via.placeholder.com/800x400/007bff/ffffff?text=LA+Surf+Conditions+Map)

## Features

- 🗺️ **Interactive Map**: Fullscreen map centered on LA County with zoom controls
- 🌊 **Real-time Wave Data**: Live NOAA WAVEWATCH III wave model integration
- 🎨 **Gradient Coastline**: Color-coded coastline showing surf quality from red (poor) to green (excellent)
- 📊 **Quality Scoring**: Scientific algorithm based on wave height, period, and wind conditions
- 💬 **Interactive Tooltips**: Hover over coastline to see detailed wave conditions
- 🔄 **Auto-refresh**: Data updates every 20 minutes automatically
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Performance**: Server-side caching and optimized API calls

## Live Demo

Deploy to Vercel: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/la-surf)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Mapping**: React Leaflet + Leaflet.js
- **Tiles**: OpenStreetMap
- **Data Source**: NOAA WAVEWATCH III via ERDDAP
- **Caching**: Node-cache (server-side)
- **Deployment**: Vercel

## Quick Start

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/la-surf.git
   cd la-surf
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Environment Variables

Create a `.env.local` file in the root directory:

```env
# NOAA API Configuration (optional - defaults provided)
NOAA_API_BASE_URL=https://coastwatch.pfeg.noaa.gov/erddap

# Add API keys here if needed in the future
# NOAA_API_KEY=your_key_here
```

## Deployment

### Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/la-surf.git
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Deploy (no additional configuration needed)

3. **Set Environment Variables** (if needed)
   - Go to your Vercel project settings
   - Add environment variables under "Environment Variables"

### Other Platforms

The app is a standard Next.js application and can be deployed to:
- Netlify
- AWS Amplify
- Google Cloud Platform
- Self-hosted with Docker

## Wave Quality Algorithm

The surf quality scoring system is based on three key NOAA variables:

### Variables Used

1. **Significant Wave Height** (40% weight)
   - Source: NOAA WAVEWATCH III `htsgwsfc`
   - Optimal: 2-6 feet
   - Good: 6-8 feet
   - Poor: <2 feet or >8 feet

2. **Wave Period** (35% weight)
   - Source: NOAA WAVEWATCH III `perpwsfc`
   - Excellent: 12-16 seconds (groundswell)
   - Good: 8-12 seconds
   - Poor: <8 seconds (wind waves)

3. **Wind Speed** (25% weight)
   - Calculated from: U/V wind components (`ugrdsfc`, `vgrdsfc`)
   - Excellent: 0-5 knots (glass-off conditions)
   - Good: 5-10 knots
   - Poor: >15 knots (blown out)

### Scoring Formula

```typescript
qualityScore = (
  waveHeightScore * 0.40 +
  wavePeriodScore * 0.35 +
  windSpeedScore * 0.25
) * 100
```

### Quality Levels

- **Excellent** (80-100): Green - Perfect surfing conditions
- **Good** (60-79): Yellow-Green - Great for most surfers
- **Fair** (40-59): Yellow - Surfable but not ideal
- **Poor** (0-39): Red - Not recommended

## Data Sources

### NOAA WAVEWATCH III

The application uses NOAA's Wave Ensemble Reforecast model via the ERDDAP data server:

- **Dataset**: NWW3_Global_Best
- **Endpoint**: `https://coastwatch.pfeg.noaa.gov/erddap/griddap/`
- **Spatial Resolution**: ~0.5° grid
- **Temporal Resolution**: 3-hour forecasts
- **Coverage**: Global ocean waves

### Coastline Data

Custom coastline coordinate array with 54 points along LA County coast:
- Spans from Leo Carrillo (Malibu) to Seal Beach
- Includes major surf breaks and beaches
- Points spaced ~1-2 miles apart for detailed visualization

## Configuration

### Adjusting County Bounds

To change the map boundaries, edit `/data/coastline.ts`:

```typescript
// Modify these coordinates in getCoastlineBounds()
const bounds = {
  north: 34.3,  // Northern boundary
  south: 33.7,  // Southern boundary
  east: -118.1, // Eastern boundary
  west: -118.7  // Western boundary
}
```

### Changing Refresh Interval

To modify the data refresh rate, update the interval in `/components/SurfMap.tsx`:

```typescript
// Current: 20 minutes (20 * 60 * 1000)
const interval = setInterval(() => {
  fetchWaveData(true)
}, 20 * 60 * 1000) // Change this value
```

Also update the cache duration in `/app/api/wave-data/route.ts`:

```typescript
// Current: 20 minutes (1200 seconds)
const cache = new NodeCache({ stdTTL: 1200 }) // Change this value
```

### Customizing Wave Quality Algorithm

Modify weights and optimal ranges in `/utils/waveQuality.ts`:

```typescript
const WAVE_QUALITY_CONFIG: WaveQualityConfig = {
  weights: {
    waveHeight: 0.40,  // Adjust weights (must sum to 1.0)
    wavePeriod: 0.35,
    windSpeed: 0.25
  },
  optimal: {
    minWaveHeight: 2.0,    // Adjust optimal ranges
    maxWaveHeight: 8.0,
    minWavePeriod: 8.0,
    maxWavePeriod: 16.0,
    maxWindSpeed: 15.0
  }
}
```

## API Reference

### GET /api/wave-data

Returns current wave conditions for LA County coastline.

**Response:**
```json
{
  "data": [
    {
      "id": "point-0",
      "lat": 34.1157,
      "lng": -118.9011,
      "waveHeight": 3.2,
      "wavePeriod": 9.5,
      "waveDirection": 245,
      "windSpeed": 8.3,
      "waterTemp": 64.2,
      "qualityScore": 75,
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "cached": false,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Caching:**
- Data is cached for 20 minutes
- Returns cached data if NOAA API is unavailable
- Cache miss triggers fresh NOAA API call

## Performance

- **Server-side caching**: 20-minute cache reduces API calls
- **Client-side optimization**: Dynamic imports for Leaflet components
- **Efficient rendering**: Polyline segments with optimized colors
- **Error handling**: Graceful fallbacks to cached data

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **NOAA**: Wave data provided by National Oceanic and Atmospheric Administration
- **OpenStreetMap**: Map tiles and geographic data
- **React Leaflet**: Interactive mapping library
- **Vercel**: Hosting and deployment platform

## Support

For questions or issues:
- Create an issue on GitHub
- Check the [documentation](README.md)
- Review the [API documentation](#api-reference)

---

**Note**: This application is for informational purposes only. Always check official marine forecasts and local conditions before entering the water.
