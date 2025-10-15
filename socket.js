const { Server } = require("socket.io");
const DriverLocation = require("./models/driver/DriverLocation");
const Driver = require("./models/driver/driver");
const Ride = require("./models/shared/ride");
const RaidId = require("./models/user/raidId");
const UserLocation = require("./models/user/UserLocation");
const RidePrice = require("./models/admin/RidePrice");

let io;
let isInitialized = false;
const rides = {};
const activeDriverSockets = new Map();
const processingRides = new Set();
const userLocationTracking = new Map();

let currentRidePrices = {
  bike: 0,
  taxi: 0,
  port: 0
};

// Helper function to log current driver status
const logDriverStatus = () => {
  console.log("\n📊 === CURRENT DRIVER STATUS ===");
  if (activeDriverSockets.size === 0) {
    console.log("❌ No drivers currently online");
  } else {
    console.log(`✅ ${activeDriverSockets.size} drivers currently online:`);
    activeDriverSockets.forEach((driver, driverId) => {
      const timeSinceUpdate = Math.floor((Date.now() - driver.lastUpdate) / 1000);
      console.log(`  🚗 ${driver.driverName} (${driverId})`);
      console.log(`     Status: ${driver.status}`);
      console.log(`     Vehicle: ${driver.vehicleType}`);
      console.log(`     Location: ${driver.location.latitude.toFixed(6)}, ${driver.location.longitude.toFixed(6)}`);
      console.log(`     Last update: ${timeSinceUpdate}s ago`);
      console.log(`     Socket: ${driver.socketId}`);
      console.log(`     Online: ${driver.isOnline ? 'Yes' : 'No'}`);
    });
  }
  console.log("================================\n");
};

// Helper function to log ride status
const logRideStatus = () => {
  console.log("\n🚕 === CURRENT RIDE STATUS ===");
  const rideEntries = Object.entries(rides);
  if (rideEntries.length === 0) {
    console.log("❌ No active rides");
  } else {
    console.log(`✅ ${rideEntries.length} active rides:`);
    rideEntries.forEach(([rideId, ride]) => {
      console.log(`  📍 Ride ${rideId}:`);
      console.log(`     Status: ${ride.status}`);
      console.log(`     Driver: ${ride.driverId || 'Not assigned'}`);
      console.log(`     User ID: ${ride.userId}`);
      console.log(`     Customer ID: ${ride.customerId}`);
      console.log(`     User Name: ${ride.userName}`);
      console.log(`     User Mobile: ${ride.userMobile}`);
      console.log(`     Pickup: ${ride.pickup?.address || ride.pickup?.lat + ',' + ride.pickup?.lng}`);
      console.log(`     Drop: ${ride.drop?.address || ride.drop?.lat + ',' + ride.drop?.lng}`);
      
      if (userLocationTracking.has(ride.userId)) {
        const userLoc = userLocationTracking.get(ride.userId);
        console.log(`     📍 USER CURRENT/LIVE LOCATION: ${userLoc.latitude}, ${userLoc.longitude}`);
        console.log(`     📍 Last location update: ${new Date(userLoc.lastUpdate).toLocaleTimeString()}`);
      } else {
        console.log(`     📍 USER CURRENT/LIVE LOCATION: Not available`);
      }
    });
  }
  console.log("================================\n");
};

// Function to log user location updates
const logUserLocationUpdate = (userId, location, rideId) => {
  console.log(`\n📍 === USER LOCATION UPDATE ===`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`🚕 Ride ID: ${rideId}`);
  console.log(`🗺️  Current Location: ${location.latitude}, ${location.longitude}`);
  console.log(`⏰ Update Time: ${new Date().toLocaleTimeString()}`);
  console.log("================================\n");
};

// Function to save user location to database
const saveUserLocationToDB = async (userId, latitude, longitude, rideId = null) => {
  try {
    const userLocation = new UserLocation({
      userId,
      latitude,
      longitude,
      rideId,
      timestamp: new Date()
    });
    
    await userLocation.save();
    console.log(`💾 Saved user location to DB: User ${userId}, Ride ${rideId}, Location: ${latitude}, ${longitude}`);
    return true;
  } catch (error) {
    console.error("❌ Error saving user location to DB:", error);
    return false;
  }
};

// Test the RaidId model on server startup
async function testRaidIdModel() {
  try {
    console.log('🧪 Testing RaidId model...');
    const testDoc = await RaidId.findOne({ _id: 'raidId' });
    console.log('🧪 RaidId document:', testDoc);
    
    if (!testDoc) {
      console.log('🧪 Creating initial RaidId document');
      const newDoc = new RaidId({ _id: 'raidId', sequence: 100000 });
      await newDoc.save();
      console.log('🧪 Created initial RaidId document');
    }
  } catch (error) {
    console.error('❌ Error testing RaidId model:', error);
  }
}

