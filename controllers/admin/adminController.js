const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const AdminUser = require("../../models/admin/adminUser");
const User = require("../../models/user/User");
const Driver = require("../../models/driver/driver");
const Ride = require("../../models/shared/ride");
const GroceryItem = require("../../models/shared/groceryItem");

let blacklistedTokens = [];

/* ---------------- ADMIN AUTH ---------------- */

// Register admin
exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const exists = await AdminUser.findOne({ email });
    if (exists) return res.status(400).json({ error: "Admin already exists" });

    const admin = new AdminUser({ username, email, role });
    await admin.setPassword(password);
    await admin.save();

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login admin
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await AdminUser.findOne({ email });
    if (!admin) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await admin.validatePassword(password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({ token, role: admin.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logout admin
exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(400).json({ error: "No token provided" });
    blacklistedTokens.push(token);
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check token blacklist
exports.isTokenBlacklisted = (token) => blacklistedTokens.includes(token);

/* ---------------- DASHBOARD ---------------- */
exports.getDashboardData = async (req, res) => {
  try {
    const activeRiders = await Ride.countDocuments({ status: "ongoing" });
    const activeDrivers = await Driver.countDocuments({ status: "Live" });
    const pendingRides = await Ride.countDocuments({ status: "pending" });
    const pointsRedeemed = await User.aggregate([
      { $unwind: "$wallet" },
      { $group: { _id: null, totalPoints: { $sum: "$wallet.points" } } },
    ]);

    res.json({
      activeRiders,
      activeDrivers,
      pendingRides,
      pointsRedeemed: `₹${pointsRedeemed[0]?.totalPoints || 0}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- USERS ---------------- */
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.adjustUserPoints = async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.wallet.points += amount;
    if (user.wallet.points < 0) user.wallet.points = 0;
    await user.save();

    res.json({ message: "Points updated", wallet: user.wallet });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- DRIVERS ---------------- */
exports.getDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().sort({ createdAt: -1 });
    const formatted = drivers.map((driver) => {
      const docsObj = {};
      (driver.documents || []).forEach((doc) => {
        docsObj[doc.type] = doc.url;
      });
      return { ...driver.toObject(), documents: docsObj };
    });
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleDriverStatus = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);
    if (!driver) return res.status(404).json({ message: "Driver not found" });

    driver.online = !driver.online;
    await driver.save();
    res.json({ message: "Driver status updated", driver });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addDriver = async (req, res) => {
  try {
    const {
      name,
      phone,
      vehicleType,
      vehicleModel,
      numberPlate,
      emergencyName,
      emergencyPhone,
    } = req.body;

    if (!name || !phone || !vehicleType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const driverId = `DR${Date.now()}`;
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const docs = [];
    if (req.files) {
      ["aadhaar", "license", "insurance", "certificate"].forEach((key) => {
        if (req.files[key]) {
          docs.push({ type: key, url: `/uploads/${req.files[key][0].filename}` });
        }
      });
    }

    const driver = new Driver({
      driverId,
      name,
      phone,
      passwordHash,
      mustChangePassword: true,
      vehicle: { type: vehicleType, model: vehicleModel, numberPlate },
      emergencyContact: { name: emergencyName, phone: emergencyPhone },
      documents: docs,
      status: "Offline",
      location: { type: "Point", coordinates: [0, 0] },
    });

    await driver.save();
    res.status(201).json({
      driverId: driver.driverId,
      tempPassword,
      message: "Driver added successfully",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- RIDES ---------------- */
exports.getRides = async (req, res) => {
  try {
    const rides = await Ride.find()
      .populate("user", "name phone")
      .populate("driver", "name phone vehicleType")
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignRide = async (req, res) => {
  try {
    const { driverId } = req.body;
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    ride.driver = driverId;
    ride.status = "accepted";
    await ride.save();

    res.json({ message: "Driver assigned to ride", ride });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------------- GROCERY ---------------- */
exports.adjustGroceryStock = async (req, res) => {
  try {
    const { itemId, change } = req.body;
    const item = await GroceryItem.findById(itemId);
    if (!item) return res.status(404).json({ message: "Grocery item not found" });

    item.stock += change;
    if (item.stock < 0) item.stock = 0;
    await item.save();

    res.json({ message: "Stock updated", grocery: item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};