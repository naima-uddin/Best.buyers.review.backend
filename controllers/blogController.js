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
// CREATE BLOG
// ---------------------------------------------------------
export const createBlog = async (req, res) => {
  try {
    let blogData = { ...req.body };

    // Parse JSON fields if they exist as strings
    const parseField = (field) => {
      if (blogData[field] && typeof blogData[field] === 'string') {
        try {
          blogData[field] = JSON.parse(blogData[field]);
        } catch (err) {
          console.log(`Failed to parse field: ${field}`, err);
        }
      }
    };

    ["author", "seo", "tags", "categories", "content"].forEach(parseField);

    // Handle featured image URL if provided
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

    const newBlog = await Blog.create(blogData);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: newBlog,
    });

  } catch (error) {
    console.log("Create Blog Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ---------------------------------------------------------
// GET ALL BLOGS
// ---------------------------------------------------------
export const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
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
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });

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
// UPDATE BLOG (SAFE — FINDS BY SLUG BUT UPDATES BY ID)
// ---------------------------------------------------------
export const updateBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    const updateData = req.body;

    // Find blog by old slug
    const existingBlog = await Blog.findOne({ slug });
    if (!existingBlog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    // Regenerate slug ONLY if title changed
    if (updateData.title) {
      updateData.slug = generateSlug(updateData.title);
    }

    // Normalize categories
    if (updateData.categories) {
      updateData.categories = normalizeCategories(updateData.categories);
    }

    // Manual timestamps (findOneAndUpdate does NOT run pre('save'))
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
    const { slug } = req.params;

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// EXPORT FOR COMMONJS COMPATIBILITY
// ---------------------------------------------------------
export default {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
};
