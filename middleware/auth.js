const jwt = require('jsonwebtoken');
const User = require('../models/user/User');
const Driver = require('../models/driver/driver');
const AdminUser = require('../models/admin/adminUser');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    let user;
    if (decoded.role === 'admin') {
      user = await AdminUser.findById(decoded.id).select('-passwordHash');
    } else if (decoded.role === 'driver') {
      user = await Driver.findById(decoded.id).select('-passwordHash');
    } else {
      user = await User.findById(decoded.id).select('-password');
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;