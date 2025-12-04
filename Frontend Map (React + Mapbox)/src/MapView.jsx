import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchParcels } from './utils/api';
import ParcelPopup from './components/ParcelPopup';
import MapControls from './components/MapControls';
import './MapView.css';

function MapView({ authToken, onBuySuccess }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState(null);
  const [popup, setPopup] = useState(null);
  const debounceTimer = useRef(null);

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || process.env.REACT_APP_MAPBOX_TOKEN;

  // Initialize map
  useEffect(() => {
    if (!mapboxToken) {
      console.error('Mapbox token is required. Set VITE_MAPBOX_TOKEN in .env file');
      return;
    }

    if (map.current) return; // Initialize map only once

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.4194, 37.7749], // San Francisco default
      zoom: 12,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      
      // Add empty GeoJSON source
      map.current.addSource('parcels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add circle layer for 3x3 meter parcels
      // Circle radius is interpolated to maintain ~3 meters on ground across zoom levels
      map.current.addLayer({
        id: 'parcels-circles',
        type: 'circle',
        source: 'parcels',
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 0.5,  // At zoom 10: very small (represents ~3m)
            12, 1,    // At zoom 12: 1 pixel
            15, 3,    // At zoom 15: 3 pixels
            18, 8,    // At zoom 18: 8 pixels
            20, 20,   // At zoom 20: 20 pixels
            22, 50,   // At zoom 22: 50 pixels
          ],
          'circle-color': '#007bff',
          'circle-opacity': 0.6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0056b3',
          'circle-stroke-opacity': 0.8,
        },
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'parcels-circles', () => {
        map.current.getCanvas().style.cursor = 'pointer';
      });

      map.current.on('mouseleave', 'parcels-circles', () => {
        map.current.getCanvas().style.cursor = '';
      });

      // Handle click on parcels
      map.current.on('click', 'parcels-circles', (e) => {
        if (e.features.length > 0) {
          const feature = e.features[0];
          setSelectedParcel(feature);
          
          // Create popup
          const coordinates = e.lngLat;
          const newPopup = new mapboxgl.Popup({ offset: 25 })
            .setLngLat(coordinates)
            .setDOMContent(document.createElement('div'))
            .addTo(map.current);
          
          setPopup(newPopup);
        }
      });

      // Load initial parcels
      loadParcels();
    });

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, [mapboxToken]);

  // Calculate centroid of a polygon
  const calculateCentroid = (geometry) => {
    if (geometry.type === 'Point') {
      return geometry.coordinates;
    }
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0]; // Outer ring
      let sumLon = 0;
      let sumLat = 0;
      const count = coords.length - 1; // Exclude last duplicate point
      for (let i = 0; i < count; i++) {
        sumLon += coords[i][0];
        sumLat += coords[i][1];
      }
      return [sumLon / count, sumLat / count];
    }
    // For other types, try to get first coordinate
    if (geometry.coordinates && geometry.coordinates[0]) {
      return Array.isArray(geometry.coordinates[0][0])
        ? geometry.coordinates[0][0]
        : geometry.coordinates[0];
    }
    return [0, 0];
  };

  // Convert polygon features to point features (centroids)
  const convertToPointFeatures = (featureCollection) => {
    if (!featureCollection || !featureCollection.features) {
      return { type: 'FeatureCollection', features: [] };
    }

    const pointFeatures = featureCollection.features.map((feature) => {
      const centroid = calculateCentroid(feature.geometry);
      return {
        ...feature,
        geometry: {
          type: 'Point',
          coordinates: centroid,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features: pointFeatures,
    };
  };

  // Debounced function to load parcels
  const loadParcels = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      const bounds = map.current.getBounds();
      const bbox = {
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
      };

      setLoading(true);
      fetchParcels(bbox)
        .then((featureCollection) => {
          // Convert polygons to point features (centroids)
          const pointFeatures = convertToPointFeatures(featureCollection);
          const source = map.current.getSource('parcels');
          if (source) {
            source.setData(pointFeatures);
          }
        })
        .catch((error) => {
          console.error('Error loading parcels:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300); // 300ms debounce
  }, [mapLoaded]);

  // Handle map move events
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleMoveEnd = () => {
      loadParcels();
    };

    map.current.on('moveend', handleMoveEnd);

    return () => {
      if (map.current) {
        map.current.off('moveend', handleMoveEnd);
      }
    };
  }, [mapLoaded, loadParcels]);

  // Handle popup close
  const handleClosePopup = () => {
    if (popup) {
      popup.remove();
      setPopup(null);
    }
    setSelectedParcel(null);
  };

  // Handle reset view
  const handleResetView = () => {
    if (map.current) {
      map.current.flyTo({
        center: [-122.4194, 37.7749],
        zoom: 12,
      });
    }
  };

  // Render popup content
  useEffect(() => {
    if (popup && selectedParcel) {
      const popupContent = document.createElement('div');
      popup.setDOMContent(popupContent);
      
      // We'll render the popup using React Portal in the future
      // For now, we'll handle it differently
    }
  }, [popup, selectedParcel]);

  return (
    <div className="map-view">
      <div ref={mapContainer} className="map-container" />
      <MapControls 
        map={map.current} 
        onResetView={handleResetView}
        loading={loading}
      />
      {selectedParcel && (
        <div className="popup-overlay" onClick={handleClosePopup}>
          <div className="popup-container" onClick={(e) => e.stopPropagation()}>
            <ParcelPopup
              parcel={selectedParcel}
              onClose={handleClosePopup}
              authToken={authToken}
              onBuySuccess={(parcelId) => {
                if (onBuySuccess) {
                  onBuySuccess(parcelId);
                }
                // Reload parcels after successful buy
                loadParcels();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default MapView;

