const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const BlogCategory = require('../models/BlogCategory');
const { cloudinary } = require('../config/cloudinary');
const { authenticateAdmin } = require('../middleware/auth');

const router = express.Router();

// Simple slugify helper
const slugifyString = (s) => {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-') || 'blog-post';
};

// Generate unique slug
const generateUniqueSlug = async (title, excludeId = null) => {
  let baseSlug = slugifyString(title);
  let slug = baseSlug;
  let counter = 0;
  
  const query = { slug };
  if (excludeId) query._id = { $ne: excludeId };
  
  while (await BlogPost.findOne(query)) {
    counter++;
    slug = `${baseSlug}-${counter}`;
    query.slug = slug;
  }
  
  return slug;
};

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// ==================== PUBLIC ROUTES ====================

// GET /api/blog - List published blogs
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    console.log('🌐 Received query params:', req.query);
    console.log('📊 category param:', req.query.category, 'type:', typeof req.query.category);
    
    const filter = { status: 'published' };
    
    // Search query
    if (req.query.q) {
      filter.$or = [
        { title: new RegExp(req.query.q, 'i') },
        { excerpt: new RegExp(req.query.q, 'i') },
        { content: new RegExp(req.query.q, 'i') }
      ];
    }
    
    // Tag filter
    if (req.query.tag) {
      filter.tags = req.query.tag;
    }
    
    // Category filter
    if (req.query.category) {
      try {
        console.log(`🔎 Looking for category: "${req.query.category}"`);
        // Try to find by slug first
        let category = await BlogCategory.findOne({ slug: req.query.category });
        console.log(`🔍 Slug search result:`, category ? `Found ${category.name}` : 'Not found by slug');
        
        // If not found by slug, try by name (case-insensitive)
        if (!category) {
          category = await BlogCategory.findOne({ 
            name: new RegExp(`^${req.query.category}$`, 'i') 
          });
          console.log(`🔍 Name search result:`, category ? `Found ${category.name}` : 'Not found by name');
        }
        
        if (category) {
          console.log(`✅ Found category: ${category.name} (${category._id})`);
          // Convert to proper MongoDB ObjectId for array matching
          const categoryObjectId = new mongoose.Types.ObjectId(category._id);
          filter.categories = { $in: [categoryObjectId] };
          console.log(`🔗 Filter with ObjectId:`, filter.categories);
        } else {
          console.log(`❌ Category not found: ${req.query.category}`);
          // If category doesn't exist, set empty array so no blogs match
          filter.categories = { $in: [] };
        }
      } catch (categoryError) {
        console.error(`❌ Error in category filter:`, categoryError.message);
      }
    }
    
    // Featured filter
    if (req.query.featured === 'true') {
      filter.isFeatured = true;
    } else if (req.query.featured === 'false') {
      filter.isFeatured = { $ne: true };
    }

    console.log('🔍 Blog filter:', JSON.stringify(filter, null, 2));

    const [blogs, total] = await Promise.all([
      BlogPost.find(filter)
        .populate('categories', 'name slug')
        .sort({ publishDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter)
    ]);
    
    console.log(`📦 Query result: Found ${blogs.length} blogs out of ${total} total`);
    if (blogs.length > 0 && req.query.category) {
      console.log(`📋 First blog categories:`, blogs[0].categories);
    }
    
    res.json({ 
      success: true,
      blogs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('GET /api/blog error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/blog/categories - List all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await BlogCategory.find({ isActive: true })
      .sort({ name: 1 })
      .lean();
    console.log(`📂 Fetched ${categories.length} categories:`, categories.map(c => `${c.name} (${c.slug})`).join(', '));
    res.json({ success: true, categories });
  } catch (err) {
    console.error('GET /api/blog/categories error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/blog/:slug - Get single blog by slug
router.get('/:slug', async (req, res) => {
  try {
    const blog = await BlogPost.findOne({ 
      slug: req.params.slug, 
      status: 'published' 
    })
    .populate('categories', 'name slug')
    .lean();
    
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    
    // Increment view count
    await BlogPost.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
    
    res.json({ success: true, blog, post: blog });
  } catch (err) {
    console.error('GET /api/blog/:slug error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/blog/:slug/related - Get related blogs
router.get('/:slug/related', async (req, res) => {
  try {
    const { limit = 3 } = req.query;
    
    const currentPost = await BlogPost.findOne({ 
      slug: req.params.slug, 
      status: 'published' 
    }).lean();
    
    if (!currentPost) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }
    
    // Find related posts by categories or tags
    const relatedQuery = {
      status: 'published',
      _id: { $ne: currentPost._id }
    };
    
    const orConditions = [];
    if (currentPost.categories && currentPost.categories.length > 0) {
      orConditions.push({ categories: { $in: currentPost.categories } });
    }
    if (currentPost.tags && currentPost.tags.length > 0) {
      orConditions.push({ tags: { $in: currentPost.tags } });
    }
    
    if (orConditions.length > 0) {
      relatedQuery.$or = orConditions;
    }
    
    let relatedPosts = await BlogPost.find(relatedQuery)
      .populate('categories', 'name slug')
      .sort({ publishDate: -1 })
      .limit(Number(limit))
      .select('title slug excerpt featuredImage author publishDate readingTime tags isFeatured')
      .lean();
    
    // If not enough related posts, fill with latest
    if (relatedPosts.length < Number(limit)) {
      const additionalPosts = await BlogPost.find({
        status: 'published',
        _id: { 
          $nin: [currentPost._id, ...relatedPosts.map(p => p._id)] 
        }
      })
      .populate('categories', 'name slug')
      .sort({ publishDate: -1 })
      .limit(Number(limit) - relatedPosts.length)
      .select('title slug excerpt featuredImage author publishDate readingTime tags isFeatured')
      .lean();
      
      relatedPosts = [...relatedPosts, ...additionalPosts];
    }
    
    res.json({ success: true, blogs: relatedPosts, relatedPosts });
  } catch (err) {
    console.error('GET /api/blog/:slug/related error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ==================== ADMIN ROUTES ====================

// Protect all admin routes (apply middleware to /admin and all sub-routes)
router.use('/admin', authenticateAdmin);

// GET /api/blog/admin/blogs - List all blogs (admin)
router.get('/admin/blogs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.search) {
      query.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { tags: new RegExp(req.query.search, 'i') }
      ];
    }
    
    const [blogs, total] = await Promise.all([
      BlogPost.find(query)
        .populate('categories', 'name slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      blogs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Admin GET blogs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/blog/admin/blogs/:id - Get single blog (admin)
router.get('/admin/blogs/:id', async (req, res) => {
  try {
    const blog = await BlogPost.findById(req.params.id)
      .populate('categories')
      .lean();
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    res.json({ success: true, blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/blog/admin/blogs - Create blog
router.post('/admin/blogs', async (req, res) => {
  try {
    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    
    const title = req.body.title.trim();
    const slug = await generateUniqueSlug(title);
    
    // Filter out empty dynamicSections items
    const dynamicSections = (req.body.dynamicSections || [])
      .map(section => ({
        ...section,
        items: (section.items || []).filter(item => item.title && item.title.trim() && item.content && item.content.trim())
      }))
      .filter(section => section.items && section.items.length > 0);
    
    const blogData = {
      title,
      slug,
      excerpt: req.body.excerpt,
      content: req.body.content,
      author: req.body.author || { name: 'Admin' },
      featuredImage: req.body.featuredImage && req.body.featuredImage.url ? req.body.featuredImage : null,
      categories: req.body.categories || [],
      isFeatured: req.body.isFeatured || false,
      tags: req.body.tags || [],
      additionalImages: req.body.additionalImages || [],
      videos: req.body.videos || [],
      dynamicSections,
      status: req.body.status || 'draft',
      publishDate: req.body.publishDate || null,
      readingTime: req.body.readingTime || 5
    };
    
    const blog = new BlogPost(blogData);
    await blog.save();
    
    res.status(201).json({ success: true, blog });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/blog/admin/blogs/:id - Update blog
router.put('/admin/blogs/:id', async (req, res) => {
  try {
    const blog = await BlogPost.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Update fields
    if (req.body.title !== undefined) blog.title = req.body.title;
    if (req.body.excerpt !== undefined) blog.excerpt = req.body.excerpt;
    if (req.body.content !== undefined) blog.content = req.body.content;
    if (req.body.author !== undefined) blog.author = req.body.author;
    if (req.body.featuredImage !== undefined) {
      blog.featuredImage = req.body.featuredImage && req.body.featuredImage.url ? req.body.featuredImage : null;
    }
    if (req.body.categories !== undefined) blog.categories = req.body.categories;
    if (req.body.isFeatured !== undefined) blog.isFeatured = req.body.isFeatured;
    if (req.body.tags !== undefined) blog.tags = req.body.tags;
    if (req.body.additionalImages !== undefined) blog.additionalImages = req.body.additionalImages;
    if (req.body.videos !== undefined) blog.videos = req.body.videos;
    if (req.body.dynamicSections !== undefined) {
      // Filter out empty dynamicSections items
      blog.dynamicSections = (req.body.dynamicSections || [])
        .map(section => ({
          ...section,
          items: (section.items || []).filter(item => item.title && item.title.trim() && item.content && item.content.trim())
        }))
        .filter(section => section.items && section.items.length > 0);
    }
    if (req.body.status !== undefined) blog.status = req.body.status;
    
    await blog.save();
    
    res.json({ success: true, blog });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/blog/admin/blogs/:id - Delete blog
router.delete('/admin/blogs/:id', async (req, res) => {
  try {
    const blog = await BlogPost.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }
    
    // Delete media from Cloudinary
    if (blog.featuredImage?.public_id) {
      try {
        await cloudinary.uploader.destroy(blog.featuredImage.public_id);
      } catch (err) {
        console.error('Error deleting featured image:', err);
      }
    }
    
    // Delete additional images
    for (const img of blog.additionalImages || []) {
      if (img.public_id) {
        try {
          await cloudinary.uploader.destroy(img.public_id);
        } catch (err) {
          console.error('Error deleting image:', err);
        }
      }
    }
    
    // Delete videos
    for (const vid of blog.videos || []) {
      if (vid.public_id) {
        try {
          await cloudinary.uploader.destroy(vid.public_id, { resource_type: 'video' });
        } catch (err) {
          console.error('Error deleting video:', err);
        }
      }
    }
    
    await BlogPost.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/blog/admin/upload - Upload media
router.post('/admin/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }
    
    const isVideo = req.file.mimetype.startsWith('video/');
    const folder = isVideo ? 'bestbuyersview/blog/videos' : 'bestbuyersview/blog/images';
    const resourceType = isVideo ? 'video' : 'image';
    
    // Convert buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      resource_type: resourceType,
      transformation: isVideo ? [] : [{ quality: 'auto', fetch_format: 'auto' }]
    });
    
    res.json({
      success: true,
      asset: {
        public_id: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        resourceType
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/blog/admin/upload/:publicId - Delete media
router.delete('/admin/upload/:publicId', async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    const resourceType = req.query.type === 'video' ? 'video' : 'image';
    
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    
    res.json({ success: true, message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== TAGS ADMIN ROUTE ====================

// GET /api/blog/admin/tags - List all unique tags
router.get('/admin/tags', async (req, res) => {
  try {
    const tags = await BlogPost.distinct('tags');
    res.json({ success: true, tags: tags.filter(Boolean).sort() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== CATEGORY ADMIN ROUTES ====================

// GET /api/blog/admin/categories - List all categories
router.get('/admin/categories', async (req, res) => {
  try {
    const categories = await BlogCategory.find()
      .sort({ name: 1 })
      .lean();
    
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/blog/admin/categories - Create category
router.post('/admin/categories', async (req, res) => {
  try {
    const category = new BlogCategory({
      name: req.body.name,
      description: req.body.description,
      image: req.body.image
    });
    
    await category.save();
    
    res.status(201).json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/blog/admin/categories/:id - Update category
router.put('/admin/categories/:id', async (req, res) => {
  try {
    const category = await BlogCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.image !== undefined) category.image = req.body.image;
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;
    
    await category.save();
    
    res.json({ success: true, category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/blog/admin/categories/:id - Delete category
router.delete('/admin/categories/:id', async (req, res) => {
  try {
    const category = await BlogCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    
    // Remove category from all blogs
    await BlogPost.updateMany(
      { categories: category._id },
      { $pull: { categories: category._id } }
    );
    
    await BlogCategory.findByIdAndDelete(req.params.id);
    
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
