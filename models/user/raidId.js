const mongoose = require('mongoose');

const raidIdSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    default: 'raidId'
  },
  sequence: {
    type: Number,
    default: 100000
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RaidId', raidIdSchema);