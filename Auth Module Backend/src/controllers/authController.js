const bcrypt = require('bcrypt');
const { createUser, findUserByEmail } = require('../models/user');
const { generateToken } = require('../utils/jwt');

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Register a new user
 * POST /auth/register
 */
async function register(req, res) {
  try {
    const { email, password, display_name } = req.body;

    // Validation
    if (!email || !password || !display_name) {
      return res.status(400).json({ 
        error: 'Email, password, and display_name are required' 
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters long' 
      });
    }

    if (display_name.trim().length === 0) {
      return res.status(400).json({ error: 'Display name cannot be empty' });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (kyc_status defaults to 'none' in database)
    const user = await createUser(email, passwordHash, display_name.trim());

    // Generate JWT token
    const token = generateToken(user.id);

    // Return token and minimal user profile
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        kyc_status: user.kyc_status,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Login user
 * POST /auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return token and minimal user profile
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        kyc_status: user.kyc_status,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get current user profile
 * GET /auth/me
 * Requires authentication middleware
 */
async function getMe(req, res) {
  try {
    // User is attached to req by authenticateToken middleware
    res.json(req.user);
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  register,
  login,
  getMe,
};

