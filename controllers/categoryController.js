const Category = require("../models/Category");
const path = require("path");

// ✅ Create Category
exports.createCategory = async (req, res) => {
  try {
    const { name, parent } = req.body;
    let image = req.file ? `/uploads/${req.file.filename}` : null;
    let level = 1;

    if (parent) {
      const parentCat = await Category.findById(parent);
      if (!parentCat)
        return res.status(404).json({ message: "Parent not found" });

      level = parentCat.level + 1;
      if (level > 3)
        return res.status(400).json({ message: "Maximum depth (3) reached" });
    }

    // No image for level 3
    if (level === 3) image = null;

    const category = await Category.create({
      name,
      parent: parent || null,
      level,
      image,
    });
    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get all categories (build tree)
// exports.getAllCategories = async (req, res) => {
//   try {
//     const all = await Category.find().lean();

//     const buildTree = (parent = null) =>
//       all
//         .filter((c) =>
//           parent === null
//             ? c.parent === null
//             : String(c.parent) === String(parent)
//         )
//         .map((c) => ({
//           ...c,
//           children: buildTree(c._id),
//         }));

//     res.json(buildTree());
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// ✅ Get all categories (optimized tree building) by Raian:
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .select("name image parent level") // Only fetch needed fields
      .lean();

    // Build tree in a single pass - O(n) instead of O(n²)
    const categoryMap = new Map();
    const tree = [];

    // First pass: Create map of all categories
    categories.forEach((cat) => {
      categoryMap.set(String(cat._id), { ...cat, children: [] });
    });

    // Second pass: Build tree structure
    categories.forEach((cat) => {
      const node = categoryMap.get(String(cat._id));

      if (cat.parent === null) {
        tree.push(node); // Root level categories
      } else {
        const parentNode = categoryMap.get(String(cat.parent));
        if (parentNode) {
          parentNode.children.push(node);
        }
      }
    });

    res.json(tree);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Search category by name (for debugging)
exports.searchCategory = async (req, res) => {
  try {
    const { mainName, subName } = req.query;
    console.log('🔍 Category search - mainName:', mainName, 'subName:', subName);

    const result = { main: null, sub: null };

    if (mainName) {
      result.main = await Category.findOne({ name: mainName, level: 1 });
      console.log('🔍 Main category found:', result.main ? `Yes (${result.main._id})` : 'No');
    }

    if (subName && result.main) {
      result.sub = await Category.findOne({
        name: subName,
        level: 2,
        parent: result.main._id
      });
      console.log('🔍 Sub category found:', result.sub ? `Yes (${result.sub._id})` : 'No');
    }

    res.json({
      success: true,
      data: result,
      message: `Main: ${result.main ? 'Found' : 'Not found'}, Sub: ${result.sub ? 'Found' : 'Not found'}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Update
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updateData = { name };
    if (req.file) updateData.image = `/uploads/${req.file.filename}`;

    const category = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    if (!category) return res.status(404).json({ message: "Not found" });

    res.json(category);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Delete Category (recursive)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const deleteRecursively = async (catId) => {
      const children = await Category.find({ parent: catId });
      for (const child of children) {
        await deleteRecursively(child._id);
      }
      await Category.findByIdAndDelete(catId);
    };

    await deleteRecursively(id);
    res.json({ message: "Category and its subcategories deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

exports.searchCategory = async (req, res) => {
  try {
    const query = req.query.query?.toLowerCase() || "";

    const categories = await Category.find().populate("parent");

    const results = categories
      .filter((cat) =>
        cat.name.toLowerCase().includes(query)
      )
      .map((cat) => {
        // If category has parent -> this is a subcategory
        if (cat.parent) {
          return {
            mainCategorySlug: slugify(cat.parent.name),
            subCategorySlug: slugify(cat.name),
            mainCategoryName: cat.parent.name,
            subCategoryName: cat.name,
          };
        }

        // If category is level 1 main category
        return {
          mainCategorySlug: slugify(cat.name),
          subCategorySlug: "",
          mainCategoryName: cat.name,
          subCategoryName: "",
        };
      });

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
