const pool = require('../config/database');
const { createOrUpdateListing, getListingByParcel, getListingForUpdate } = require('../models/rentListing');
const { createAgreement, getActiveRentalsByUser } = require('../models/rentalAgreement');
const { calculateTotalCost, calculateFee, calculateOwnerReceives } = require('../config/rentals');

// Import wallet functions from wallet module
const path = require('path');
let walletModule;
try {
  walletModule = require(path.join(__dirname, '../../Wallet/src/models/wallet'));
} catch (error) {
  console.error('Wallet module not found:', error.message);
  throw new Error('Wallet module is required for rental operations');
}

// Import parcel functions to verify ownership
let parcelModule;
try {
  parcelModule = require(path.join(__dirname, '../../Parcels API/src/models/parcel'));
} catch (error) {
  console.error('Parcels module not found:', error.message);
  throw new Error('Parcels module is required for rental operations');
}

/**
 * List a parcel for rent (owner-only)
 * POST /rent/list/:parcel_id
 */
async function listParcel(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const ownerId = req.user.id;
    const { parcel_id } = req.params;
    const { price_per_hour_cents, min_seconds, max_seconds } = req.body;
    
    // Validate parcel_id
    if (!parcel_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel ID is required' });
    }
    
    // Validate required fields
    if (!price_per_hour_cents || typeof price_per_hour_cents !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'price_per_hour_cents is required and must be a number' });
    }
    
    if (!min_seconds || typeof min_seconds !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'min_seconds is required and must be a number' });
    }
    
    if (!max_seconds || typeof max_seconds !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'max_seconds is required and must be a number' });
    }
    
    // Validate values
    if (price_per_hour_cents <= 0 || !Number.isInteger(price_per_hour_cents)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'price_per_hour_cents must be a positive integer' });
    }
    
    if (min_seconds <= 0 || !Number.isInteger(min_seconds)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'min_seconds must be a positive integer' });
    }
    
    if (max_seconds <= 0 || !Number.isInteger(max_seconds)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'max_seconds must be a positive integer' });
    }
    
    if (max_seconds < min_seconds) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'max_seconds must be >= min_seconds' });
    }
    
    // Verify parcel exists and user owns it
    const parcel = await parcelModule.getParcelById(parcel_id);
    if (!parcel) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Get parcel with owner_id (need to query directly)
    const parcelQuery = await client.query(
      'SELECT owner_id FROM parcels WHERE parcel_id = $1',
      [parcel_id]
    );
    
    if (parcelQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    if (parcelQuery.rows[0].owner_id !== ownerId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not own this parcel' });
    }
    
    // Create or update listing
    const listing = await createOrUpdateListing(
      parcel_id,
      ownerId,
      price_per_hour_cents,
      min_seconds,
      max_seconds,
      true, // active
      client
    );
    
    await client.query('COMMIT');
    
    res.status(200).json({
      listing_id: listing.listing_id,
      parcel_id: listing.parcel_id,
      price_per_hour_cents: listing.price_per_hour_cents,
      min_seconds: listing.min_seconds,
      max_seconds: listing.max_seconds,
      active: listing.active,
      created_at: listing.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('List parcel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Start a rental
 * POST /rent/start/:parcel_id
 */
async function startRental(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const renterId = req.user.id;
    const { parcel_id } = req.params;
    const { duration_seconds } = req.body;
    
    // Validate parcel_id
    if (!parcel_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel ID is required' });
    }
    
    // Validate duration_seconds
    if (!duration_seconds || typeof duration_seconds !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'duration_seconds is required and must be a number' });
    }
    
    if (duration_seconds <= 0 || !Number.isInteger(duration_seconds)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'duration_seconds must be a positive integer' });
    }
    
    // Lock and get listing with SELECT ... FOR UPDATE
    const listing = await getListingForUpdate(parcel_id, client);
    
    if (!listing || !listing.active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel is not listed for rent' });
    }
    
    // Validate duration within min/max
    if (duration_seconds < listing.min_seconds || duration_seconds > listing.max_seconds) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Duration must be between min_seconds and max_seconds',
        min_seconds: listing.min_seconds,
        max_seconds: listing.max_seconds,
        provided: duration_seconds,
      });
    }
    
    // Calculate total cost
    const totalCents = calculateTotalCost(listing.price_per_hour_cents, duration_seconds);
    
    // Check renter's wallet balance
    const renterWallet = await walletModule.getWallet(renterId);
    if (!renterWallet) {
      await walletModule.initializeWallet(renterId, client);
    }
    
    const renterBalance = renterWallet ? renterWallet.balance_cents : 0;
    const renterAvailable = renterBalance - (renterWallet?.reserved_cents || 0);
    
    if (renterAvailable < totalCents) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Insufficient balance',
        required_cents: totalCents,
        available_cents: renterAvailable,
      });
    }
    
    // Calculate fees
    const feeCents = calculateFee(totalCents);
    const ownerReceivesCents = calculateOwnerReceives(totalCents);
    
    // Debit renter's wallet
    await walletModule.updateBalance(renterId, -totalCents, 0, client);
    
    // Credit owner's wallet (minus fee)
    await walletModule.updateBalance(listing.owner_id, ownerReceivesCents, 0, client);
    
    // Create rental agreement
    const startTs = new Date();
    const endTs = new Date(startTs.getTime() + duration_seconds * 1000);
    
    const agreement = await createAgreement({
      parcel_id,
      owner_id: listing.owner_id,
      renter_id: renterId,
      start_ts: startTs,
      end_ts: endTs,
      total_cents: totalCents,
      status: 'active',
    }, client);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      rental_id: agreement.rental_id,
      parcel_id: agreement.parcel_id,
      owner_id: agreement.owner_id,
      renter_id: agreement.renter_id,
      start_ts: agreement.start_ts,
      end_ts: agreement.end_ts,
      total_cents: agreement.total_cents,
      fee_cents: feeCents,
      owner_receives_cents: ownerReceivesCents,
      status: agreement.status,
      created_at: agreement.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Start rental error:', error);
    
    if (error.message.includes('Insufficient')) {
      return res.status(409).json({ error: error.message });
    }
    
    if (error.message.includes('Wallet')) {
      return res.status(500).json({ error: 'Wallet operation failed' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

/**
 * Get active rentals for current user
 * GET /rent/my
 */
async function getMyRentals(req, res) {
  try {
    const userId = req.user.id;
    
    const rentals = await getActiveRentalsByUser(userId);
    
    res.json({
      rentals: rentals.map(rental => ({
        rental_id: rental.rental_id,
        parcel_id: rental.parcel_id,
        owner_id: rental.owner_id,
        renter_id: rental.renter_id,
        start_ts: rental.start_ts,
        end_ts: rental.end_ts,
        total_cents: rental.total_cents,
        status: rental.status,
        created_at: rental.created_at,
      })),
    });
  } catch (error) {
    console.error('Get my rentals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listParcel,
  startRental,
  getMyRentals,
};

