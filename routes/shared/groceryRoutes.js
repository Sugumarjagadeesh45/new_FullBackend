const express = require("express");
const router = express.Router();

// சரியான import
const groceryController = require("../../controllers/shared/groceryController");

// GET all groceries
router.get("/", groceryController.getAllGroceries);

// GET grocery by ID
router.get("/:id", groceryController.getGroceryById);

// POST create grocery
router.post("/", groceryController.createGrocery);

// PUT update grocery
router.put("/:id", groceryController.updateGrocery);

// DELETE grocery
router.delete("/:id", groceryController.deleteGrocery);

module.exports = router;



// // routes/shared/groceryRoutes.js
// const express = require("express");
// const router = express.Router();
// const GroceryController = require("../../controllers/shared/groceryController");


// // CRUD routes
// router.get("/", GroceryController.getAllGroceries);
// router.get("/:id", GroceryController.getGroceryById);
// router.post("/", GroceryController.createGrocery);
// router.put("/:id", GroceryController.updateGrocery);
// router.delete("/:id", GroceryController.deleteGrocery);

// module.exports = router;
