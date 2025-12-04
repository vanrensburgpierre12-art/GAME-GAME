import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Fetch parcels within a bounding box
 * @param {object} bbox - Bounding box { minLon, minLat, maxLon, maxLat }
 * @returns {Promise<object>} GeoJSON FeatureCollection
 */
export async function fetchParcels(bbox) {
  const { minLon, minLat, maxLon, maxLat } = bbox;
  const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
  
  try {
    const response = await axios.get(`${API_URL}/parcels`, {
      params: { bbox: bboxString },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching parcels:', error);
    throw error;
  }
}

/**
 * Buy a parcel
 * @param {string} parcelId - Parcel ID
 * @param {string} token - Authentication token
 * @returns {Promise<object>} Transaction result
 */
export async function buyParcel(parcelId, token) {
  try {
    const response = await axios.post(
      `${API_URL}/market/buy/${parcelId}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error buying parcel:', error);
    throw error;
  }
}

/**
 * Register a new user
 */
export async function register(email, password, displayName) {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email,
      password,
      display_name: displayName,
    });
    return response.data;
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
}

/**
 * Login user
 */
export async function login(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

/**
 * Get current user profile
 */
export async function getMe(token) {
  try {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Get wallet balance
 */
export async function getWallet(token) {
  try {
    const response = await axios.get(`${API_URL}/wallet`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching wallet:', error);
    throw error;
  }
}

/**
 * Deposit funds to wallet
 */
export async function deposit(amountCents, token) {
  try {
    const response = await axios.post(
      `${API_URL}/payments/deposit`,
      { amount_cents: amountCents },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error depositing funds:', error);
    throw error;
  }
}

/**
 * Get a single parcel by ID
 * @param {string} parcelId - Parcel ID
 * @returns {Promise<object>} GeoJSON Feature
 */
export async function getParcelById(parcelId) {
  try {
    const response = await axios.get(`${API_URL}/parcels/${parcelId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching parcel:', error);
    throw error;
  }
}

