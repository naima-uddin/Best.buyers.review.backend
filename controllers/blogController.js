
import Blog from "../models/Blog.js";
export const createBlog = async (req, res) => {
  try {
    const blogData = req.body;

    // Auto-generate slug if not supplied
    if (!blogData.slug && blogData.title) {
      blogData.slug = blogData.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    const newBlog = await Blog.create(blogData);

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: newBlog,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================= GET ALL BLOGS =======================
export const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================= GET SINGLE BLOG =======================
export const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });

    if (!blog)
      return res.status(404).json({ success: false, message: "Blog not found" });

    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================= UPDATE BLOG =======================
export const updateBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    const updateData = req.body;

    // Regenerate slug if title changed
    if (updateData.title) {
      updateData.slug = updateData.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    const updatedBlog = await Blog.findOneAndUpdate(
      { slug },
      updateData,
      { new: true }
    );

    if (!updatedBlog)
      return res.status(404).json({ success: false, message: "Blog not found" });

    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ======================= DELETE BLOG =======================
export const deleteBlog = async (req, res) => {
  try {
    const { slug } = req.params;

    const deletedBlog = await Blog.findOneAndDelete({ slug });

    if (!deletedBlog)
      return res.status(404).json({ success: false, message: "Blog not found" });

    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createBlog,
  getAllBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
};