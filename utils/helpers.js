// Generate random OTP
const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

// Calculate distance between two coordinates (in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg) => {
  return deg * (Math.PI/180);
};

// Calculate fare based on distance and vehicle type
const calculateFare = (distance, vehicleType) => {
  const baseFares = {
    bike: 10,
    auto: 15,
    taxi: 20,
    mini: 25,
    sedan: 30,
    suv: 35
  };
  
  const perKmRates = {
    bike: 5,
    auto: 8,
    taxi: 10,
    mini: 12,
    sedan: 15,
    suv: 18
  };
  
  const baseFare = baseFares[vehicleType] || baseFares.taxi;
  const perKmRate = perKmRates[vehicleType] || perKmRate.taxi;
  
  return Math.round(baseFare + (distance * perKmRate));
};

// Format date for display
const formatDate = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

module.exports = {
  generateOTP,
  calculateDistance,
  calculateFare,
  formatDate
};