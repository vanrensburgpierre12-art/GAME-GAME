# Frontend Map (React + Mapbox)

A React application with Mapbox GL JS for displaying and interacting with parcels on a map.

## Features

- Interactive map using Mapbox GL JS
- Fetches parcels on map movement with bounding box queries
- Displays parcels as GeoJSON layers (fill + outline)
- Click parcels to view details in popup
- Buy parcels directly from the map
- Basic UI controls (zoom in/out, reset view)
- Clean, modular component structure

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Add your Mapbox token to `.env`:
```
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_URL=http://localhost:3002
VITE_MARKETPLACE_URL=http://localhost:3003
```

4. Start development server:
```bash
npm run dev
```

5. Build for production:
```bash
npm run build
```

## Environment Variables

- `VITE_MAPBOX_TOKEN` (required) - Your Mapbox access token
- `VITE_API_URL` (optional) - Parcels API URL (default: http://localhost:3002)
- `VITE_MARKETPLACE_URL` (optional) - Marketplace API URL (default: http://localhost:3003)

## Component Structure

### MapView.jsx
Main map component that:
- Initializes Mapbox map
- Handles map movement and fetches parcels
- Displays parcels as GeoJSON layers
- Handles parcel clicks and shows popup

### ParcelPopup.jsx
Popup component displaying:
- Parcel ID
- Owner ID (or "Unowned")
- Price in cents
- Buy button

### MapControls.jsx
UI controls for:
- Zoom in/out
- Reset view
- Loading indicator

## Usage

### Basic Usage

```jsx
import MapView from './MapView';

function App() {
  const authToken = 'your-jwt-token';
  
  return (
    <MapView 
      authToken={authToken}
      onBuySuccess={(parcelId) => {
        console.log('Parcel purchased:', parcelId);
      }}
    />
  );
}
```

### Props

#### MapView
- `authToken` (string, optional) - JWT token for authentication
- `onBuySuccess` (function, optional) - Callback when parcel is purchased

## API Integration

The component integrates with:
- **Parcels API** (`GET /parcels?bbox=...`) - Fetches parcels within bounding box
- **Marketplace API** (`POST /market/buy/:parcel_id`) - Buys a parcel

## Map Behavior

- **Initial View**: San Francisco (center: -122.4194, 37.7749, zoom: 12)
- **Debounced Loading**: Parcels are fetched 300ms after map movement stops
- **Auto-refresh**: Parcels reload after successful purchase

## Styling

- Parcels are displayed with blue fill (30% opacity) and blue outline
- Hover cursor changes to pointer over parcels
- Popup shows parcel details with buy button

## Development

### Adding Authentication

In a real application, you would integrate with your auth system:

```jsx
import { useAuth } from './hooks/useAuth';

function App() {
  const { token } = useAuth();
  
  return <MapView authToken={token} />;
}
```

### Customizing Map Style

Change the map style in `MapView.jsx`:

```jsx
map.current = new mapboxgl.Map({
  // ...
  style: 'mapbox://styles/mapbox/satellite-v9', // Change style
  // ...
});
```

### Customizing Parcel Colors

Modify the layer paint properties in `MapView.jsx`:

```jsx
map.current.addLayer({
  id: 'parcels-fill',
  // ...
  paint: {
    'fill-color': '#ff0000', // Change color
    'fill-opacity': 0.5,     // Change opacity
  },
});
```

## Troubleshooting

### Map not loading
- Verify `VITE_MAPBOX_TOKEN` is set in `.env`
- Check browser console for errors
- Ensure Mapbox token has correct permissions

### Parcels not showing
- Verify Parcels API is running on correct port
- Check network tab for API requests
- Verify CORS is enabled on backend

### Buy button not working
- Ensure `authToken` prop is provided
- Verify Marketplace API is running
- Check authentication token is valid

## Dependencies

- `react` - React library
- `react-dom` - React DOM
- `mapbox-gl` - Mapbox GL JS
- `axios` - HTTP client
- `vite` - Build tool

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

ISC

