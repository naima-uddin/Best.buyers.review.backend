import mongoose from "mongoose";

// Content Block Schema (editor-style blocks: paragraph, quote, image, list, etc.)
const contentBlockSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g. paragraph, quote, list, image
  data: {
    text: [
      {
        type: { type: String, default: "text" },
        value: { type: String },
      },
    ],
    items: [{ type: String }], // used for bullet/number list
  },
});

// Featured Image Schema
const imageSchema = new mongoose.Schema({
  url: { type: String },
  public_id: { type: String },
});

// Author Schema
const authorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String },
  bio: { type: String },
});

// SEO Schema
const seoSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  keywords: [{ type: String }],
  canonicalUrl: { type: String },
});

// Sponsor Schema
const sponsorSchema = new mongoose.Schema({
  name: { type: String },
  link: { type: String },
  logo: { type: String },
});

// Main Blog Schema
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    // description = long form, excerpt = short summary
    description: { type: String },
    excerpt: { type: String },

    author: authorSchema,

    categories: [{ type: String }],
    tags: [{ type: String }],

    content: [contentBlockSchema], // dynamic block based content

    featuredImage: imageSchema,
    contentImages: [imageSchema], // uploads stored here

    seo: seoSchema,
    sponsor: sponsorSchema,

    isFeatured: { type: Boolean, default: false },

    published: { type: Boolean, default: false },
    datePublished: { type: Date, default: null },
    dateModified: { type: Date, default: null },
  },
  { timestamps: true }
);

// Auto update dateModified
blogSchema.pre("save", function (next) {
  this.dateModified = new Date();
  if (this.published && !this.datePublished) {
    this.datePublished = new Date();
  }
  next();
});

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;
