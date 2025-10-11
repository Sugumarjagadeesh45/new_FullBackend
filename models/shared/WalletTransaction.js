const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  customerId: { type: String, required: true },
  txId: { type: String, required: true },
  type: { type: String, enum: ["Credit", "Debit"], required: true },
  amount: { type: Number, required: true },
  description: { type: String, default: '' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

// Index customerId for faster queries
walletTransactionSchema.index({ customerId: 1 });

// Virtual to compute total points for a user
walletTransactionSchema.statics.getUserBalance = async function(customerId) {
  const result = await this.aggregate([
    { $match: { customerId } },
    {
      $group: {
        _id: "$customerId",
        balance: {
          $sum: {
            $cond: [{ $eq: ["$type", "Credit"] }, "$amount", { $multiply: ["$amount", -1] }]
          }
        }
      }
    }
  ]);
  return result[0]?.balance || 0;
};

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);