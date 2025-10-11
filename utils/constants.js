// Ride status constants
const RIDE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  ARRIVED: 'arrived',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Vehicle types
const VEHICLE_TYPES = {
  BIKE: 'bike',
  AUTO: 'auto',
  TAXI: 'taxi',
  MINI: 'mini',
  SEDAN: 'sedan',
  SUV: 'suv'
};

// Payment methods
const PAYMENT_METHODS = {
  CASH: 'Cash',
  QR: 'QR'
};

// User roles
const USER_ROLES = {
  USER: 'user',
  DRIVER: 'driver',
  ADMIN: 'admin'
};

module.exports = {
  RIDE_STATUS,
  VEHICLE_TYPES,
  PAYMENT_METHODS,
  USER_ROLES
};