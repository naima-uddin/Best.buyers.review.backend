const mongoose = require('mongoose');

// Simple slugify helper
const slugifyString = (s) => {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Schema for Cloudinary media assets
const MediaAssetSchema = new mongoose.Schema({
  public_id: { type: String },
  url: { type: String, required: true },
  width: { type: Number },
  height: { type: Number },
  format: { type: String },
  resourceType: { type: String, enum: ['image', 'video'], default: 'image' }
}, { _id: false });

// Schema for dynamic sections (FAQ, Accordion, Steps)
const DynamicSectionSchema = new mongoose.Schema({
  type: { type: String, enum: ['faq', 'accordion', 'steps'], required: true },
  title: { type: String, default: '' },
  items: [
    {
      title: { type: String, required: true },
      content: { type: String, required: true },
      order: { type: Number, default: 0 }
    }
  ]
}, { _id: false });

const BlogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  excerpt: { type: String, maxlength: 500 },
  content: { type: String, default: '' },
  author: {
    name: { type: String, default: 'Admin' },
    avatar: { type: String },
    bio: { type: String }
  },
  featuredImage: MediaAssetSchema,
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BlogCategory' }],
  isFeatured: { type: Boolean, default: false },
  tags: [{ type: String, trim: true }],
  additionalImages: [MediaAssetSchema],
  videos: [MediaAssetSchema],
  dynamicSections: [DynamicSectionSchema],
  publishDate: { type: Date, default: Date.now },
  readingTime: { type: Number, default: 5 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  views: { type: Number, default: 0 }
}, {
  timestamps: true
});

// Generate slug before saving
BlogPostSchema.pre('save', async function(next) {
  // Generate slug from title if not provided or empty
  if (this.isModified('title') && (!this.slug || this.slug === '')) {
    let baseSlug = slugifyString(this.title);
    
    // Ensure baseSlug is not empty
    if (!baseSlug) {
      baseSlug = 'blog-post';
    }
    
    let slug = baseSlug;
    let counter = 0;
    
    // Ensure unique slug
    while (await mongoose.models.BlogPost.findOne({ slug, _id: { $ne: this._id } })) {
      counter++;
      slug = `${baseSlug}-${counter}`;
    }
    
    this.slug = slug;
  }
  
  // Auto-calculate reading time only when it was not set manually
  if (this.isModified('content') && this.content && !this.isModified('readingTime')) {
    const wordCount = this.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;
    this.readingTime = Math.ceil(wordCount / 200) || 1;
  }
  
  // Set publish date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishDate) {
    this.publishDate = new Date();
  }
  
  next();
});

// Indexes for performance
BlogPostSchema.index({ slug: 1 });
BlogPostSchema.index({ status: 1, publishDate: -1 });
BlogPostSchema.index({ isFeatured: 1 });
BlogPostSchema.index({ categories: 1 });
BlogPostSchema.index({ tags: 1 });

module.exports = mongoose.model('BlogPost', BlogPostSchema);
