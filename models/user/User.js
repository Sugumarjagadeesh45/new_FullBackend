const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Counter = require('./customerId'); // import Counter only once

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  password: { type: String, required: true },
  address: { type: String, default: '' },
  customerId: { type: String, unique: true },
  profilePicture: { type: String, default: '' },
  gender: { type: String, default: '' },
  dob: { type: Date, default: null },
  altMobile: { type: String, default: '' },
  rewardPoints: { type: Number, default: 0 },
}, { timestamps: true });

// Index for faster queries
userSchema.index({ customerId: 1 });

// Auto-generate customerId
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.customerId) {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'customerId' },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    this.customerId = (100000 + counter.sequence).toString();
  }
  next();
});

// Hash password
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);