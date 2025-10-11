const User = require("../../models/user/User");
const Driver = require("../../models/driver/driver");
const Ride = require("../../models/shared/ride");

exports.getDashboardStats = async (req, res) => {
  try {
    // Stats
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ active: true });

    const totalDrivers = await Driver.countDocuments();
    const liveDrivers = await Driver.countDocuments({ status: "Live" });

    const totalRides = await Ride.countDocuments();
    const liveRides = await Ride.countDocuments({ status: "Ongoing" });
    const completedRides = await Ride.countDocuments({ status: "Completed" });
    const cancelledRides = await Ride.countDocuments({ status: "Cancelled" });

    // Monthly rides
    const monthlyRides = await Ride.aggregate([
      {
        $match: { createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) } }
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          totalRides: { $sum: 1 }
        }
      },
      { $sort: { "_id.month": 1 } }
    ]);

    const monthlyDataArray = Array(12).fill(0);
    monthlyRides.forEach((item) => {
      monthlyDataArray[item._id.month - 1] = item.totalRides;
    });

    const monthlyData = monthlyDataArray.map((value, index) => ({
      month: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][index],
      value
    }));

    // latest users
    const latestUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("_id email active lastRideId location");

    // latest drivers
    const latestDrivers = await Driver.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("_id name phone status vehicle location");

    res.json({
      users: { total: totalUsers, active: activeUsers },
      drivers: { total: totalDrivers, live: liveDrivers },
      rides: { total: totalRides, live: liveRides, completed: completedRides, cancelled: cancelledRides },
      monthlyData,
      latestUsers,
      latestDrivers,
    });
  } catch (err) {
    console.error("🔥 Dashboard error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};