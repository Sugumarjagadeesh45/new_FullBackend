const express = require("express");
const router = express.Router();
const rideController = require("../../controllers/shared/rideController");

// ✅ Route definitions
router.get("/", rideController.getRides);
router.post("/", rideController.createRide);
router.get("/:id", rideController.getRideById);
router.put("/:id", rideController.updateRide);
router.delete("/:id", rideController.deleteRide);
router.post("/:id/accept", rideController.acceptRide);
router.post("/:id/arrived", rideController.markArrived);
router.post("/:id/start", rideController.startRide);
router.post("/:id/complete", rideController.completeRide);

// ✅ Price calculation route - MAKE SURE THIS EXISTS
router.post("/calculate-price", rideController.calculateRidePrice);

module.exports = router;



// const express = require("express");




// const router = express.Router();
// const rideController = require("../../controllers/shared/rideController");

// // ✅ Route definitions
// router.get("/", rideController.getRides);
// router.post("/", rideController.createRide);
// router.get("/:id", rideController.getRideById);
// router.put("/:id", rideController.updateRide);
// router.delete("/:id", rideController.deleteRide);
// router.post("/:id/accept", rideController.acceptRide);
// router.post("/:id/arrived", rideController.markArrived);
// router.post("/:id/start", rideController.startRide);
// router.post("/:id/complete", rideController.completeRide);

// // ✅ Important!
// module.exports = router;
