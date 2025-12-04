const { publishParcelUpdate } = require('../events');

/**
 * Middleware to publish parcel update events after successful operations
 * Call this after parcel updates (buy/list operations)
 * 
 * Usage:
 *   router.post('/buy/:parcel_id', authenticateToken, buyParcel, publishParcelEvent);
 */
function publishParcelEvent(req, res, next) {
  // Only publish if response was successful (2xx status)
  const originalJson = res.json;
  
  res.json = function(data) {
    // Check if status is success
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Extract parcel_id from response or params
      const parcelId = data.parcel_id || req.params.parcel_id || req.body.parcel_id;
      
      if (parcelId) {
        // Publish event asynchronously (don't wait)
        publishParcelUpdate(parcelId).catch(error => {
          console.error('Error publishing parcel event:', error);
        });
      }
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Helper function to publish parcel update directly
 * Use this in controllers after parcel updates
 * 
 * @param {string} parcelId - Parcel ID
 */
function publishParcelUpdateDirect(parcelId) {
  publishParcelUpdate(parcelId).catch(error => {
    console.error('Error publishing parcel event:', error);
  });
}

module.exports = {
  publishParcelEvent,
  publishParcelUpdateDirect,
};

