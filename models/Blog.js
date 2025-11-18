import mongoose from "mongoose";

// -------------------------------
// Content Block Schema
// -------------------------------
const contentBlockSchema = new mongoose.Schema({
  type: { type: String, required: true }, // paragraph, quote, link, heading, image, list

  data: {
    text: [
      {
        type: { type: String, default: "text" },
        value: { type: String },
      },
    ],

    // ⭐ Your blog JSON contains "url" on link blocks
    url: { type: String, default: "" },

    // bullet / numbered list
    items: [{ type: String }],
  },
});

// -------------------------------
// Featured / Content Image Schema
// -------------------------------
const imageSchema = new mongoose.Schema({
  url: { type: String },
  public_id: { type: String },
  alt: { type: String }, // You have ALT inside contentImages
});

// -------------------------------
// Author Schema
// -------------------------------
const authorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  avatar: { type: String },
  bio: { type: String },
});

const anchorTagSchema = new mongoose.Schema({
  word: String,
  link: String,
  isExternal: {
    type: Boolean,
    default: false,
  },
});

// -------------------------------
// SEO Schema
// -------------------------------
const seoSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  keywords: [{ type: String }],
  canonicalUrl: { type: String },
});

// -------------------------------
// Sponsor Schema
// -------------------------------
const sponsorSchema = new mongoose.Schema({
  name: { type: String },
  link: { type: String },
  logo: { type: String },
});

// -------------------------------
// Category Schema (YOUR JSON USES OBJECTS)
// -------------------------------
const categoryRefSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId },
  name: { type: String },
  slug: { type: String },
});

// -------------------------------
// Main Blog Schema
// -------------------------------
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },

    description: { type: String },
    excerpt: { type: String },

    author: authorSchema,

    // ⭐ Your JSON uses FULL OBJECTS for categories
    categories: [categoryRefSchema],

    tags: [{ type: String }],

    content: [contentBlockSchema],

    featuredImage: imageSchema,

    contentImages: [imageSchema],

    anchorTags: [anchorTagSchema],

    seo: seoSchema,
    sponsor: sponsorSchema,

    isFeatured: { type: Boolean, default: false },

    published: { type: Boolean, default: false },
    datePublished: { type: Date, default: null },
    dateModified: { type: Date, default: null },
  },
  { timestamps: true }
);

// -------------------------------
// Auto-update dateModified & datePublished
// -------------------------------
blogSchema.pre("save", function (next) {
  this.dateModified = new Date();

  if (this.published && !this.datePublished) {
    this.datePublished = new Date();
  }

  next();
});

const Blog = mongoose.model("Blog", blogSchema);
export default Blog;
