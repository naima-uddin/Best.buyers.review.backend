const User = require('../models/User');
const bcrypt = require('bcryptjs');

const userController = {
  // Create new user (admin only)
  createUser: async (req, res) => {
    try {
      const { name, email, password, role = 'moderator' } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() }).select('_id').lean();
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = new User({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role
      });

      await user.save();

      // Remove password from response
      const userResponse = { ...user.toObject() };
      delete userResponse.password;

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: userResponse
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get all users (admin only)
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Update user (admin only)
  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password, role, isActive } = req.body;

      const updateData = { name, email, role, isActive };

      // If password is provided, hash it
      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      const user = await User.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Delete user (admin only)
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByIdAndDelete(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = userController;