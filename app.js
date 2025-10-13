const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
require("dotenv").config();

const app = express();

// ----------------------------
// Ensure uploads folder exists
// ----------------------------
const uploadsPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log("✅ Created uploads folder at:", uploadsPath);
}

// ----------------------------
// Middleware Setup
// ----------------------------
app.use(
  cors({
    origin: ["http://localhost:3000", "http://192.168.1.118:3000", "*"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsPath));

// ----------------------------
// Multer (File Upload) Setup
// ----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsPath),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
app.set("upload", upload);

// ----------------------------
// Routes
// ----------------------------
const adminRoutes = require("./routes/admin/adminRoutes");
const userRoutes = require("./routes/user/userRoutes");
const driverRoutes = require("./routes/driver/driverRoutes");
const rideRoutes = require("./routes/shared/rideRoutes");
const groceryRoutes = require("./routes/shared/groceryRoutes");
const routeRoutes = require("./routes/shared/routeRoutes");

const ridePriceRoutes = require("./routes/admin/ridePriceRoutes");
app.use("/api/admin", ridePriceRoutes);

// Optional routes
const dashboardRoutes = safeRequire("./routes/dashboardRoutes");
const shopRoutes = safeRequire("./routes/shopRoutes");
const rewardRoutes = safeRequire("./routes/rewardRoutes");
const paymentRoutes = safeRequire("./routes/paymentRoutes");
const ratingRoutes = safeRequire("./routes/ratingRoutes");
const orderRoutes = safeRequire("./routes/orderRoutes");
const walletRoutes = safeRequire("./routes/walletRoutes");
const driverLocationHistoryRoutes = safeRequire("./routes/driverLocationHistoryRoutes");
const authRoutes = safeRequire("./routes/authRoutes");

// Mount main routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/groceries", groceryRoutes);
app.use("/api/routes", routeRoutes);

// Mount optional routes if exist
if (dashboardRoutes) app.use("/api/dashboard", dashboardRoutes);
if (shopRoutes) app.use("/api/shop", shopRoutes);
if (rewardRoutes) app.use("/api/rewards", rewardRoutes);
if (paymentRoutes) app.use("/api/payments", paymentRoutes);
if (ratingRoutes) app.use("/api/ratings", ratingRoutes);
if (orderRoutes) app.use("/api/orders", orderRoutes);
if (walletRoutes) app.use("/api/wallet", walletRoutes);
if (driverLocationHistoryRoutes)
  app.use("/api/driver-location-history", driverLocationHistoryRoutes);
if (authRoutes) app.use("/api/auth", authRoutes);

// ----------------------------
// Test Route
// ----------------------------
app.get("/", (req, res) => {
  res.send("🚖 EazyGo backend is running successfully!");
});

// ----------------------------
// Error Handling Middleware
// ----------------------------
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).send("Something broke!");
});

// ----------------------------
// Utility: Safe Require
// ----------------------------
function safeRequire(path) {
  try {
    return require(path);
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") return null;
    throw err;
  }
}

module.exports = app;

// // ----------------------------
// // app.js — Clean, Working Version
// // ----------------------------

// const express = require("express");
// const cors = require("cors");
// const path = require("path");
// const fs = require("fs");
// const multer = require("multer");
// require("dotenv").config();

// const app = express();

// // ----------------------------
// // Ensure uploads folder exists
// // ----------------------------
// const uploadsPath = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadsPath)) {
//   fs.mkdirSync(uploadsPath, { recursive: true });
//   console.log("✅ Created uploads folder at:", uploadsPath);
// }

// // ----------------------------
// // Middleware Setup
// // ----------------------------
// app.use(
//   cors({
//     origin: ["http://localhost:3000", "http://192.168.1.118:3000", "*"],
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use("/uploads", express.static(uploadsPath));

// // ----------------------------
// // Multer (File Upload) Setup
// // ----------------------------
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadsPath),
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
//   },
// });
// const upload = multer({ storage });
// app.set("upload", upload);

// // ----------------------------
// // Routes
// // ----------------------------
// const adminRoutes = require("./routes/admin/adminRoutes");
// const userRoutes = require("./routes/user/userRoutes");
// const driverRoutes = require("./routes/driver/driverRoutes");
// const rideRoutes = require("./routes/shared/rideRoutes");
// const groceryRoutes = require("./routes/shared/groceryRoutes");
// const routeRoutes = require("./routes/shared/routeRoutes");


// const ridePriceRoutes = require("./routes/admin/ridePriceRoutes");
// app.use("/api/admin", ridePriceRoutes);



// const { initializePrices } = require("./controllers/admin/ridePriceController");
// initializePrices().then(() => {
//   console.log("🚗 Ride price system initialized");
// });


// // Optional routes
// const dashboardRoutes = safeRequire("./routes/dashboardRoutes");
// const shopRoutes = safeRequire("./routes/shopRoutes");
// const rewardRoutes = safeRequire("./routes/rewardRoutes");
// const paymentRoutes = safeRequire("./routes/paymentRoutes");
// const ratingRoutes = safeRequire("./routes/ratingRoutes");
// const orderRoutes = safeRequire("./routes/orderRoutes");
// const walletRoutes = safeRequire("./routes/walletRoutes");
// const driverLocationHistoryRoutes = safeRequire("./routes/driverLocationHistoryRoutes");
// const authRoutes = safeRequire("./routes/authRoutes");

// // Mount main routes
// app.use("/api/admin", adminRoutes);
// app.use("/api/user", userRoutes);
// app.use("/api/driver", driverRoutes);
// app.use("/api/rides", rideRoutes);
// app.use("/api/groceries", groceryRoutes);
// app.use("/api/routes", routeRoutes);

// // Mount optional routes if exist
// if (dashboardRoutes) app.use("/api/dashboard", dashboardRoutes);
// if (shopRoutes) app.use("/api/shop", shopRoutes);
// if (rewardRoutes) app.use("/api/rewards", rewardRoutes);
// if (paymentRoutes) app.use("/api/payments", paymentRoutes);
// if (ratingRoutes) app.use("/api/ratings", ratingRoutes);
// if (orderRoutes) app.use("/api/orders", orderRoutes);
// if (walletRoutes) app.use("/api/wallet", walletRoutes);
// if (driverLocationHistoryRoutes)
//   app.use("/api/driver-location-history", driverLocationHistoryRoutes);
// if (authRoutes) app.use("/api/auth", authRoutes);

// // ----------------------------
// // Test Route
// // ----------------------------
// app.get("/", (req, res) => {
//   res.send("🚖 EazyGo backend is running successfully!");
// });

// // ----------------------------
// // Error Handling Middleware
// // ----------------------------
// app.use((err, req, res, next) => {
//   console.error("❌ Error:", err.stack);
//   res.status(500).send("Something broke!");
// });

// // ----------------------------
// // Utility: Safe Require
// // ----------------------------
// function safeRequire(path) {
//   try {
//     return require(path);
//   } catch (err) {
//     if (err.code === "MODULE_NOT_FOUND") return null;
//     throw err;
//   }
// }

// module.exports = app;

