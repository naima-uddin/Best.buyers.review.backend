const mongoose = require('mongoose');

const BlogCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, default: '' },
  image: {
    public_id: String,
    url: String
  },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Generate slug from name before saving
BlogCategorySchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

BlogCategorySchema.index({ slug: 1 });
BlogCategorySchema.index({ isActive: 1 });

module.exports = mongoose.model('BlogCategory', BlogCategorySchema);
