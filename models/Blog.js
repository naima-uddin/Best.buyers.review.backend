import mongoose from "mongoose";

const stepSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  image: { type: String }, 
});

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String, // store image URL or path
      required: false,
    },
    shortDescription: {
      type: String,
      required: true,
      minlength: 20,
      maxlength: 300,
    },
    content: {
      type: String, // Full article body (HTML or markdown)
      required: true,
    },
    steps: [stepSchema], // dynamic array of steps (title, desc, img)
    images: [
      {
        type: String, // extra blog images
      },
    ],
    category: {
      type: String,
      required: true,
    },
    tags: [
      {
        type: String,
      },
    ],

    // SEO Fields
    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      keywords: [{ type: String }],
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;
