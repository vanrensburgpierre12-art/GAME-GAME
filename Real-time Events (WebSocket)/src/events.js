const redisClient = require('./redis');

const PARCEL_EVENTS_CHANNEL = 'parcel_events';

/**
 * Publish parcel update event
 * @param {string} parcelId - Parcel ID
 */
async function publishParcelUpdate(parcelId) {
  const event = {
    type: 'parcel_updated',
    parcel_id: parcelId,
  };
  
  try {
    const message = JSON.stringify(event);
    await redisClient.publish(PARCEL_EVENTS_CHANNEL, message);
  } catch (error) {
    console.error('Error publishing parcel update event:', error);
    // Don't throw - event publishing failure shouldn't break the main flow
  }
}

/**
 * Subscribe to parcel events
 * @param {function} callback - Callback function(event)
 * @returns {function} Unsubscribe function
 */
function subscribeToParcelEvents(callback) {
  const handler = (message, channel) => {
    try {
      const event = JSON.parse(message);
      callback(event);
    } catch (error) {
      console.error('Error parsing parcel event:', error);
    }
  };
  
  return redisClient.subscribe(PARCEL_EVENTS_CHANNEL, handler);
}

module.exports = {
  publishParcelUpdate,
  subscribeToParcelEvents,
  PARCEL_EVENTS_CHANNEL,
};

