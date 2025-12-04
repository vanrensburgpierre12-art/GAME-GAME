const path = require('path');

/**
 * Authenticate WebSocket connection using JWT
 * @param {string} token - JWT token
 * @returns {Promise<object|null>} User object or null if invalid
 */
async function authenticateWebSocket(token) {
  if (!token) {
    return null;
  }
  
  try {
    // Import JWT utilities from auth module
    const jwtPath = path.join(__dirname, '../../Auth Module Backend/src/utils/jwt');
    const userModelPath = path.join(__dirname, '../../Auth Module Backend/src/models/user');
    
    const { verifyToken } = require(jwtPath);
    const { findUserById } = require(userModelPath);
    
    // Verify token
    const decoded = verifyToken(token);
    
    // Fetch user from database
    const user = await findUserById(decoded.userId);
    
    return user;
  } catch (error) {
    // Invalid token or user not found
    return null;
  }
}

/**
 * Extract JWT token from WebSocket connection
 * @param {object} request - HTTP request object
 * @returns {string|null} JWT token or null
 */
function extractToken(request) {
  // Try query parameter first (common for WebSocket connections)
  const url = new URL(request.url, 'http://localhost');
  const tokenFromQuery = url.searchParams.get('token');
  
  if (tokenFromQuery) {
    return tokenFromQuery;
  }
  
  // Try Authorization header
  const authHeader = request.headers['authorization'];
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      return parts[1];
    }
  }
  
  return null;
}

module.exports = {
  authenticateWebSocket,
  extractToken,
};

