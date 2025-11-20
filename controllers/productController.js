const Product = require("../models/Product");
const Category = require("../models/Category");
const amazonController = require("./amazonController");

const productController = {
  // Add multiple products by ASINs
  // In the addProducts method, update the payload handling:
  // ➕ Add multiple products by ASINs
  addProducts: async (req, res) => {
    try {
      const { asins, mainCategory, subCategory, subSubCategory, seo } =
        req.body;

      console.log("📦 Received add products request:", {
        asins,
        mainCategory,
        subCategory,
        subSubCategory,
        seo,
      });

      // 🧩 Step 1 — Normalize ASINs
      if (!asins || !Array.isArray(asins) || asins.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide at least one ASIN.",
        });
      }

      const normalizedAsins = asins.map((a) => a.toUpperCase().trim());

      // 🧩 Step 2 — Find existing ASINs in database
      const existingProducts = await Product.find({
        asin: { $in: normalizedAsins },
      });

      const existingAsins = existingProducts.map((p) => p.asin);
      const newAsins = normalizedAsins.filter(
        (a) => !existingAsins.includes(a)
      );

      // 🧩 Step 3 — If all ASINs exist, stop and show message
      if (newAsins.length === 0) {
        return res.status(400).json({
          success: false,
          message: `⚠️ All ASINs already exist: ${existingAsins.join(", ")}`,
        });
      }

      // 🧩 Step 4 — If some exist, tell which ones, but continue for new ones
      if (existingAsins.length > 0) {
        console.log(`⚠️ Skipping existing ASINs: ${existingAsins.join(", ")}`);
        return res.status(400).json({
          success: false,
          message: `These ASINs already exist: ${existingAsins.join(
            ", "
          )}. Please remove them before adding new ones.`,
        });
      }

      console.log("🔄 Fetching new products for ASINs:", newAsins);

      // 🧩 Step 5 — Fetch only the new ASINs from Amazon API
      const amazonProducts = await amazonController.fetchProductsFromAmazon(
        newAsins
      );

      if (!amazonProducts || amazonProducts.length === 0) {
        return res.status(400).json({
          success: false,
          message: "❌ Could not fetch products from Amazon.",
        });
      }

      console.log("✅ Fetched products from Amazon:", amazonProducts.length);

      // 🧩 Step 6 — Attach category/SEO info
      const productsWithCategories = amazonProducts.map((product) => ({
        ...product,
        ...(mainCategory && { mainCategory }),
        ...(subCategory && { subCategory }),
        ...(subSubCategory && { subSubCategory }),
        ...(seo && { seo }),
      }));

      console.log(
        "💾 Saving products with categories:",
        productsWithCategories.length
      );

      // 🧩 Step 7 — Save only new ones to MongoDB
      const savedProducts = await Product.insertMany(productsWithCategories);

      // 🧩 Step 8 — Create response message
      const message =
        existingAsins.length > 0
          ? `⚠️ Some ASINs already existed: ${existingAsins.join(
              ", "
            )}. ✅ Added only new ASINs: ${newAsins.join(", ")}`
          : `✅ Successfully added all ASINs: ${newAsins.join(", ")}`;

      res.status(201).json({
        success: true,
        message,
        data: {
          added: savedProducts,
          existing: existingAsins,
        },
      });
    } catch (error) {
      console.error("❌ Add products error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Get all products with pagination
  getAllProducts: async (req, res) => {
    try {
      const {
        mainCategory,
        subCategory,
        subSubCategory,
        mainCategoryName,
        subCategoryName,
        subSubCategoryName,
        sort,
      } = req.query;

      console.log("🔍 getAllProducts - Query params:", {
        mainCategoryName,
        subCategoryName,
        subSubCategoryName,
        sort,
        page: req.query.page,
        limit: req.query.limit,
      });

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let filter = { isActive: true };

      // Handle category filtering by name (new approach)
      if (mainCategoryName || subCategoryName || subSubCategoryName) {
        // Find main category by name
        if (mainCategoryName) {
          const mainCat = await Category.findOne({
            name: mainCategoryName,
            level: 1,
          });

          console.log(`🔍 Main category '${mainCategoryName}' lookup:`, mainCat ? `Found (ID: ${mainCat._id})` : "NOT FOUND");

          if (!mainCat) {
            return res.json({
              success: false,
              message: `Main category '${mainCategoryName}' not found`,
              data: { products: [], pagination: { page, limit, total: 0, pages: 0 } },
            });
          }

          filter.mainCategory = mainCat._id;

          // Find sub category by name (must belong to the main category)
          if (subCategoryName) {
            const subCat = await Category.findOne({
              name: subCategoryName,
              level: 2,
              parent: mainCat._id,
            });

            console.log(`🔍 Sub category '${subCategoryName}' lookup:`, subCat ? `Found (ID: ${subCat._id})` : "NOT FOUND");

            if (!subCat) {
              return res.json({
                success: false,
                message: `Sub category '${subCategoryName}' not found under '${mainCategoryName}'`,
                data: { products: [], pagination: { page, limit, total: 0, pages: 0 } },
              });
            }

            filter.subCategory = subCat._id;

            // Find sub-sub category by name (must belong to the sub category)
            if (subSubCategoryName) {
              const subSubCat = await Category.findOne({
                name: subSubCategoryName,
                level: 3,
                parent: subCat._id,
              });

              if (!subSubCat) {
                return res.json({
                  success: false,
                  message: `Sub-sub category '${subSubCategoryName}' not found under '${subCategoryName}'`,
                  data: { products: [], pagination: { page, limit, total: 0, pages: 0 } },
                });
              }

              filter.subSubCategory = subSubCat._id;
            }
          }
        }
      }
      // Fallback to old approach with IDs (for backward compatibility)
      else if (mainCategory || subCategory || subSubCategory) {
        if (subSubCategory) filter.subSubCategory = subSubCategory;
        else if (subCategory) filter.subCategory = subCategory;
        else if (mainCategory) filter.mainCategory = mainCategory;
      }

      console.log("🔍 Final filter being applied:", filter);

      // ✅ Sorting Logic
      let sortOption = { lastUpdated: -1 }; // default sort
      switch (sort) {
        case "rating":
          sortOption = { "customRating.rating": -1 };
          break;
        case "reviews":
          sortOption = { "customRating.reviewCount": -1 };
          break;
        case "price_low":
          sortOption = { "price.amount": 1 };
          break;
        case "price_high":
          sortOption = { "price.amount": -1 };
          break;
        case "popularity":
          sortOption = { isFeatured: -1 };
          break;
      }

      const products = await Product.find(filter)
        .populate("mainCategory", "name")
        .populate("subCategory", "name")
        .populate("subSubCategory", "name")
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .select("-__v");

      const total = await Product.countDocuments(filter);

      console.log(`✅ Found ${products.length} products (total: ${total})`);
      if (products.length > 0) {
        console.log(`✅ First product: ${products[0].title} (main: ${products[0].mainCategory?.name}, sub: ${products[0].subCategory?.name})`);
      }

      res.json({
        success: true,
        data: {
          products,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Get single product by ASIN
  getProduct: async (req, res) => {
    try {
      const { asin } = req.params;

      const product = await Product.findOne({ asin: asin.toUpperCase() });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Get single product by MongoDB ID
  getProductById: async (req, res) => {
    try {
      const { id } = req.params;

      console.log('🔍 getProductById - Looking for product with ID:', id);

      const product = await Product.findById(id)
        .populate("mainCategory", "name")
        .populate("subCategory", "name")
        .populate("subSubCategory", "name");

      if (!product) {
        console.log('❌ getProductById - Product not found with ID:', id);
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      console.log('✅ getProductById - Found product:', product.title);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error('❌ getProductById - Error:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Get featured products
  getFeaturedProducts: async (req, res) => {
    try {
      const featuredProducts = await Product.find({
        isActive: true,
        isFeatured: true,
      })
        .sort({ lastUpdated: -1 }) // show newest first
        .limit(12)
        .select(
          "asin title images price listPrice discount customRating affiliateUrl labels"
        );

      res.json({
        success: true,
        data: featuredProducts,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Update product by ASIN
  updateProduct: async (req, res) => {
    try {
      const { asin } = req.params;
      const updateData = req.body;

      console.log("🔍 Backend received update data:", Object.keys(updateData));
      console.log(
        "🔍 Specifications received:",
        updateData.specifications?.length
      );
      console.log("🔍 Anchor tags received:", updateData.anchorTags?.length);

      // Clean up empty strings and null values for ObjectId fields
      const cleanedData = { ...updateData };

      // Convert empty strings to null for category fields (ObjectId references)
      const categoryFields = ['mainCategory', 'subCategory', 'subSubCategory'];
      categoryFields.forEach(field => {
        if (field in cleanedData) {
          // If empty string, null, or undefined, set to null to remove the field
          if (!cleanedData[field] || cleanedData[field] === '' || cleanedData[field] === 'null') {
            cleanedData[field] = null;
          }
        }
      });

      // Build update operations
      const updateObject = {};
      const unsetFields = {};

      // Separate null values (to unset) from regular values (to set)
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === null) {
          unsetFields[key] = '';
        } else {
          if (!updateObject.$set) updateObject.$set = {};
          updateObject.$set[key] = cleanedData[key];
        }
      });

      // Always update lastUpdated
      if (!updateObject.$set) updateObject.$set = {};
      updateObject.$set.lastUpdated = new Date();

      // Add $unset if there are fields to remove
      if (Object.keys(unsetFields).length > 0) {
        updateObject.$unset = unsetFields;
      }

      console.log("🔄 Update object:", JSON.stringify(updateObject, null, 2));

      const product = await Product.findOneAndUpdate(
        { asin: asin.toUpperCase() },
        updateObject,
        {
          new: true,
          runValidators: true,
          // This ensures empty arrays/objects are saved properly
          setDefaultsOnInsert: true,
        }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      console.log("✅ Product updated successfully");
      console.log("✅ Saved specifications:", product.specifications?.length);
      console.log("✅ Saved anchor tags:", product.anchorTags?.length);

      res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      console.error("❌ Update error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Update product by MongoDB ID
  updateProductById: async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      console.log("🔍 Backend received update data:", Object.keys(updateData));
      console.log(
        "🔍 Specifications received:",
        updateData.specifications?.length
      );
      console.log("🔍 Anchor tags received:", updateData.anchorTags?.length);

      // Clean up empty strings and null values for ObjectId fields
      const cleanedData = { ...updateData };

      // Convert empty strings to null for category fields (ObjectId references)
      const categoryFields = ['mainCategory', 'subCategory', 'subSubCategory'];
      categoryFields.forEach(field => {
        if (field in cleanedData) {
          // If empty string, null, or undefined, set to null to remove the field
          if (!cleanedData[field] || cleanedData[field] === '' || cleanedData[field] === 'null') {
            cleanedData[field] = null;
          }
        }
      });

      // Build update operations
      const updateObject = {};
      const unsetFields = {};

      // Separate null values (to unset) from regular values (to set)
      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key] === null) {
          unsetFields[key] = '';
        } else {
          if (!updateObject.$set) updateObject.$set = {};
          updateObject.$set[key] = cleanedData[key];
        }
      });

      // Always update lastUpdated
      if (!updateObject.$set) updateObject.$set = {};
      updateObject.$set.lastUpdated = new Date();

      // Add $unset if there are fields to remove
      if (Object.keys(unsetFields).length > 0) {
        updateObject.$unset = unsetFields;
      }

      console.log("🔄 Update object:", JSON.stringify(updateObject, null, 2));

      const product = await Product.findByIdAndUpdate(
        id,
        updateObject,
        {
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      console.log("✅ Product updated successfully");
      console.log("✅ Saved specifications:", product.specifications?.length);
      console.log("✅ Saved anchor tags:", product.anchorTags?.length);

      res.json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error) {
      console.error("❌ Update error:", error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Refresh product data from Amazon
  refreshProduct: async (req, res) => {
    try {
      const { asin } = req.params;

      const updatedProduct = await amazonController.refreshProduct(asin);

      res.json({
        success: true,
        message: "Product refreshed successfully",
        data: updatedProduct,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Delete product (soft delete)
  deleteProduct: async (req, res) => {
    try {
      const { asin } = req.params;
      const product = await Product.findOneAndDelete({
        asin: asin.toUpperCase(),
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  softDeleteProduct: async (req, res) => {
    try {
      const { asin } = req.params;

      const product = await Product.findOneAndUpdate(
        { asin: asin.toUpperCase() },
        { isActive: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product soft deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Bulk refresh products
  bulkRefresh: async (req, res) => {
    try {
      const { asins } = req.body;

      const results = {
        successful: [],
        failed: [],
      };

      for (const asin of asins) {
        try {
          const updatedProduct = await amazonController.refreshProduct(asin);
          results.successful.push(asin);
        } catch (error) {
          results.failed.push({
            asin: asin,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        message: `Refreshed ${results.successful.length} products, ${results.failed.length} failed`,
        data: results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },
};

module.exports = productController;
