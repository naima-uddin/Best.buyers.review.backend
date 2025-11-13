const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String }, // image only for level 1 or 2
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    level: { type: Number, enum: [1, 2, 3], required: true }, // 1=Main, 2=Sub, 3=Sub-sub
  },
  { timestamps: true }
);

module.exports = mongoose.model("Category", categorySchema);
