/**
 * Format a number as Indian Rupees (INR)
 */
export function formatINR(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get color class based on regret score
 */
export function getRegretColor(score) {
  if (score <= 30) return 'text-green-600';
  if (score <= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function getRegretBgColor(score) {
  if (score <= 30) return '#22c55e';
  if (score <= 60) return '#f59e0b';
  return '#ef4444';
}

export function getRegretLabel(score) {
  if (score <= 20) return 'Very Low Regret';
  if (score <= 40) return 'Low Regret';
  if (score <= 60) return 'Moderate Regret';
  if (score <= 80) return 'High Regret';
  return 'Very High Regret';
}

/**
 * Format delay months for display
 */
export function formatDelay(delayMonths) {
  if (delayMonths === null) return 'Not reached';
  if (delayMonths === 0) return 'On time';
  if (delayMonths === 1) return '1 month delay';
  return `${delayMonths} months delay`;
}

/**
 * Format probability as percentage
 */
export function formatProbability(prob) {
  if (prob == null) return '—';
  return `${Math.round(prob * 100)}%`;
}

/**
 * Calculate EMI
 */
export function calculateEMI(principal, annualRate, months) {
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12 / 100;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

export function getErrorMessage(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.data?.errors) return err.response.data.errors.join(', ');
  if (err?.message) return err.message;
  return 'Something went wrong';
}
