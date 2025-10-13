const express = require("express");
const router = express.Router();
const ridePriceController = require("../../controllers/admin/ridePriceController");

// Get all ride prices
router.get("/ride-prices", ridePriceController.getRidePrices);

// Update ride prices
router.post("/ride-prices", ridePriceController.updateRidePrices);

// Initialize default prices (for development)
router.post("/ride-prices/initialize", async (req, res) => {
  try {
    await ridePriceController.initializeDefaultPrices();
    res.json({
      success: true,
      message: 'Default prices initialized successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to initialize default prices',
      error: error.message
    });
  }
});

module.exports = router;