const express = require("express");
const router = express.Router();
const adminController = require("../../controllers/admin/adminController");
const verifyAdmin = require("../../middleware/verifyAdmin");
const upload = require("../../middleware/upload");

/* -------- AUTH -------- */
router.post("/register", adminController.register);
router.post("/login", adminController.login);
router.post("/logout", verifyAdmin, adminController.logout);

/* -------- DASHBOARD -------- */
router.get("/dashboard-data", verifyAdmin, adminController.getDashboardData);

/* -------- USERS -------- */
router.get("/users", verifyAdmin, adminController.getUsers);
router.post("/user/:id/adjust-points", verifyAdmin, adminController.adjustUserPoints);

/* -------- DRIVERS -------- */
router.get("/drivers", verifyAdmin, adminController.getDrivers);
router.put("/driver/:id/toggle", verifyAdmin, adminController.toggleDriverStatus);

// Add driver with document uploads
router.post(
  "/drivers/add",
  verifyAdmin,
  upload.fields([
    { name: "aadhaar", maxCount: 1 },
    { name: "license", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
  ]),
  adminController.addDriver
);

/* -------- RIDES -------- */
router.get("/rides", verifyAdmin, adminController.getRides);
router.post("/ride/:rideId/assign", verifyAdmin, adminController.assignRide);

/* -------- GROCERY -------- */
router.post("/grocery/adjust-stock", verifyAdmin, adminController.adjustGroceryStock);

module.exports = router;