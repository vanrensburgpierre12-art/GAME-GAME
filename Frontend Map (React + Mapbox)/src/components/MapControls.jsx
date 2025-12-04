import React from 'react';
import './MapControls.css';

function MapControls({ map, onResetView, loading }) {
  const handleZoomIn = () => {
    if (map) {
      map.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.zoomOut();
    }
  };

  return (
    <div className="map-controls">
      <div className="control-group">
        <button className="control-button" onClick={handleZoomIn} title="Zoom In">
          +
        </button>
        <button className="control-button" onClick={handleZoomOut} title="Zoom Out">
          −
        </button>
      </div>
      
      {onResetView && (
        <button className="control-button reset-button" onClick={onResetView} title="Reset View">
          ⌂
        </button>
      )}
      
      {loading && (
        <div className="loading-indicator" title="Loading parcels...">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default MapControls;

