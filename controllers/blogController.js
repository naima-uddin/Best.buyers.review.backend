import Blog from "../models/Blog.js";
import mongoose from "mongoose";

// ---------------------------------------------------------
// Helper: Generate slug
// ---------------------------------------------------------
const generateSlug = (title) => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

// ---------------------------------------------------------
// Helper: Normalize categories
// Accepts array of IDs OR full objects
// ---------------------------------------------------------
const normalizeCategories = (cats) => {
  if (!cats) return [];
  return cats.map((c) => {
    if (typeof c === "string") {
      return { name: c, slug: c.toLowerCase().replace(/\s+/g, "-") };
    }
    return c; // keep original object
  });
};

// ---------------------------------------------------------
// Helper: Calculate reading time from HTML content
// ---------------------------------------------------------
const calculateReadingTime = (htmlContent) => {
  if (!htmlContent) return 5;
  // Strip HTML tags and count words
  const text = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = text.split(' ').filter(word => word.length > 0).length;
  // Average reading speed: 200 words per minute
  return Math.max(1, Math.ceil(wordCount / 200));
};

// ---------------------------------------------------------
// CREATE BLOG
// ---------------------------------------------------------
export const createBlog = async (req, res) => {
  try {
    console.log("📥 Received blog creation request");

    let blogData = { ...req.body };

    // Parse JSON fields if they exist as strings
    const parseField = (field) => {
      if (blogData[field] && typeof blogData[field] === 'string') {
        try {
          blogData[field] = JSON.parse(blogData[field]);
        } catch (err) {
          console.log(`❌ Failed to parse field: ${field}`, err);
        }
      }
    };

    ["author", "seo", "tags", "categories", "anchorTags", "featuredImage", 
     "additionalImages", "videos", "dynamicSections"].forEach(parseField);

    // Handle featured image URL if provided as string
    if (blogData.featuredImageUrl && !blogData.featuredImage) {
      blogData.featuredImage = {
        url: blogData.featuredImageUrl,
        alt: blogData.title || ""
      };
    }

    // Auto-generate slug if not provided
    if (!blogData.slug && blogData.title) {
      blogData.slug = generateSlug(blogData.title);
    }

    // Normalize categories
    if (blogData.categories) {
      blogData.categories = normalizeCategories(blogData.categories);
    }

    // Calculate reading time from content
    if (blogData.content && !blogData.readingTime) {
      blogData.readingTime = calculateReadingTime(blogData.content);
    }

    // Set default author if not provided
    if (!blogData.author) {
      blogData.author = { name: "Best Buyers View" };
    }

    console.log("📝 Creating blog:", blogData.title);

    const newBlog = await Blog.create(blogData);
    console.log("✅ Blog created successfully:", newBlog._id);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: newBlog,
    });

  } catch (error) {
    console.log("❌ Create Blog Error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      details: "Check server logs for more information"
    });
  }
};


