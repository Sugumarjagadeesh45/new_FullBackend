const Grocery = require("../../models/shared/groceryItem");

// GET all groceries
const getAllGroceries = async (req, res) => {
  try {
    const groceries = await Grocery.find();
    res.json(groceries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching groceries", error });
  }
};

// GET grocery by ID
const getGroceryById = async (req, res) => {
  try {
    const grocery = await Grocery.findById(req.params.id);
    if (!grocery) return res.status(404).json({ message: "Grocery not found" });
    res.json(grocery);
  } catch (error) {
    res.status(500).json({ message: "Error fetching grocery", error });
  }
};

// CREATE grocery
const createGrocery = async (req, res) => {
  try {
    const newGrocery = new Grocery(req.body);
    await newGrocery.save();
    res.status(201).json(newGrocery);
  } catch (error) {
    res.status(500).json({ message: "Error creating grocery", error });
  }
};

// UPDATE grocery
const updateGrocery = async (req, res) => {
  try {
    const updatedGrocery = await Grocery.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedGrocery) return res.status(404).json({ message: "Grocery not found" });
    res.json(updatedGrocery);
  } catch (error) {
    res.status(500).json({ message: "Error updating grocery", error });
  }
};

// DELETE grocery
const deleteGrocery = async (req, res) => {
  try {
    const deletedGrocery = await Grocery.findByIdAndDelete(req.params.id);
    if (!deletedGrocery) return res.status(404).json({ message: "Grocery not found" });
    res.json({ message: "Grocery deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting grocery", error });
  }
};

module.exports = { getAllGroceries, getGroceryById, createGrocery, updateGrocery, deleteGrocery };