// RAID_ID generation function
async function generateSequentialRaidId() {
  try {
    console.log('🔢 Starting RAID_ID generation');
    
    const raidIdDoc = await RaidId.findOneAndUpdate(
      { _id: 'raidId' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    
    console.log('🔢 RAID_ID document:', raidIdDoc);

    let sequenceNumber = raidIdDoc.sequence;
    console.log('🔢 Sequence number:', sequenceNumber);

    if (sequenceNumber > 999999) {
      console.log('🔄 Resetting sequence to 100000');
      await RaidId.findOneAndUpdate(
        { _id: 'raidId' },
        { sequence: 100000 }
      );
      sequenceNumber = 100000;
    }

    const formattedSequence = sequenceNumber.toString().padStart(6, '0');
    const raidId = `RID${formattedSequence}`;
    console.log(`🔢 Generated RAID_ID: ${raidId}`);
    
    return raidId;
  } catch (error) {
    console.error('❌ Error generating sequential RAID_ID:', error);
    
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const fallbackId = `RID${timestamp}${random}`;
    console.log(`🔄 Using fallback ID: ${fallbackId}`);
    
    return fallbackId;
  }
}

// Helper function to save driver location to database
async function saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType, status = "Live") {
  try {
    const locationDoc = new DriverLocation({
      driverId,
      driverName,
      latitude,
      longitude,
      vehicleType,
      status,
      timestamp: new Date()
    });
    
    await locationDoc.save();
    console.log(`💾 Saved location for driver ${driverId} (${driverName}) to database`);
    return true;
  } catch (error) {
    console.error("❌ Error saving driver location to DB:", error);
    return false;
  }
}

// Helper function to calculate ride price
async function calculateRidePrice(vehicleType, distance) {
  try {
    console.log(`💰 CALCULATING PRICE: ${distance}km for ${vehicleType}`);
    
    const priceDoc = await RidePrice.findOne({ 
      vehicleType, 
      isActive: true 
    });
    
    let pricePerKm;
    
    if (!priceDoc) {
      console.warn(`⚠️ No price found for vehicle type: ${vehicleType}, using default`);
      const defaultPrices = {
        bike: 7,
        taxi: 30,
        port: 60
      };
      pricePerKm = defaultPrices[vehicleType] || 30;
    } else {
      pricePerKm = priceDoc.pricePerKm;
      console.log(`✅ Found price in DB: ₹${pricePerKm}/km for ${vehicleType}`);
    }
    
    const totalPrice = distance * pricePerKm;
    
    console.log(`💰 PRICE CALCULATION: ${distance}km ${vehicleType} × ₹${pricePerKm}/km = ₹${totalPrice}`);
    
    return Math.round(totalPrice * 100) / 100; // Round to 2 decimal places
  } catch (err) {
    console.error('❌ Error calculating price:', err);
    const defaultPrices = {
      bike: 7,
      taxi: 30,
      port: 60
    };
    return distance * (defaultPrices[vehicleType] || 30);
  }
}

// Function to fetch current prices from MongoDB
async function fetchCurrentPricesFromDB() {
  try {
    const prices = await RidePrice.find({ isActive: true });
    
    const priceMap = {};
    prices.forEach(price => {
      priceMap[price.vehicleType] = price.pricePerKm;
    });
    
    currentRidePrices = {
      bike: priceMap.bike || 0,
      taxi: priceMap.taxi || 0,
      port: priceMap.port || 0
    };
    
    console.log('📊 Current prices from DB:', currentRidePrices);
    return currentRidePrices;
  } catch (error) {
    console.error('❌ Error fetching prices from DB:', error);
    return { bike: 0, taxi: 0, port: 0 };
  }
}

// Update the price update handler
const handlePriceUpdate = async (data) => {
  try {
    for (const [vehicleType, price] of Object.entries(data)) {
      await RidePrice.findOneAndUpdate(
        { vehicleType },
        { pricePerKm: price, isActive: true },
        { upsert: true, new: true }
      );
    }
    
    currentRidePrices = data;
    
    io.emit('priceUpdate', currentRidePrices);
    io.emit('currentPrices', currentRidePrices);
    
    console.log('📡 Price update broadcasted to all users:', currentRidePrices);
  } catch (error) {
    console.error('❌ Error updating prices:', error);
  }
};

// Helper function to broadcast driver locations to all users
function broadcastDriverLocationsToAllUsers() {
  const drivers = Array.from(activeDriverSockets.values())
    .filter(driver => driver.isOnline)
    .map(driver => ({
      driverId: driver.driverId,
      name: driver.driverName,
      location: {
        coordinates: [driver.location.longitude, driver.location.latitude]
      },
      vehicleType: driver.vehicleType,
      status: driver.status,
      lastUpdate: driver.lastUpdate
    }));
  
  io.emit("driverLocationsUpdate", { drivers });
}

const init = (server) => {
  if (isInitialized) {
    console.log("⚠️ Socket.IO already initialized, skipping...");
    return;
  }

  io = new Server(server, {
    cors: { 
      origin: "*", 
      methods: ["GET", "POST"] 
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  isInitialized = true;
  
  // Test the RaidId model on startup
  testRaidIdModel();
  
  // Fetch initial prices on server start
  fetchCurrentPricesFromDB();
  
  // Log server status every 10 seconds
  setInterval(() => {
    console.log(`\n⏰ ${new Date().toLocaleString()} - Server Status Check`);
    logDriverStatus();
    logRideStatus();
  }, 10000);
  
  io.on("connection", (socket) => {
    console.log(`\n⚡ New client connected: ${socket.id}`);
    console.log(`📱 Total connected clients: ${io.engine.clientsCount}`);
    
    socket.connectedAt = Date.now();

    // Event listener for price requests
    socket.on('getCurrentPrices', async () => {
      try {
        console.log('📡 User requested current prices');
        const prices = await fetchCurrentPricesFromDB();
        socket.emit('currentPrices', prices);
      } catch (error) {
        console.error('❌ Error fetching current prices:', error);
        socket.emit('currentPrices', { bike: 0, taxi: 0, port: 0 });
      }
    });

    // Handle price updates
    socket.on('updatePrices', async (data) => {
      await handlePriceUpdate(data);
    });

    // DRIVER LOCATION UPDATE
    socket.on("driverLocationUpdate", async (data) => {
      try {
        const { driverId, latitude, longitude, status } = data;
        
        console.log(`📍 REAL-TIME: Driver ${driverId} location update received`);
        console.log(`🗺️  Coordinates: ${latitude}, ${longitude}, Status: ${status}`);
        
        if (activeDriverSockets.has(driverId)) {
          const driverData = activeDriverSockets.get(driverId);
          driverData.location = { latitude, longitude };
          driverData.lastUpdate = Date.now();
          driverData.status = status || "Live";
          driverData.isOnline = true;
          activeDriverSockets.set(driverId, driverData);
          
          console.log(`✅ Updated driver ${driverId} location in memory`);
        }
        
        io.emit("driverLiveLocationUpdate", {
          driverId: driverId,
          lat: latitude,
          lng: longitude,
          status: status || "Live",
          vehicleType: "taxi",
          timestamp: Date.now()
        });
        
        console.log(`📡 Broadcasted driver ${driverId} location to ALL users`);
        
        const driverData = activeDriverSockets.get(driverId);
        if (driverData) {
          await saveDriverLocationToDB(
            driverId, 
            driverData.driverName || "Unknown", 
            latitude, 
            longitude, 
            "taxi", 
            status || "Live"
          );
        }
        
      } catch (error) {
        console.error("❌ Error processing driver location update:", error);
      }
    });
    
    socket.on("driverLiveLocationUpdate", async ({ driverId, driverName, lat, lng }) => {
      try {
        if (activeDriverSockets.has(driverId)) {
          const driverData = activeDriverSockets.get(driverId);
          driverData.location = { latitude: lat, longitude: lng };
          driverData.lastUpdate = Date.now();
          driverData.isOnline = true;
          activeDriverSockets.set(driverId, driverData);
          
          console.log(`\n📍 DRIVER LOCATION UPDATE: ${driverName} (${driverId})`);
          console.log(`🗺️  New location: ${lat}, ${lng}`);
          
          await saveDriverLocationToDB(driverId, driverName, lat, lng, driverData.vehicleType);
          
          io.emit("driverLiveLocationUpdate", {
            driverId: driverId,
            lat: lat,
            lng: lng,
            status: driverData.status,
            vehicleType: driverData.vehicleType,
            timestamp: Date.now()
          });
          
          console.log(`📡 Real-time update broadcasted for driver ${driverId}`);
        }
      } catch (error) {
        console.error("❌ Error updating driver location:", error);
      }
    });
    
    // USER REGISTRATION
    socket.on('registerUser', ({ userId, userMobile }) => {
      if (!userId) {
        console.error('❌ No userId provided for user registration');
        return;
      }
      
      socket.userId = userId.toString();
      socket.join(userId.toString());
      
      console.log(`👤 USER REGISTERED SUCCESSFULLY:`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Mobile: ${userMobile || 'Not provided'}`);
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Room: ${userId.toString()}`);
    });
    
    // DRIVER REGISTRATION
    socket.on("registerDriver", async ({ driverId, driverName, latitude, longitude, vehicleType = "taxi" }) => {
      try {
        console.log(`\n📝 DRIVER REGISTRATION ATTEMPT RECEIVED:`);
        console.log(`   Driver ID: ${driverId}`);
        console.log(`   Driver Name: ${driverName}`);
        console.log(`   Location: ${latitude}, ${longitude}`);
        console.log(`   Vehicle: ${vehicleType}`);
        console.log(`   Socket ID: ${socket.id}`);
        
        if (!driverId) {
          console.log("❌ Registration failed: No driverId provided");
          return;
        }
        
        if (!latitude || !longitude) {
          console.log("❌ Registration failed: Invalid location");
          return;
        }

        if (socket.driverId === driverId) {
          console.log(`⚠️ Driver ${driverId} already registered on this socket, skipping...`);
          return;
        }

        socket.driverId = driverId;
        socket.driverName = driverName;
        
        if (activeDriverSockets.has(driverId)) {
          const existingDriver = activeDriverSockets.get(driverId);
          console.log(`⚠️ Driver ${driverId} already active, updating socket...`);
          
          existingDriver.socketId = socket.id;
          existingDriver.lastUpdate = Date.now();
          existingDriver.isOnline = true;
          activeDriverSockets.set(driverId, existingDriver);
        } else {
          activeDriverSockets.set(driverId, {
            socketId: socket.id,
            driverId,
            driverName,
            location: { latitude, longitude },
            vehicleType,
            lastUpdate: Date.now(),
            status: "Live",
            isOnline: true
          });
        }
        
        socket.join("allDrivers");
        socket.join(`driver_${driverId}`);
        
        console.log(`✅ DRIVER REGISTERED/UPDATED SUCCESSFULLY: ${driverName} (${driverId})`);
        console.log(`📍 Location: ${latitude}, ${longitude}`);
        console.log(`🚗 Vehicle: ${vehicleType}`);
        console.log(`🔌 Socket ID: ${socket.id}`);
        
        await saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType);
        
        broadcastDriverLocationsToAllUsers();
        
        socket.emit("driverRegistrationConfirmed", {
          success: true,
          message: "Driver registered successfully"
        });
        
        logDriverStatus();
        
      } catch (error) {
        console.error("❌ Error registering driver:", error);
        
        socket.emit("driverRegistrationConfirmed", {
          success: false,
          message: "Registration failed: " + error.message
        });
      }
    });

    // REQUEST NEARBY DRIVERS
    socket.on("requestNearbyDrivers", ({ latitude, longitude, radius = 5000 }) => {
      try {
        console.log(`\n🔍 USER REQUESTED NEARBY DRIVERS: ${socket.id}`);
        console.log(`📍 User location: ${latitude}, ${longitude}`);
        console.log(`📏 Search radius: ${radius}m`);

        const drivers = Array.from(activeDriverSockets.values())
          .filter(driver => driver.isOnline)
          .map(driver => ({
            driverId: driver.driverId,
            name: driver.driverName,
            location: {
              coordinates: [driver.location.longitude, driver.location.latitude]
            },
            vehicleType: driver.vehicleType,
            status: driver.status,
            lastUpdate: driver.lastUpdate
          }));

        console.log(`📊 Active drivers in memory: ${activeDriverSockets.size}`);
        console.log(`📊 Online drivers: ${drivers.length}`);
        
        drivers.forEach((driver, index) => {
          console.log(`🚗 Driver ${index + 1}: ${driver.name} (${driver.driverId})`);
          console.log(`   Location: ${driver.location.coordinates[1]}, ${driver.location.coordinates[0]}`);
          console.log(`   Status: ${driver.status}`);
        });

        console.log(`📤 Sending ${drivers.length} online drivers to user`);

        socket.emit("nearbyDriversResponse", { drivers });
      } catch (error) {
        console.error("❌ Error fetching nearby drivers:", error);
        socket.emit("nearbyDriversResponse", { drivers: [] });
      }
    });

    // BOOK RIDE
    socket.on("bookRide", async (data, callback) => {
      let rideId;
      try {
        const { userId, customerId, userName, userMobile, pickup, drop, vehicleType, distance, travelTime, wantReturn } = data;

        console.log('📥 Received bookRide request with data:', JSON.stringify(data, null, 2));

        rideId = await generateSequentialRaidId();
        console.log(`🆔 Generated RAID_ID: ${rideId}`);
        
        console.log(`\n🚕 NEW RIDE BOOKING REQUEST: ${rideId}`);
        console.log(`👤 User ID: ${userId}`);
        console.log(`👤 Customer ID: ${customerId}`);
        console.log(`👤 Name: ${userName}`);
        console.log(`📱 Mobile: ${userMobile}`);
        console.log(`📍 Pickup: ${JSON.stringify(pickup)}`);
        console.log(`📍 Drop: ${JSON.stringify(drop)}`);
        console.log(`🚗 Vehicle type: ${vehicleType}`);

        let otp;
        if (customerId && customerId.length >= 4) {
          otp = customerId.slice(-4);
        } else {
          otp = Math.floor(1000 + Math.random() * 9000).toString();
        }
        console.log(`🔢 OTP: ${otp}`);

        if (processingRides.has(rideId)) {
          console.log(`⏭️  Ride ${rideId} is already being processed, skipping`);
          if (callback) {
            callback({
              success: false,
              message: "Ride is already being processed"
            });
          }
          return;
        }
        
        processingRides.add(rideId);

        if (!userId || !customerId || !userName || !pickup || !drop) {
          console.error("❌ Missing required fields");
          processingRides.delete(rideId);
          if (callback) {
            callback({
              success: false,
              message: "Missing required fields"
            });
          }
          return;
        }

        const existingRide = await Ride.findOne({ RAID_ID: rideId });
        if (existingRide) {
          console.log(`⏭️  Ride ${rideId} already exists in database, skipping`);
          processingRides.delete(rideId);
          if (callback) {
            callback({
              success: true,
              rideId: rideId,
              _id: existingRide._id.toString(),
              otp: existingRide.otp,
              message: "Ride already exists"
            });
          }
          return;
        }

        const distanceInKm = parseFloat(distance) || 0;
        const calculatedPrice = await calculateRidePrice(vehicleType, distanceInKm);
        console.log(`💰 Calculated price: ${calculatedPrice} for ${distanceInKm}km in ${vehicleType}`);

        const rideData = {
          user: userId,
          customerId: customerId,
          name: userName,
          userMobile: userMobile || "N/A",
          RAID_ID: rideId,
          pickupLocation: pickup.address || "Selected Location",
          dropoffLocation: drop.address || "Selected Location",
          pickupCoordinates: {
            latitude: pickup.lat,
            longitude: pickup.lng
          },
          dropoffCoordinates: {
            latitude: drop.lat,
            longitude: drop.lng
          },
          fare: calculatedPrice,
          rideType: vehicleType,
          otp: otp,
          distance: distance || "0 km",
          travelTime: travelTime || "0 mins",
          isReturnTrip: wantReturn || false,
          status: "pending",
          Raid_date: new Date(),
          Raid_time: new Date().toLocaleTimeString('en-US', { 
            timeZone: 'Asia/Kolkata', 
            hour12: true 
          }),
          pickup: {
            addr: pickup.address || "Selected Location",
            lat: pickup.lat,
            lng: pickup.lng,
          },
          drop: {
            addr: drop.address || "Selected Location",
            lat: drop.lat,
            lng: drop.lat,
          },
          price: calculatedPrice,
          distanceKm: distanceInKm
        };

        console.log('💾 Ride data to be saved:', JSON.stringify(rideData, null, 2));

        const newRide = new Ride(rideData);
        
        try {
          await newRide.validate();
          console.log('✅ Document validation passed');
        } catch (validationError) {
          console.error('❌ Document validation failed:', validationError);
          throw validationError;
        }

        const savedRide = await newRide.save();
        console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);
        console.log(`💾 RAID_ID in saved document: ${savedRide.RAID_ID}`);

        rides[rideId] = {
          ...data,
          rideId: rideId,
          status: "pending",
          timestamp: Date.now(),
          _id: savedRide._id.toString(),
          userLocation: { latitude: pickup.lat, longitude: pickup.lng }
        };

        userLocationTracking.set(userId, {
          latitude: pickup.lat,
          longitude: pickup.lng,
          lastUpdate: Date.now(),
          rideId: rideId
        });

        await saveUserLocationToDB(userId, pickup.lat, pickup.lng, rideId);

        console.log(`📍 Initialized user location tracking for user ${userId} at pickup location`);

        io.emit("newRideRequest", {
          ...data,
          rideId: rideId,
          _id: savedRide._id.toString(),
          price: calculatedPrice
        });

        if (callback) {
          callback({
            success: true,
            rideId: rideId,
            _id: savedRide._id.toString(),
            otp: otp,
            price: calculatedPrice,
            message: "Ride booked successfully!"
          });
        }

        console.log(`📡 Ride request broadcasted to all drivers with ID: ${rideId}`);
        logRideStatus();

      } catch (error) {
        console.error("❌ Error booking ride:", error);
        
        if (error.name === 'ValidationError') {
          const errors = Object.values(error.errors).map(err => err.message);
          console.error("❌ Validation errors:", errors);
          
          if (callback) {
            callback({
              success: false,
              message: `Validation failed: ${errors.join(', ')}`
            });
          }
        } else if (error.code === 11000 && error.keyPattern && error.keyPattern.RAID_ID) {
          console.log(`🔄 Duplicate RAID_ID detected: ${rideId}`);
          
          try {
            const existingRide = await Ride.findOne({ RAID_ID: rideId });
            if (existingRide && callback) {
              callback({
                success: true,
                rideId: rideId,
                _id: existingRide._id.toString(),
                otp: existingRide.otp,
                message: "Ride already exists (duplicate handled)"
              });
            }
          } catch (findError) {
            console.error("❌ Error finding existing ride:", findError);
            if (callback) {
              callback({
                success: false,
                message: "Failed to process ride booking (duplicate error)"
              });
            }
          }
        } else {
          if (callback) {
            callback({
              success: false,
              message: "Failed to process ride booking"
            });
          }
        }
      } finally {
        if (rideId) {
          processingRides.delete(rideId);
        }
      }
    });

    // JOIN ROOM
    socket.on('joinRoom', async (data) => {
      try {
        const { userId } = data;
        if (userId) {
          socket.join(userId.toString());
          console.log(`✅ User ${userId} joined their room via joinRoom event`);
        }
      } catch (error) {
        console.error('Error in joinRoom:', error);
      }
    });

    // ACCEPT RIDE
    socket.on("acceptRide", async (data, callback) => {
      const { rideId, driverId, driverName } = data;

      console.log("🚨 ===== BACKEND ACCEPT RIDE START =====");
      console.log("📥 Acceptance Data:", { rideId, driverId, driverName });
      console.log("🚨 ===== BACKEND ACCEPT RIDE END =====");

      try {
        console.log(`🔍 Looking for ride: ${rideId}`);
        const ride = await Ride.findOne({ RAID_ID: rideId });
        
        if (!ride) {
          console.error(`❌ Ride ${rideId} not found in database`);
          if (typeof callback === "function") {
            callback({ success: false, message: "Ride not found" });
          }
          return;
        }

        console.log(`✅ Found ride: ${ride.RAID_ID}, Status: ${ride.status}`);
        console.log(`📱 Fetched user mobile from DB: ${ride.userMobile || 'N/A'}`);

        if (ride.status === "accepted") {
          console.log(`🚫 Ride ${rideId} already accepted by: ${ride.driverId}`);
          
          socket.broadcast.emit("rideAlreadyAccepted", { 
            rideId,
            message: "This ride has already been accepted by another driver."
          });
          
          if (typeof callback === "function") {
            callback({ 
              success: false, 
              message: "This ride has already been accepted by another driver." 
            });
          }
          return;
        }

        console.log(`🔄 Updating ride status to 'accepted'`);
        ride.status = "accepted";
        ride.driverId = driverId;
        ride.driverName = driverName;

        const driver = await Driver.findOne({ driverId });
        console.log(`👨‍💼 Driver details:`, driver ? "Found" : "Not found");
        
        if (driver) {
          ride.driverMobile = driver.phone;
          console.log(`📱 Driver mobile: ${driver.phone}`);
        } else {
          ride.driverMobile = "N/A";
          console.log(`⚠️ Driver not found in Driver collection`);
        }

        if (!ride.otp) {
          const otp = Math.floor(1000 + Math.random() * 9000).toString();
          ride.otp = otp;
          console.log(`🔢 Generated new OTP: ${otp}`);
        } else {
          console.log(`🔢 Using existing OTP: ${ride.otp}`);
        }

        await ride.save();
        console.log(`💾 Ride saved successfully`);

        if (rides[rideId]) {
          rides[rideId].status = "accepted";
          rides[rideId].driverId = driverId;
          rides[rideId].driverName = driverName;
        }

        const driverData = {
          success: true,
          rideId: ride.RAID_ID,
          driverId: driverId,
          driverName: driverName,
          driverMobile: ride.driverMobile,
          driverLat: driver?.location?.coordinates?.[1] || 0,
          driverLng: driver?.location?.coordinates?.[0] || 0,
          otp: ride.otp,
          pickup: ride.pickup,
          drop: ride.drop,
          status: ride.status,
          vehicleType: driver?.vehicleType || "taxi",
          userName: ride.name,
          userMobile: rides[rideId]?.userMobile || ride.userMobile || "N/A",
          timestamp: new Date().toISOString()
        };

        console.log("📤 Prepared driver data:", JSON.stringify(driverData, null, 2));

        if (typeof callback === "function") {
          console.log("📨 Sending callback to driver");
          callback(driverData);
        }

        const userRoom = ride.user.toString();
        console.log(`📡 Notifying user room: ${userRoom}`);
        
        io.to(userRoom).emit("rideAccepted", driverData);
        console.log("✅ Notification sent via standard room channel");

        const userSockets = await io.in(userRoom).fetchSockets();
        console.log(`🔍 Found ${userSockets.length} sockets in user room`);
        userSockets.forEach((userSocket, index) => {
          userSocket.emit("rideAccepted", driverData);
          console.log(`✅ Notification sent to user socket ${index + 1}: ${userSocket.id}`);
        });

        io.emit("rideAcceptedGlobal", {
          ...driverData,
          targetUserId: userRoom,
          timestamp: new Date().toISOString()
        });
        console.log("✅ Global notification sent with user filter");

        setTimeout(() => {
          io.to(userRoom).emit("rideAccepted", driverData);
          console.log("✅ Backup notification sent after delay");
        }, 1000);

        const userDataForDriver = {
          success: true,
          rideId: ride.RAID_ID,
          userId: ride.user,
          customerId: ride.customerId,
          userName: ride.name,
          userMobile: rides[rideId]?.userMobile || ride.userMobile || "N/A",
          pickup: ride.pickup,
          drop: ride.drop,
          otp: ride.otp,
          status: ride.status,
          timestamp: new Date().toISOString()
        };

        console.log("📤 Prepared user data for driver:", JSON.stringify(userDataForDriver, null, 2));

        const driverSocket = Array.from(io.sockets.sockets.values()).find(s => s.driverId === driverId);
        if (driverSocket) {
          driverSocket.emit("userDataForDriver", userDataForDriver);
          console.log("✅ User data sent to driver:", driverId);
        } else {
          io.to(`driver_${driverId}`).emit("userDataForDriver", userDataForDriver);
          console.log("✅ User data sent to driver room:", driverId);
        }

        socket.broadcast.emit("rideAlreadyAccepted", { 
          rideId,
          message: "This ride has already been accepted by another driver."
        });
        console.log("📢 Other drivers notified");

        if (activeDriverSockets.has(driverId)) {
          const driverInfo = activeDriverSockets.get(driverId);
          driverInfo.status = "onRide";
          driverInfo.isOnline = true;
          activeDriverSockets.set(driverId, driverInfo);
          console.log(`🔄 Updated driver ${driverId} status to 'onRide'`);
        }

        console.log(`🎉 RIDE ${rideId} ACCEPTED SUCCESSFULLY BY ${driverName}`);

      } catch (error) {
        console.error(`❌ ERROR ACCEPTING RIDE ${rideId}:`, error);
        console.error("Stack:", error.stack);
        
        if (typeof callback === "function") {
          callback({ 
            success: false, 
            message: "Server error: " + error.message 
          });
        }
      }
    });

    // USER LOCATION UPDATE
    socket.on("userLocationUpdate", async (data) => {
      try {
        const { userId, rideId, latitude, longitude } = data;
        
        console.log(`📍 USER LOCATION UPDATE: User ${userId} for ride ${rideId}`);
        console.log(`🗺️  User coordinates: ${latitude}, ${longitude}`);
        
        userLocationTracking.set(userId, {
          latitude,
          longitude,
          lastUpdate: Date.now(),
          rideId: rideId
        });
        
        logUserLocationUpdate(userId, { latitude, longitude }, rideId);
        
        await saveUserLocationToDB(userId, latitude, longitude, rideId);
        
        if (rides[rideId]) {
          rides[rideId].userLocation = { latitude, longitude };
          console.log(`✅ Updated user location in memory for ride ${rideId}`);
        }
        
        let driverId = null;
        
        if (rides[rideId] && rides[rideId].driverId) {
          driverId = rides[rideId].driverId;
          console.log(`✅ Found driver ID in memory: ${driverId} for ride ${rideId}`);
        } else {
          const ride = await Ride.findOne({ RAID_ID: rideId });
          if (ride && ride.driverId) {
            driverId = ride.driverId;
            console.log(`✅ Found driver ID in database: ${driverId} for ride ${rideId}`);
            
            if (!rides[rideId]) {
              rides[rideId] = {};
            }
            rides[rideId].driverId = driverId;
          } else {
            console.log(`❌ No driver assigned for ride ${rideId} in database either`);
            return;
          }
        }
        
        const driverRoom = `driver_${driverId}`;
        const locationData = {
          rideId: rideId,
          userId: userId,
          lat: latitude,
          lng: longitude,
          timestamp: Date.now()
        };
        
        console.log(`📡 Sending user location to driver ${driverId} in room ${driverRoom}:`, locationData);
        
        io.to(driverRoom).emit("userLiveLocationUpdate", locationData);
        io.emit("userLiveLocationUpdate", locationData);
        
        console.log(`📡 Sent user location to driver ${driverId} and all drivers`);
        
      } catch (error) {
        console.error("❌ Error processing user location update:", error);
      }
    });

    // GET USER DATA FOR DRIVER
    socket.on("getUserDataForDriver", async (data, callback) => {
      try {
        const { rideId } = data;
        
        console.log(`👤 Driver requested user data for ride: ${rideId}`);
        
        const ride = await Ride.findOne({ RAID_ID: rideId }).populate('user');
        if (!ride) {
          if (typeof callback === "function") {
            callback({ success: false, message: "Ride not found" });
          }
          return;
        }
        
        let userCurrentLocation = null;
        if (userLocationTracking.has(ride.user.toString())) {
          const userLoc = userLocationTracking.get(ride.user.toString());
          userCurrentLocation = {
            latitude: userLoc.latitude,
            longitude: userLoc.longitude
          };
        }
        
        const userData = {
          success: true,
          rideId: ride.RAID_ID,
          userId: ride.user?._id || ride.user,
          userName: ride.name || "Customer",
          userMobile: rides[rideId]?.userMobile || ride.userMobile || ride.user?.phoneNumber || "N/A",
          userPhoto: ride.user?.profilePhoto || null,
          pickup: ride.pickup,
          drop: ride.drop,
          userCurrentLocation: userCurrentLocation,
          otp: ride.otp,
          fare: ride.fare,
          distance: ride.distance
        };
        
        console.log(`📤 Sending user data to driver for ride ${rideId}`);
        if (userCurrentLocation) {
          console.log(`📍 User's current location: ${userCurrentLocation.latitude}, ${userCurrentLocation.longitude}`);
        } else {
          console.log(`📍 User's current location: Not available`);
        }
        
        if (typeof callback === "function") {
          callback(userData);
        }
        
      } catch (error) {
        console.error("❌ Error getting user data for driver:", error);
        if (typeof callback === "function") {
          callback({ success: false, message: error.message });
        }
      }
    });

    // REJECT RIDE
    socket.on("rejectRide", (data) => {
      try {
        const { rideId, driverId } = data;
        
        console.log(`\n❌ RIDE REJECTED: ${rideId}`);
        console.log(`🚗 Driver: ${driverId}`);
        
        if (rides[rideId]) {
          rides[rideId].status = "rejected";
          rides[rideId].rejectedAt = Date.now();
          
          if (activeDriverSockets.has(driverId)) {
            const driverData = activeDriverSockets.get(driverId);
            driverData.status = "Live";
            driverData.isOnline = true;
            activeDriverSockets.set(driverId, driverData);
            
            socket.emit("driverStatusUpdate", {
              driverId,
              status: "Live"
            });
          }
          
          logRideStatus();
        }
      } catch (error) {
        console.error("❌ Error rejecting ride:", error);
      }
    });
    
    // COMPLETE RIDE
    socket.on("completeRide", (data) => {
      try {
        const { rideId, driverId, distance } = data;
        
        console.log(`\n🎉 RIDE COMPLETED: ${rideId}`);
        console.log(`🚗 Driver: ${driverId}`);
        console.log(`📏 Distance: ${distance.toFixed(2)} km`);
        
        if (rides[rideId]) {
          rides[rideId].status = "completed";
          rides[rideId].completedAt = Date.now();
          rides[rideId].distance = distance;
          
          const userId = rides[rideId].userId;
          io.to(userId).emit("rideCompleted", {
            rideId,
            distance
          });
          
          if (activeDriverSockets.has(driverId)) {
            const driverData = activeDriverSockets.get(driverId);
            driverData.status = "Live";
            driverData.isOnline = true;
            activeDriverSockets.set(driverId, driverData);
            
            socket.emit("driverStatusUpdate", {
              driverId,
              status: "Live"
            });
          }
          
          setTimeout(() => {
            delete rides[rideId];
            console.log(`🗑️  Removed completed ride: ${rideId}`);
          }, 5000);
          
          logRideStatus();
        }
      } catch (error) {
        console.error("❌ Error completing ride:", error);
      }
    });

    // DRIVER HEARTBEAT
    socket.on("driverHeartbeat", ({ driverId }) => {
      if (activeDriverSockets.has(driverId)) {
        const driverData = activeDriverSockets.get(driverId);
        driverData.lastUpdate = Date.now();
        driverData.isOnline = true;
        activeDriverSockets.set(driverId, driverData);
        
        console.log(`❤️  Heartbeat received from driver: ${driverId}`);
      }
    });
    
    // DISCONNECT
    socket.on("disconnect", (reason) => {
      console.log(`\n❌ Client disconnected: ${socket.id}, Reason: ${reason}`);
      console.log(`📱 Remaining connected clients: ${io.engine.clientsCount}`);
      
      if (socket.driverId) {
        console.log(`🛑 Driver ${socket.driverName} (${socket.driverId}) disconnected`);
        
        if (activeDriverSockets.has(socket.driverId)) {
          const driverData = activeDriverSockets.get(socket.driverId);
          driverData.isOnline = false;
          driverData.status = "Offline";
          activeDriverSockets.set(socket.driverId, driverData);
          
          saveDriverLocationToDB(
            socket.driverId, 
            socket.driverName,
            driverData.location.latitude, 
            driverData.location.longitude, 
            driverData.vehicleType,
            "Offline"
          ).catch(console.error);
        }
        
        broadcastDriverLocationsToAllUsers();
        logDriverStatus();
      }
    });
  });
  
  // Clean up offline drivers every 60 seconds
  setInterval(() => {
    const now = Date.now();
    const fiveMinutesAgo = now - 300000;
    let cleanedCount = 0;
    
    Array.from(activeDriverSockets.entries()).forEach(([driverId, driver]) => {
      if (!driver.isOnline && driver.lastUpdate < fiveMinutesAgo) {
        activeDriverSockets.delete(driverId);
        cleanedCount++;
        console.log(`🧹 Removed offline driver: ${driverId}`);
      }
    });
    
    const thirtyMinutesAgo = now - 1800000;
    Array.from(userLocationTracking.entries()).forEach(([userId, data]) => {
      if (data.lastUpdate < thirtyMinutesAgo) {
        userLocationTracking.delete(userId);
        cleanedCount++;
        console.log(`🧹 Removed stale user location tracking for user: ${userId}`);
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`\n🧹 Cleaned up ${cleanedCount} stale entries`);
      broadcastDriverLocationsToAllUsers();
      logDriverStatus();
    }
  }, 60000);
};

const getIO = () => {
  if (!io) throw new Error("❌ Socket.io not initialized!");
  return io;
};

module.exports = { init, getIO };

// const { Server } = require("socket.io");
// const DriverLocation = require("./models/driver/DriverLocation");
// const Driver = require("./models/driver/driver");
// const Ride = require("./models/shared/ride");
// const RaidId = require("./models/user/raidId");
// const UserLocation = require("./models/user/UserLocation");
// const mongoose = require('mongoose');

// let io;
// let isInitialized = false;
// const rides = {};
// const activeDriverSockets = new Map();
// const processingRides = new Set();
// const userLocationTracking = new Map();

// // Helper function to log current driver status
// const logDriverStatus = () => {
//   console.log("\n📊 === CURRENT DRIVER STATUS ===");
//   if (activeDriverSockets.size === 0) {
//     console.log("❌ No drivers currently online");
//   } else {
//     console.log(`✅ ${activeDriverSockets.size} drivers currently online:`);
//     activeDriverSockets.forEach((driver, driverId) => {
//       const timeSinceUpdate = Math.floor((Date.now() - driver.lastUpdate) / 1000);
//       console.log(`  🚗 ${driver.driverName} (${driverId})`);
//       console.log(`     Status: ${driver.status}`);
//       console.log(`     Vehicle: ${driver.vehicleType}`);
//       console.log(`     Location: ${driver.location.latitude.toFixed(6)}, ${driver.location.longitude.toFixed(6)}`);
//       console.log(`     Last update: ${timeSinceUpdate}s ago`);
//       console.log(`     Socket: ${driver.socketId}`);
//       console.log(`     Online: ${driver.isOnline ? 'Yes' : 'No'}`);
//     });
//   }
//   console.log("================================\n");
// };

// // Helper function to log ride status
// const logRideStatus = () => {
//   console.log("\n🚕 === CURRENT RIDE STATUS ===");
//   const rideEntries = Object.entries(rides);
//   if (rideEntries.length === 0) {
//     console.log("❌ No active rides");
//   } else {
//     console.log(`✅ ${rideEntries.length} active rides:`);
//     rideEntries.forEach(([rideId, ride]) => {
//       console.log(`  📍 Ride ${rideId}:`);
//       console.log(`     Status: ${ride.status}`);
//       console.log(`     Driver: ${ride.driverId || 'Not assigned'}`);
//       console.log(`     User ID: ${ride.userId}`);
//       console.log(`     Customer ID: ${ride.customerId}`);
//       console.log(`     User Name: ${ride.userName}`);
//       console.log(`     User Mobile: ${ride.userMobile}`);
//       console.log(`     Pickup: ${ride.pickup?.address || ride.pickup?.lat + ',' + ride.pickup?.lng}`);
//       console.log(`     Drop: ${ride.drop?.address || ride.drop?.lat + ',' + ride.drop?.lng}`);
      
//       if (userLocationTracking.has(ride.userId)) {
//         const userLoc = userLocationTracking.get(ride.userId);
//         console.log(`     📍 USER CURRENT/LIVE LOCATION: ${userLoc.latitude}, ${userLoc.longitude}`);
//         console.log(`     📍 Last location update: ${new Date(userLoc.lastUpdate).toLocaleTimeString()}`);
//       } else {
//         console.log(`     📍 USER CURRENT/LIVE LOCATION: Not available`);
//       }
//     });
//   }
//   console.log("================================\n");
// };

// // Function to log user location updates
// const logUserLocationUpdate = (userId, location, rideId) => {
//   console.log(`\n📍 === USER LOCATION UPDATE ===`);
//   console.log(`👤 User ID: ${userId}`);
//   console.log(`🚕 Ride ID: ${rideId}`);
//   console.log(`🗺️  Current Location: ${location.latitude}, ${location.longitude}`);
//   console.log(`⏰ Update Time: ${new Date().toLocaleTimeString()}`);
//   console.log("================================\n");
// };

// // Function to save user location to database
// const saveUserLocationToDB = async (userId, latitude, longitude, rideId = null) => {
//   try {
//     const userLocation = new UserLocation({
//       userId,
//       latitude,
//       longitude,
//       rideId,
//       timestamp: new Date()
//     });
    
//     await userLocation.save();
//     console.log(`💾 Saved user location to DB: User ${userId}, Ride ${rideId}, Location: ${latitude}, ${longitude}`);
//     return true;
//   } catch (error) {
//     console.error("❌ Error saving user location to DB:", error);
//     return false;
//   }
// };

// // Test the RaidId model on server startup
// async function testRaidIdModel() {
//   try {
//     console.log('🧪 Testing RaidId model...');
//     const testDoc = await RaidId.findOne({ _id: 'raidId' });
//     console.log('🧪 RaidId document:', testDoc);
    
//     if (!testDoc) {
//       console.log('🧪 Creating initial RaidId document');
//       const newDoc = new RaidId({ _id: 'raidId', sequence: 100000 });
//       await newDoc.save();
//       console.log('🧪 Created initial RaidId document');
//     }
//   } catch (error) {
//     console.error('❌ Error testing RaidId model:', error);
//   }
// }

// // RAID_ID generation function
// async function generateSequentialRaidId() {
//   try {
//     console.log('🔢 Starting RAID_ID generation');
    
//     const raidIdDoc = await RaidId.findOneAndUpdate(
//       { _id: 'raidId' },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );
    
//     console.log('🔢 RAID_ID document:', raidIdDoc);

//     let sequenceNumber = raidIdDoc.sequence;
//     console.log('🔢 Sequence number:', sequenceNumber);

//     if (sequenceNumber > 999999) {
//       console.log('🔄 Resetting sequence to 100000');
//       await RaidId.findOneAndUpdate(
//         { _id: 'raidId' },
//         { sequence: 100000 }
//       );
//       sequenceNumber = 100000;
//     }

//     const formattedSequence = sequenceNumber.toString().padStart(6, '0');
//     const raidId = `RID${formattedSequence}`;
//     console.log(`🔢 Generated RAID_ID: ${raidId}`);
    
//     return raidId;
//   } catch (error) {
//     console.error('❌ Error generating sequential RAID_ID:', error);
    
//     const timestamp = Date.now().toString().slice(-6);
//     const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//     const fallbackId = `RID${timestamp}${random}`;
//     console.log(`🔄 Using fallback ID: ${fallbackId}`);
    
//     return fallbackId;
//   }
// }

// // Helper function to save driver location to database
// async function saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType, status = "Live") {
//   try {
//     const locationDoc = new DriverLocation({
//       driverId,
//       driverName,
//       latitude,
//       longitude,
//       vehicleType,
//       status,
//       timestamp: new Date()
//     });
    
//     await locationDoc.save();
//     console.log(`💾 Saved location for driver ${driverId} (${driverName}) to database`);
//     return true;
//   } catch (error) {
//     console.error("❌ Error saving driver location to DB:", error);
//     return false;
//   }
// }

// // Helper function to broadcast driver locations to all users
// function broadcastDriverLocationsToAllUsers() {
//   const drivers = Array.from(activeDriverSockets.values())
//     .filter(driver => driver.isOnline)
//     .map(driver => ({
//       driverId: driver.driverId,
//       name: driver.driverName,
//       location: {
//         coordinates: [driver.location.longitude, driver.location.latitude]
//       },
//       vehicleType: driver.vehicleType,
//       status: driver.status,
//       lastUpdate: driver.lastUpdate
//     }));
  
//   io.emit("driverLocationsUpdate", { drivers });
// }

// const init = (server) => {
//   // Prevent multiple initializations
//   if (isInitialized) {
//     console.log("⚠️ Socket.IO already initialized, skipping...");
//     return;
//   }

//   io = new Server(server, {
//     cors: { 
//       origin: "*", 
//       methods: ["GET", "POST"] 
//     },
//     pingTimeout: 60000,
//     pingInterval: 25000
//   });
  
//   isInitialized = true;
  
//   // Test the RaidId model on startup
//   testRaidIdModel();
  
//   // Log server status every 10 seconds (reduced frequency)
//   setInterval(() => {
//     console.log(`\n⏰ ${new Date().toLocaleString()} - Server Status Check`);
//     logDriverStatus();
//     logRideStatus();
//   }, 10000);
  
//   io.on("connection", (socket) => {
//     console.log(`\n⚡ New client connected: ${socket.id}`);
//     console.log(`📱 Total connected clients: ${io.engine.clientsCount}`);
    
//     // Set connection timestamp
//     socket.connectedAt = Date.now();

//     // ========== REAL-TIME DRIVER LOCATION BROADCASTING ==========
    
//     socket.on("driverLocationUpdate", async (data) => {
//       try {
//         const { driverId, latitude, longitude, status } = data;
        
//         console.log(`📍 REAL-TIME: Driver ${driverId} location update received`);
//         console.log(`🗺️  Coordinates: ${latitude}, ${longitude}, Status: ${status}`);
        
//         if (activeDriverSockets.has(driverId)) {
//           const driverData = activeDriverSockets.get(driverId);
//           driverData.location = { latitude, longitude };
//           driverData.lastUpdate = Date.now();
//           driverData.status = status || "Live";
//           driverData.isOnline = true;
//           activeDriverSockets.set(driverId, driverData);
          
//           console.log(`✅ Updated driver ${driverId} location in memory`);
//         }
        
//         // Broadcast to ALL connected users in REAL-TIME
//         io.emit("driverLiveLocationUpdate", {
//           driverId: driverId,
//           lat: latitude,
//           lng: longitude,
//           status: status || "Live",
//           vehicleType: "taxi",
//           timestamp: Date.now()
//         });
        
//         console.log(`📡 Broadcasted driver ${driverId} location to ALL users`);
        
//         // Also update database
//         const driverData = activeDriverSockets.get(driverId);
//         if (driverData) {
//           await saveDriverLocationToDB(
//             driverId, 
//             driverData.driverName || "Unknown", 
//             latitude, 
//             longitude, 
//             "taxi", 
//             status || "Live"
//           );
//         }
        
//       } catch (error) {
//         console.error("❌ Error processing driver location update:", error);
//       }
//     });
    
//     socket.on("driverLiveLocationUpdate", async ({ driverId, driverName, lat, lng }) => {
//       try {
//         if (activeDriverSockets.has(driverId)) {
//           const driverData = activeDriverSockets.get(driverId);
//           driverData.location = { latitude: lat, longitude: lng };
//           driverData.lastUpdate = Date.now();
//           driverData.isOnline = true;
//           activeDriverSockets.set(driverId, driverData);
          
//           console.log(`\n📍 DRIVER LOCATION UPDATE: ${driverName} (${driverId})`);
//           console.log(`🗺️  New location: ${lat}, ${lng}`);
          
//           // Save to database immediately
//           await saveDriverLocationToDB(driverId, driverName, lat, lng, driverData.vehicleType);
          
//           // Broadcast real-time update to ALL users
//           io.emit("driverLiveLocationUpdate", {
//             driverId: driverId,
//             lat: lat,
//             lng: lng,
//             status: driverData.status,
//             vehicleType: driverData.vehicleType,
//             timestamp: Date.now()
//           });
          
//           console.log(`📡 Real-time update broadcasted for driver ${driverId}`);
//         }
//       } catch (error) {
//         console.error("❌ Error updating driver location:", error);
//       }
//     });
    
//     // ========== END OF REAL-TIME BROADCASTING CODE ==========
    
//     // USER REGISTRATION
//     socket.on('registerUser', ({ userId, userMobile }) => {
//       if (!userId) {
//         console.error('❌ No userId provided for user registration');
//         return;
//       }
      
//       socket.userId = userId.toString();
//       socket.join(userId.toString());
      
//       console.log(`👤 USER REGISTERED SUCCESSFULLY:`);
//       console.log(`   User ID: ${userId}`);
//       console.log(`   Mobile: ${userMobile || 'Not provided'}`);
//       console.log(`   Socket ID: ${socket.id}`);
//       console.log(`   Room: ${userId.toString()}`);
//     });
    
//     // DRIVER REGISTRATION (WITH DUPLICATION CHECK)
//     socket.on("registerDriver", async ({ driverId, driverName, latitude, longitude, vehicleType = "taxi" }) => {
//       try {
//         console.log(`\n📝 DRIVER REGISTRATION ATTEMPT RECEIVED:`);
//         console.log(`   Driver ID: ${driverId}`);
//         console.log(`   Driver Name: ${driverName}`);
//         console.log(`   Location: ${latitude}, ${longitude}`);
//         console.log(`   Vehicle: ${vehicleType}`);
//         console.log(`   Socket ID: ${socket.id}`);
        
//         if (!driverId) {
//           console.log("❌ Registration failed: No driverId provided");
//           return;
//         }
        
//         if (!latitude || !longitude) {
//           console.log("❌ Registration failed: Invalid location");
//           return;
//         }

//         // Check if driver is already registered in this socket
//         if (socket.driverId === driverId) {
//           console.log(`⚠️ Driver ${driverId} already registered on this socket, skipping...`);
//           return;
//         }

//         socket.driverId = driverId;
//         socket.driverName = driverName;
        
//         // Check if driver is already active (but allow reconnection from different socket)
//         if (activeDriverSockets.has(driverId)) {
//           const existingDriver = activeDriverSockets.get(driverId);
//           console.log(`⚠️ Driver ${driverId} already active, updating socket...`);
          
//           // Update socket information but keep other data
//           existingDriver.socketId = socket.id;
//           existingDriver.lastUpdate = Date.now();
//           existingDriver.isOnline = true;
//           activeDriverSockets.set(driverId, existingDriver);
//         } else {
//           // New registration
//           activeDriverSockets.set(driverId, {
//             socketId: socket.id,
//             driverId,
//             driverName,
//             location: { latitude, longitude },
//             vehicleType,
//             lastUpdate: Date.now(),
//             status: "Live",
//             isOnline: true
//           });
//         }
        
//         // Join driver to rooms
//         socket.join("allDrivers");
//         socket.join(`driver_${driverId}`);
        
//         console.log(`✅ DRIVER REGISTERED/UPDATED SUCCESSFULLY: ${driverName} (${driverId})`);
//         console.log(`📍 Location: ${latitude}, ${longitude}`);
//         console.log(`🚗 Vehicle: ${vehicleType}`);
//         console.log(`🔌 Socket ID: ${socket.id}`);
        
//         // Save initial location to database
//         await saveDriverLocationToDB(driverId, driverName, latitude, longitude, vehicleType);
        
//         // Broadcast updated driver list to ALL connected users
//         broadcastDriverLocationsToAllUsers();
        
//         // Send confirmation to driver
//         socket.emit("driverRegistrationConfirmed", {
//           success: true,
//           message: "Driver registered successfully"
//         });
        
//         // Log current status
//         logDriverStatus();
        
//       } catch (error) {
//         console.error("❌ Error registering driver:", error);
        
//         socket.emit("driverRegistrationConfirmed", {
//           success: false,
//           message: "Registration failed: " + error.message
//         });
//       }
//     });

//     // REQUEST NEARBY DRIVERS
//     socket.on("requestNearbyDrivers", ({ latitude, longitude, radius = 5000 }) => {
//       try {
//         console.log(`\n🔍 USER REQUESTED NEARBY DRIVERS: ${socket.id}`);
//         console.log(`📍 User location: ${latitude}, ${longitude}`);
//         console.log(`📏 Search radius: ${radius}m`);

//         const drivers = Array.from(activeDriverSockets.values())
//           .filter(driver => driver.isOnline)
//           .map(driver => ({
//             driverId: driver.driverId,
//             name: driver.driverName,
//             location: {
//               coordinates: [driver.location.longitude, driver.location.latitude]
//             },
//             vehicleType: driver.vehicleType,
//             status: driver.status,
//             lastUpdate: driver.lastUpdate
//           }));

//         console.log(`📊 Active drivers in memory: ${activeDriverSockets.size}`);
//         console.log(`📊 Online drivers: ${drivers.length}`);
        
//         drivers.forEach((driver, index) => {
//           console.log(`🚗 Driver ${index + 1}: ${driver.name} (${driver.driverId})`);
//           console.log(`   Location: ${driver.location.coordinates[1]}, ${driver.location.coordinates[0]}`);
//           console.log(`   Status: ${driver.status}`);
//         });

//         console.log(`📤 Sending ${drivers.length} online drivers to user`);

//         socket.emit("nearbyDriversResponse", { drivers });
//       } catch (error) {
//         console.error("❌ Error fetching nearby drivers:", error);
//         socket.emit("nearbyDriversResponse", { drivers: [] });
//       }
//     });

//     // BOOK RIDE
//     socket.on("bookRide", async (data, callback) => {
//       let rideId;
//       try {
//         const { userId, customerId, userName, userMobile, pickup, drop, vehicleType, estimatedPrice, distance, travelTime, wantReturn } = data;

//         console.log('📥 Received bookRide request with data:', JSON.stringify(data, null, 2));

//         // Generate sequential RAID_ID on backend
//         rideId = await generateSequentialRaidId();
//         console.log(`🆔 Generated RAID_ID: ${rideId}`);
        
//         console.log(`\n🚕 NEW RIDE BOOKING REQUEST: ${rideId}`);
//         console.log(`👤 User ID: ${userId}`);
//         console.log(`👤 Customer ID: ${customerId}`);
//         console.log(`👤 Name: ${userName}`);
//         console.log(`📱 Mobile: ${userMobile}`);
//         console.log(`📍 Pickup: ${JSON.stringify(pickup)}`);
//         console.log(`📍 Drop: ${JSON.stringify(drop)}`);
//         console.log(`🚗 Vehicle type: ${vehicleType}`);

//         // Generate OTP from customer ID (last 4 digits)
//         let otp;
//         if (customerId && customerId.length >= 4) {
//           otp = customerId.slice(-4);
//         } else {
//           otp = Math.floor(1000 + Math.random() * 9000).toString();
//         }
//         console.log(`🔢 OTP: ${otp}`);

//         // Check if this ride is already being processed
//         if (processingRides.has(rideId)) {
//           console.log(`⏭️  Ride ${rideId} is already being processed, skipping`);
//           if (callback) {
//             callback({
//               success: false,
//               message: "Ride is already being processed"
//             });
//           }
//           return;
//         }
        
//         processingRides.add(rideId);

//         // Validate required fields
//         if (!userId || !customerId || !userName || !pickup || !drop) {
//           console.error("❌ Missing required fields");
//           processingRides.delete(rideId);
//           if (callback) {
//             callback({
//               success: false,
//               message: "Missing required fields"
//             });
//           }
//           return;
//         }

//         // Check if ride with this ID already exists in database
//         const existingRide = await Ride.findOne({ RAID_ID: rideId });
//         if (existingRide) {
//           console.log(`⏭️  Ride ${rideId} already exists in database, skipping`);
//           processingRides.delete(rideId);
//           if (callback) {
//             callback({
//               success: true,
//               rideId: rideId,
//               _id: existingRide._id.toString(),
//               otp: existingRide.otp,
//               message: "Ride already exists"
//             });
//           }
//           return;
//         }

//         // Create a new ride document in MongoDB
//         const rideData = {
//           user: userId,
//           customerId: customerId,
//           name: userName,
//           userMobile: userMobile || "N/A",
//           RAID_ID: rideId,
//           pickupLocation: pickup.address || "Selected Location",
//           dropoffLocation: drop.address || "Selected Location",
//           pickupCoordinates: {
//             latitude: pickup.lat,
//             longitude: pickup.lng
//           },
//           dropoffCoordinates: {
//             latitude: drop.lat,
//             longitude: drop.lng
//           },
//           fare: estimatedPrice || 0,
//           rideType: vehicleType,
//           otp: otp,
//           distance: distance || "0 km",
//           travelTime: travelTime || "0 mins",
//           isReturnTrip: wantReturn || false,
//           status: "pending",
//           Raid_date: new Date(),
//           Raid_time: new Date().toLocaleTimeString('en-US', { 
//             timeZone: 'Asia/Kolkata', 
//             hour12: true 
//           }),
//           pickup: {
//             addr: pickup.address || "Selected Location",
//             lat: pickup.lat,
//             lng: pickup.lng,
//           },
//           drop: {
//             addr: drop.address || "Selected Location",
//             lat: drop.lat,
//             lng: drop.lng,
//           },
//           price: estimatedPrice || 0,
//           distanceKm: parseFloat(distance) || 0
//         };

//         console.log('💾 Ride data to be saved:', JSON.stringify(rideData, null, 2));

//         const newRide = new Ride(rideData);
        
//         try {
//           await newRide.validate();
//           console.log('✅ Document validation passed');
//         } catch (validationError) {
//           console.error('❌ Document validation failed:', validationError);
//           throw validationError;
//         }

//         const savedRide = await newRide.save();
//         console.log(`💾 Ride saved to MongoDB with ID: ${savedRide._id}`);
//         console.log(`💾 RAID_ID in saved document: ${savedRide.RAID_ID}`);

//         // Store ride data in memory for socket operations
//         rides[rideId] = {
//           ...data,
//           rideId: rideId,
//           status: "pending",
//           timestamp: Date.now(),
//           _id: savedRide._id.toString(),
//           userLocation: { latitude: pickup.lat, longitude: pickup.lng }
//         };

//         // Initialize user location tracking
//         userLocationTracking.set(userId, {
//           latitude: pickup.lat,
//           longitude: pickup.lng,
//           lastUpdate: Date.now(),
//           rideId: rideId
//         });

//         // Save initial user location to database
//         await saveUserLocationToDB(userId, pickup.lat, pickup.lng, rideId);

//         console.log(`📍 Initialized user location tracking for user ${userId} at pickup location`);

//         // Broadcast to all drivers
//         io.emit("newRideRequest", {
//           ...data,
//           rideId: rideId,
//           _id: savedRide._id.toString()
//         });

//         // Send success response with backend-generated rideId
//         if (callback) {
//           callback({
//             success: true,
//             rideId: rideId,
//             _id: savedRide._id.toString(),
//             otp: otp,
//             message: "Ride booked successfully!"
//           });
//         }

//         console.log(`📡 Ride request broadcasted to all drivers with ID: ${rideId}`);
//         logRideStatus();

//       } catch (error) {
//         console.error("❌ Error booking ride:", error);
        
//         if (error.name === 'ValidationError') {
//           const errors = Object.values(error.errors).map(err => err.message);
//           console.error("❌ Validation errors:", errors);
          
//           if (callback) {
//             callback({
//               success: false,
//               message: `Validation failed: ${errors.join(', ')}`
//             });
//           }
//         } 
//         else if (error.code === 11000 && error.keyPattern && error.keyPattern.RAID_ID) {
//           console.log(`🔄 Duplicate RAID_ID detected: ${rideId}`);
          
//           try {
//             const existingRide = await Ride.findOne({ RAID_ID: rideId });
//             if (existingRide && callback) {
//               callback({
//                 success: true,
//                 rideId: rideId,
//                 _id: existingRide._id.toString(),
//                 otp: existingRide.otp,
//                 message: "Ride already exists (duplicate handled)"
//               });
//             }
//           } catch (findError) {
//             console.error("❌ Error finding existing ride:", findError);
//             if (callback) {
//               callback({
//                 success: false,
//                 message: "Failed to process ride booking (duplicate error)"
//               });
//             }
//           }
//         } else {
//           if (callback) {
//             callback({
//               success: false,
//               message: "Failed to process ride booking"
//             });
//           }
//         }
//       } finally {
//         if (rideId) {
//           processingRides.delete(rideId);
//         }
//       }
//     });

//     // JOIN ROOM
//     socket.on('joinRoom', async (data) => {
//       try {
//         const { userId } = data;
//         if (userId) {
//           socket.join(userId.toString());
//           console.log(`✅ User ${userId} joined their room via joinRoom event`);
//         }
//       } catch (error) {
//         console.error('Error in joinRoom:', error);
//       }
//     });

//     // ACCEPT RIDE
//     socket.on("acceptRide", async (data, callback) => {
//       const { rideId, driverId, driverName } = data;

//       console.log("🚨 ===== BACKEND ACCEPT RIDE START =====");
//       console.log("📥 Acceptance Data:", { rideId, driverId, driverName });
//       console.log("🚨 ===== BACKEND ACCEPT RIDE END =====");

//       try {
//         console.log(`🔍 Looking for ride: ${rideId}`);
//         const ride = await Ride.findOne({ RAID_ID: rideId });
        
//         if (!ride) {
//           console.error(`❌ Ride ${rideId} not found in database`);
//           if (typeof callback === "function") {
//             callback({ success: false, message: "Ride not found" });
//           }
//           return;
//         }

//         console.log(`✅ Found ride: ${ride.RAID_ID}, Status: ${ride.status}`);
//         console.log(`📱 Fetched user mobile from DB: ${ride.userMobile || 'N/A'}`);

//         if (ride.status === "accepted") {
//           console.log(`🚫 Ride ${rideId} already accepted by: ${ride.driverId}`);
          
//           socket.broadcast.emit("rideAlreadyAccepted", { 
//             rideId,
//             message: "This ride has already been accepted by another driver."
//           });
          
//           if (typeof callback === "function") {
//             callback({ 
//               success: false, 
//               message: "This ride has already been accepted by another driver." 
//             });
//           }
//           return;
//         }

//         console.log(`🔄 Updating ride status to 'accepted'`);
//         ride.status = "accepted";
//         ride.driverId = driverId;
//         ride.driverName = driverName;

//         const driver = await Driver.findOne({ driverId });
//         console.log(`👨‍💼 Driver details:`, driver ? "Found" : "Not found");
        
//         if (driver) {
//           ride.driverMobile = driver.phone;
//           console.log(`📱 Driver mobile: ${driver.phone}`);
//         } else {
//           ride.driverMobile = "N/A";
//           console.log(`⚠️ Driver not found in Driver collection`);
//         }

//         if (!ride.otp) {
//           const otp = Math.floor(1000 + Math.random() * 9000).toString();
//           ride.otp = otp;
//           console.log(`🔢 Generated new OTP: ${otp}`);
//         } else {
//           console.log(`🔢 Using existing OTP: ${ride.otp}`);
//         }

//         await ride.save();
//         console.log(`💾 Ride saved successfully`);

//         if (rides[rideId]) {
//           rides[rideId].status = "accepted";
//           rides[rideId].driverId = driverId;
//           rides[rideId].driverName = driverName;
//         }

//         const driverData = {
//           success: true,
//           rideId: ride.RAID_ID,
//           driverId: driverId,
//           driverName: driverName,
//           driverMobile: ride.driverMobile,
//           driverLat: driver?.location?.coordinates?.[1] || 0,
//           driverLng: driver?.location?.coordinates?.[0] || 0,
//           otp: ride.otp,
//           pickup: ride.pickup,
//           drop: ride.drop,
//           status: ride.status,
//           vehicleType: driver?.vehicleType || "taxi",
//           userName: ride.name,
//           userMobile: rides[rideId]?.userMobile || ride.userMobile || "N/A",
//           timestamp: new Date().toISOString()
//         };

//         console.log("📤 Prepared driver data:", JSON.stringify(driverData, null, 2));

//         if (typeof callback === "function") {
//           console.log("📨 Sending callback to driver");
//           callback(driverData);
//         }

//         const userRoom = ride.user.toString();
//         console.log(`📡 Notifying user room: ${userRoom}`);
        
//         io.to(userRoom).emit("rideAccepted", driverData);
//         console.log("✅ Notification sent via standard room channel");

//         const userSockets = await io.in(userRoom).fetchSockets();
//         console.log(`🔍 Found ${userSockets.length} sockets in user room`);
//         userSockets.forEach((userSocket, index) => {
//           userSocket.emit("rideAccepted", driverData);
//           console.log(`✅ Notification sent to user socket ${index + 1}: ${userSocket.id}`);
//         });

//         io.emit("rideAcceptedGlobal", {
//           ...driverData,
//           targetUserId: userRoom,
//           timestamp: new Date().toISOString()
//         });
//         console.log("✅ Global notification sent with user filter");

//         setTimeout(() => {
//           io.to(userRoom).emit("rideAccepted", driverData);
//           console.log("✅ Backup notification sent after delay");
//         }, 1000);

//         const userDataForDriver = {
//           success: true,
//           rideId: ride.RAID_ID,
//           userId: ride.user,
//           customerId: ride.customerId,
//           userName: ride.name,
//           userMobile: rides[rideId]?.userMobile || ride.userMobile || "N/A",
//           pickup: ride.pickup,
//           drop: ride.drop,
//           otp: ride.otp,
//           status: ride.status,
//           timestamp: new Date().toISOString()
//         };

//         console.log("📤 Prepared user data for driver:", JSON.stringify(userDataForDriver, null, 2));

//         const driverSocket = Array.from(io.sockets.sockets.values()).find(s => s.driverId === driverId);
//         if (driverSocket) {
//           driverSocket.emit("userDataForDriver", userDataForDriver);
//           console.log("✅ User data sent to driver:", driverId);
//         } else {
//           io.to(`driver_${driverId}`).emit("userDataForDriver", userDataForDriver);
//           console.log("✅ User data sent to driver room:", driverId);
//         }

//         socket.broadcast.emit("rideAlreadyAccepted", { 
//           rideId,
//           message: "This ride has already been accepted by another driver."
//         });
//         console.log("📢 Other drivers notified");

//         if (activeDriverSockets.has(driverId)) {
//           const driverInfo = activeDriverSockets.get(driverId);
//           driverInfo.status = "onRide";
//           driverInfo.isOnline = true;
//           activeDriverSockets.set(driverId, driverInfo);
//           console.log(`🔄 Updated driver ${driverId} status to 'onRide'`);
//         }

//         console.log(`🎉 RIDE ${rideId} ACCEPTED SUCCESSFULLY BY ${driverName}`);

//       } catch (error) {
//         console.error(`❌ ERROR ACCEPTING RIDE ${rideId}:`, error);
//         console.error("Stack:", error.stack);
        
//         if (typeof callback === "function") {
//           callback({ 
//             success: false, 
//             message: "Server error: " + error.message 
//           });
//         }
//       }
//     });

//     // USER LOCATION UPDATE
//     socket.on("userLocationUpdate", async (data) => {
//       try {
//         const { userId, rideId, latitude, longitude } = data;
        
//         console.log(`📍 USER LOCATION UPDATE: User ${userId} for ride ${rideId}`);
//         console.log(`🗺️  User coordinates: ${latitude}, ${longitude}`);
        
//         userLocationTracking.set(userId, {
//           latitude,
//           longitude,
//           lastUpdate: Date.now(),
//           rideId: rideId
//         });
        
//         logUserLocationUpdate(userId, { latitude, longitude }, rideId);
        
//         await saveUserLocationToDB(userId, latitude, longitude, rideId);
        
//         if (rides[rideId]) {
//           rides[rideId].userLocation = { latitude, longitude };
//           console.log(`✅ Updated user location in memory for ride ${rideId}`);
//         }
        
//         let driverId = null;
        
//         if (rides[rideId] && rides[rideId].driverId) {
//           driverId = rides[rideId].driverId;
//           console.log(`✅ Found driver ID in memory: ${driverId} for ride ${rideId}`);
//         } else {
//           const ride = await Ride.findOne({ RAID_ID: rideId });
//           if (ride && ride.driverId) {
//             driverId = ride.driverId;
//             console.log(`✅ Found driver ID in database: ${driverId} for ride ${rideId}`);
            
//             if (!rides[rideId]) {
//               rides[rideId] = {};
//             }
//             rides[rideId].driverId = driverId;
//           } else {
//             console.log(`❌ No driver assigned for ride ${rideId} in database either`);
//             return;
//           }
//         }
        
//         const driverRoom = `driver_${driverId}`;
//         const locationData = {
//           rideId: rideId,
//           userId: userId,
//           lat: latitude,
//           lng: longitude,
//           timestamp: Date.now()
//         };
        
//         console.log(`📡 Sending user location to driver ${driverId} in room ${driverRoom}:`, locationData);
        
//         io.to(driverRoom).emit("userLiveLocationUpdate", locationData);
//         io.emit("userLiveLocationUpdate", locationData);
        
//         console.log(`📡 Sent user location to driver ${driverId} and all drivers`);
        
//       } catch (error) {
//         console.error("❌ Error processing user location update:", error);
//       }
//     });

//     // GET USER DATA FOR DRIVER
//     socket.on("getUserDataForDriver", async (data, callback) => {
//       try {
//         const { rideId } = data;
        
//         console.log(`👤 Driver requested user data for ride: ${rideId}`);
        
//         const ride = await Ride.findOne({ RAID_ID: rideId }).populate('user');
//         if (!ride) {
//           if (typeof callback === "function") {
//             callback({ success: false, message: "Ride not found" });
//           }
//           return;
//         }
        
//         let userCurrentLocation = null;
//         if (userLocationTracking.has(ride.user.toString())) {
//           const userLoc = userLocationTracking.get(ride.user.toString());
//           userCurrentLocation = {
//             latitude: userLoc.latitude,
//             longitude: userLoc.longitude
//           };
//         }
        
//         const userData = {
//           success: true,
//           rideId: ride.RAID_ID,
//           userId: ride.user?._id || ride.user,
//           userName: ride.name || "Customer",
//           userMobile: rides[rideId]?.userMobile || ride.userMobile || ride.user?.phoneNumber || "N/A",
//           userPhoto: ride.user?.profilePhoto || null,
//           pickup: ride.pickup,
//           drop: ride.drop,
//           userCurrentLocation: userCurrentLocation,
//           otp: ride.otp,
//           fare: ride.fare,
//           distance: ride.distance
//         };
        
//         console.log(`📤 Sending user data to driver for ride ${rideId}`);
//         if (userCurrentLocation) {
//           console.log(`📍 User's current location: ${userCurrentLocation.latitude}, ${userCurrentLocation.longitude}`);
//         } else {
//           console.log(`📍 User's current location: Not available`);
//         }
        
//         if (typeof callback === "function") {
//           callback(userData);
//         }
        
//       } catch (error) {
//         console.error("❌ Error getting user data for driver:", error);
//         if (typeof callback === "function") {
//           callback({ success: false, message: error.message });
//         }
//       }
//     });

//     // REJECT RIDE
//     socket.on("rejectRide", (data) => {
//       try {
//         const { rideId, driverId } = data;
        
//         console.log(`\n❌ RIDE REJECTED: ${rideId}`);
//         console.log(`🚗 Driver: ${driverId}`);
        
//         if (rides[rideId]) {
//           rides[rideId].status = "rejected";
//           rides[rideId].rejectedAt = Date.now();
          
//           if (activeDriverSockets.has(driverId)) {
//             const driverData = activeDriverSockets.get(driverId);
//             driverData.status = "Live";
//             driverData.isOnline = true;
//             activeDriverSockets.set(driverId, driverData);
            
//             socket.emit("driverStatusUpdate", {
//               driverId,
//               status: "Live"
//             });
//           }
          
//           logRideStatus();
//         }
//       } catch (error) {
//         console.error("❌ Error rejecting ride:", error);
//       }
//     });
    
//     // COMPLETE RIDE
//     socket.on("completeRide", (data) => {
//       try {
//         const { rideId, driverId, distance } = data;
        
//         console.log(`\n🎉 RIDE COMPLETED: ${rideId}`);
//         console.log(`🚗 Driver: ${driverId}`);
//         console.log(`📏 Distance: ${distance.toFixed(2)} km`);
        
//         if (rides[rideId]) {
//           rides[rideId].status = "completed";
//           rides[rideId].completedAt = Date.now();
//           rides[rideId].distance = distance;
          
//           const userId = rides[rideId].userId;
//           io.to(userId).emit("rideCompleted", {
//             rideId,
//             distance
//           });
          
//           if (activeDriverSockets.has(driverId)) {
//             const driverData = activeDriverSockets.get(driverId);
//             driverData.status = "Live";
//             driverData.isOnline = true;
//             activeDriverSockets.set(driverId, driverData);
            
//             socket.emit("driverStatusUpdate", {
//               driverId,
//               status: "Live"
//             });
//           }
          
//           setTimeout(() => {
//             delete rides[rideId];
//             console.log(`🗑️  Removed completed ride: ${rideId}`);
//           }, 5000);
          
//           logRideStatus();
//         }
//       } catch (error) {
//         console.error("❌ Error completing ride:", error);
//       }
//     });

//     // DRIVER HEARTBEAT
//     socket.on("driverHeartbeat", ({ driverId }) => {
//       if (activeDriverSockets.has(driverId)) {
//         const driverData = activeDriverSockets.get(driverId);
//         driverData.lastUpdate = Date.now();
//         driverData.isOnline = true;
//         activeDriverSockets.set(driverId, driverData);
        
//         console.log(`❤️  Heartbeat received from driver: ${driverId}`);
//       }
//     });
    
//     // DISCONNECT
//     socket.on("disconnect", (reason) => {
//       console.log(`\n❌ Client disconnected: ${socket.id}, Reason: ${reason}`);
//       console.log(`📱 Remaining connected clients: ${io.engine.clientsCount}`);
      
//       if (socket.driverId) {
//         console.log(`🛑 Driver ${socket.driverName} (${socket.driverId}) disconnected`);
        
//         if (activeDriverSockets.has(socket.driverId)) {
//           const driverData = activeDriverSockets.get(socket.driverId);
//           driverData.isOnline = false;
//           driverData.status = "Offline";
//           activeDriverSockets.set(socket.driverId, driverData);
          
//           saveDriverLocationToDB(
//             socket.driverId, 
//             socket.driverName,
//             driverData.location.latitude, 
//             driverData.location.longitude, 
//             driverData.vehicleType,
//             "Offline"
//           ).catch(console.error);
//         }
        
//         broadcastDriverLocationsToAllUsers();
//         logDriverStatus();
//       }
//     });
//   });
  
//   // Clean up offline drivers every 60 seconds
//   setInterval(() => {
//     const now = Date.now();
//     const fiveMinutesAgo = now - 300000;
//     let cleanedCount = 0;
    
//     Array.from(activeDriverSockets.entries()).forEach(([driverId, driver]) => {
//       if (!driver.isOnline && driver.lastUpdate < fiveMinutesAgo) {
//         activeDriverSockets.delete(driverId);
//         cleanedCount++;
//         console.log(`🧹 Removed offline driver: ${driverId}`);
//       }
//     });
    
//     // Clean up stale user location tracking (older than 30 minutes)
//     const thirtyMinutesAgo = now - 1800000;
//     Array.from(userLocationTracking.entries()).forEach(([userId, data]) => {
//       if (data.lastUpdate < thirtyMinutesAgo) {
//         userLocationTracking.delete(userId);
//         cleanedCount++;
//         console.log(`🧹 Removed stale user location tracking for user: ${userId}`);
//       }
//     });
    
//     if (cleanedCount > 0) {
//       console.log(`\n🧹 Cleaned up ${cleanedCount} stale entries`);
//       broadcastDriverLocationsToAllUsers();
//       logDriverStatus();
//     }
//   }, 60000);
// };

// // GET IO INSTANCE
// const getIO = () => {
//   if (!io) throw new Error("❌ Socket.io not initialized!");
//   return io;
// };

// module.exports = { init, getIO };
