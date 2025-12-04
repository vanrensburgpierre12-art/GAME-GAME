require('dotenv').config();

/**
 * Get marketplace fee percentage from environment
 * Default: 5% (0.05)
 * @returns {number} Fee percentage as decimal (e.g., 0.05 for 5%)
 */
function getFeePercentage() {
  const feePercent = parseFloat(process.env.MARKETPLACE_FEE_PERCENT || '5');
  return feePercent / 100; // Convert percentage to decimal
}

/**
 * Calculate fee amount from price
 * @param {number} priceCents - Price in cents
 * @returns {number} Fee amount in cents (rounded)
 */
function calculateFee(priceCents) {
  const feePercent = getFeePercentage();
  return Math.round(priceCents * feePercent);
}

/**
 * Calculate amount seller receives (price - fee)
 * @param {number} priceCents - Price in cents
 * @returns {number} Amount seller receives in cents
 */
function calculateSellerReceives(priceCents) {
  const feeCents = calculateFee(priceCents);
  return priceCents - feeCents;
}

module.exports = {
  getFeePercentage,
  calculateFee,
  calculateSellerReceives,
};