// ---------------------------------------------------------
// GET ALL BLOGS
// ---------------------------------------------------------
export const getAllBlogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, tag, featured, category } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;
    
    // Build filter
    const filter = { published: true };
    
    // Search query
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { excerpt: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }
    
    // Tag filter
    if (tag) filter.tags = tag;
    
    // Featured filter
    if (featured === 'true') filter.isFeatured = true;
    if (featured === 'false') filter.isFeatured = { $ne: true };
    
    // Category filter
    if (category) {
      filter['categories.name'] = new RegExp(category, 'i');
    }

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .select('title slug excerpt description featuredImage categories tags isFeatured author readingTime datePublished publishDate createdAt')
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit))
        .lean(),
      Blog.countDocuments(filter)
    ]);
    
    res.set({ 'Cache-Control': 'no-store' });
    res.status(200).json({ 
      success: true, 
      data: blogs,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// GET ALL BLOGS (ADMIN - includes unpublished)
// ---------------------------------------------------------
export const getAllBlogsAdmin = async (req, res) => {
  try {
    const blogs = await Blog.find({})
      .select('title slug excerpt description featuredImage categories tags isFeatured published author readingTime datePublished createdAt')
      .sort({ createdAt: -1 })
      .lean();
    
    res.set({ 'Cache-Control': 'no-store' });
    res.status(200).json({ success: true, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// GET BLOG BY SLUG
// ---------------------------------------------------------
export const getBlogBySlug = async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    console.log("📖 Fetching blog with slug:", slug);
    
    const blog = await Blog.findOne({ slug }).lean();

    if (!blog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// GET RELATED BLOGS
// ---------------------------------------------------------
export const getRelatedBlogs = async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    const { limit = 4 } = req.query;
    
    // Get the current blog
    const currentBlog = await Blog.findOne({ slug, published: true }).lean();
    if (!currentBlog) {
      return res.status(404).json({ success: false, message: "Blog not found" });
    }
    
    // Build query to find related posts
    const relatedQuery = {
      published: true,
      _id: { $ne: currentBlog._id }
    };
    
    // Find posts with matching categories or tags
    const orConditions = [];
    if (currentBlog.categories && currentBlog.categories.length > 0) {
      const categoryNames = currentBlog.categories.map(c => c.name);
      orConditions.push({ 'categories.name': { $in: categoryNames } });
    }
    if (currentBlog.tags && currentBlog.tags.length > 0) {
      orConditions.push({ tags: { $in: currentBlog.tags } });
    }
    
    if (orConditions.length > 0) {
      relatedQuery.$or = orConditions;
    }
    
    // Fetch related posts
    let relatedBlogs = await Blog.find(relatedQuery)
      .select('title slug excerpt featuredImage author readingTime categories tags datePublished createdAt')
      .sort({ datePublished: -1 })
      .limit(Number(limit))
      .lean();
    
    // If not enough related posts, fill with latest posts
    if (relatedBlogs.length < Number(limit)) {
      const additionalBlogs = await Blog.find({
        published: true,
        _id: { $nin: [currentBlog._id, ...relatedBlogs.map(b => b._id)] }
      })
        .select('title slug excerpt featuredImage author readingTime categories tags datePublished createdAt')
        .sort({ datePublished: -1 })
        .limit(Number(limit) - relatedBlogs.length)
        .lean();
      
      relatedBlogs = [...relatedBlogs, ...additionalBlogs];
    }
    
    res.status(200).json({ success: true, data: relatedBlogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// UPDATE BLOG (SAFE — FINDS BY SLUG BUT UPDATES BY ID)
// ---------------------------------------------------------
export const updateBlog = async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    console.log("📝 Updating blog with slug:", slug);
    
    let updateData = { ...req.body };

    // Parse JSON fields if they exist as strings
    const parseField = (field) => {
      if (updateData[field] && typeof updateData[field] === 'string') {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (err) {
          console.log(`❌ Failed to parse field: ${field}`, err);
        }
      }
    };

    ["author", "seo", "tags", "categories", "anchorTags", "featuredImage", 
     "additionalImages", "videos", "dynamicSections"].forEach(parseField);

    // Find blog by old slug
    const existingBlog = await Blog.findOne({ slug });
    if (!existingBlog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    // Regenerate slug ONLY if title changed
    if (updateData.title && updateData.title !== existingBlog.title) {
      updateData.slug = generateSlug(updateData.title);
    }

    // Normalize categories
    if (updateData.categories) {
      updateData.categories = normalizeCategories(updateData.categories);
    }

    // Calculate reading time from content
    if (updateData.content) {
      updateData.readingTime = calculateReadingTime(updateData.content);
    }

    // Manual timestamps
    updateData.dateModified = new Date();

    if (updateData.published === true && !existingBlog.datePublished) {
      updateData.datePublished = new Date();
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      existingBlog._id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// DELETE BLOG
// ---------------------------------------------------------
export const deleteBlog = async (req, res) => {
  try {
    const slug = decodeURIComponent(req.params.slug);
    console.log("🗑️ Deleting blog with slug:", slug);

    const deletedBlog = await Blog.findOneAndDelete({ slug });

    if (!deletedBlog)
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting blog:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// EXPORT FOR COMMONJS COMPATIBILITY
// ---------------------------------------------------------
export default {
  createBlog,
  getAllBlogs,
  getAllBlogsAdmin,
  getBlogBySlug,
  getRelatedBlogs,
  updateBlog,
  deleteBlog,
};
