require('dotenv').config();

/**
 * Get rental fee percentage from environment
 * Default: 5% (0.05) - same as marketplace
 * @returns {number} Fee percentage as decimal (e.g., 0.05 for 5%)
 */
function getFeePercentage() {
  const feePercent = parseFloat(process.env.RENTAL_FEE_PERCENT || process.env.MARKETPLACE_FEE_PERCENT || '5');
  return feePercent / 100; // Convert percentage to decimal
}

/**
 * Calculate fee amount from rental total
 * @param {number} totalCents - Total rental cost in cents
 * @returns {number} Fee amount in cents (rounded)
 */
function calculateFee(totalCents) {
  const feePercent = getFeePercentage();
  return Math.round(totalCents * feePercent);
}

/**
 * Calculate amount owner receives (total - fee)
 * @param {number} totalCents - Total rental cost in cents
 * @returns {number} Amount owner receives in cents
 */
function calculateOwnerReceives(totalCents) {
  const feeCents = calculateFee(totalCents);
  return totalCents - feeCents;
}

/**
 * Calculate total rental cost from price per hour and duration
 * @param {number} pricePerHourCents - Price per hour in cents
 * @param {number} durationSeconds - Duration in seconds
 * @returns {number} Total cost in cents (rounded)
 */
function calculateTotalCost(pricePerHourCents, durationSeconds) {
  // Convert seconds to hours and calculate
  const hours = durationSeconds / 3600;
  return Math.round(pricePerHourCents * hours);
}

module.exports = {
  getFeePercentage,
  calculateFee,
  calculateOwnerReceives,
  calculateTotalCost,
};

