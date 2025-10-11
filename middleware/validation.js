// Validation middleware for common fields
const validateRegistration = (req, res, next) => {
  const { name, phoneNumber, address } = req.body;
  
  if (!name || !phoneNumber || !address) {
    return res.status(400).json({ error: 'Name, phone number, and address are required' });
  }
  
  // Basic phone number validation
  if (!/^\d{10}$/.test(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }
  
  next();
};

const validateRideBooking = (req, res, next) => {
  const {
    pickupLocation,
    dropoffLocation,
    pickupCoordinates,
    dropoffCoordinates,
    fare,
    rideType
  } = req.body;
  
  if (!pickupLocation || !dropoffLocation || !pickupCoordinates || 
      !dropoffCoordinates || !fare || !rideType) {
    return res.status(400).json({ error: 'Missing required booking information' });
  }
  
  // Validate coordinates
  if (typeof pickupCoordinates.latitude !== 'number' || 
      typeof pickupCoordinates.longitude !== 'number' ||
      typeof dropoffCoordinates.latitude !== 'number' || 
      typeof dropoffCoordinates.longitude !== 'number') {
    return res.status(400).json({ error: 'Invalid coordinates' });
  }
  
  next();
};

module.exports = {
  validateRegistration,
  validateRideBooking
};