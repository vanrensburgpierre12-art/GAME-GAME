const pool = require('../config/database');
const { getParcelForUpdate, updateParcelOwner, updateParcelPrice } = require('../models/parcel');
const { createTransaction } = require('../models/marketplaceTransaction');
const { calculateFee, calculateSellerReceives } = require('../config/marketplace');

// Import wallet functions from wallet module
const path = require('path');
let walletModule;
try {
  walletModule = require(path.join(__dirname, '../../Wallet/src/models/wallet'));
} catch (error) {
  console.error('Wallet module not found:', error.message);
  throw new Error('Wallet module is required for marketplace operations');
}

/**
 * Buy a parcel
 * POST /market/buy/:parcel_id
 */
async function buyParcel(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const buyerId = req.user.id;
    const { parcel_id } = req.params;
    
    // Validate parcel_id
    if (!parcel_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel ID is required' });
    }
    
    // Lock parcel row with SELECT ... FOR UPDATE
    const parcel = await getParcelForUpdate(parcel_id, client);
    
    if (!parcel) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Validate parcel has a price
    if (!parcel.price_cents || parcel.price_cents <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel is not for sale' });
    }
    
    // Validate user is not the owner
    if (parcel.owner_id === buyerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot buy a parcel you already own' });
    }
    
    const priceCents = parcel.price_cents;
    const sellerId = parcel.owner_id;
    
    // Check buyer's wallet balance
    const buyerWallet = await walletModule.getWallet(buyerId);
    if (!buyerWallet) {
      await walletModule.initializeWallet(buyerId, client);
    }
    
    const buyerBalance = buyerWallet ? buyerWallet.balance_cents : 0;
    const buyerAvailable = buyerBalance - (buyerWallet?.reserved_cents || 0);
    
    if (buyerAvailable < priceCents) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Insufficient balance',
        required_cents: priceCents,
        available_cents: buyerAvailable,
      });
    }
    
    // Calculate fees
    const feeCents = calculateFee(priceCents);
    const sellerReceivesCents = calculateSellerReceives(priceCents);
    
    // Debit buyer's wallet
    await walletModule.updateBalance(buyerId, -priceCents, 0, client);
    
    // Credit seller's wallet (if seller exists)
    if (sellerId) {
      await walletModule.updateBalance(sellerId, sellerReceivesCents, 0, client);
    }
    
    // Update parcel owner
    await updateParcelOwner(parcel_id, buyerId, null, client);
    
    // Create transaction record
    const transaction = await createTransaction({
      parcel_id,
      buyer_id: buyerId,
      seller_id: sellerId,
      price_cents: priceCents,
      fee_cents: feeCents,
      seller_receives_cents: sellerReceivesCents,
      type: 'buy',
      status: 'completed',
    }, client);
    
    await client.query('COMMIT');
    
    res.status(200).json({
      tx_id: transaction.tx_id,
      parcel_id: transaction.parcel_id,
      price_cents: transaction.price_cents,
      fee_cents: transaction.fee_cents,
      seller_receives_cents: transaction.seller_receives_cents,
      status: transaction.status,
      created_at: transaction.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Buy parcel error:', error);
    
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
 * List a parcel for sale
 * POST /market/list/:parcel_id
 */
async function listParcel(req, res) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const ownerId = req.user.id;
    const { parcel_id } = req.params;
    const { price_cents } = req.body;
    
    // Validate parcel_id
    if (!parcel_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Parcel ID is required' });
    }
    
    // Validate price_cents
    if (!price_cents || typeof price_cents !== 'number') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'price_cents is required and must be a number' });
    }
    
    if (price_cents <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'price_cents must be positive' });
    }
    
    if (!Number.isInteger(price_cents)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'price_cents must be an integer' });
    }
    
    // Lock parcel row with SELECT ... FOR UPDATE
    const parcel = await getParcelForUpdate(parcel_id, client);
    
    if (!parcel) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Parcel not found' });
    }
    
    // Validate user owns the parcel
    if (parcel.owner_id !== ownerId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not own this parcel' });
    }
    
    // Update parcel price
    const updatedParcel = await updateParcelPrice(parcel_id, price_cents, client);
    
    // Create transaction record
    const transaction = await createTransaction({
      parcel_id,
      buyer_id: ownerId, // For listing, buyer_id is the owner listing it
      seller_id: ownerId,
      price_cents: price_cents,
      fee_cents: 0, // No fee for listing
      seller_receives_cents: 0, // No payment for listing
      type: 'list',
      status: 'completed',
    }, client);
    
    await client.query('COMMIT');
    
    res.status(200).json({
      tx_id: transaction.tx_id,
      parcel_id: updatedParcel.parcel_id,
      price_cents: updatedParcel.price_cents,
      status: transaction.status,
      created_at: transaction.created_at,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('List parcel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

module.exports = {
  buyParcel,
  listParcel,
};

