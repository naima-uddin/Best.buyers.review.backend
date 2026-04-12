const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const categoryController = require("../controllers/categoryController");
const keywordController = require("../controllers/keywordController");

const { cacheMiddleware } = require("../utils/cache");
const { invalidateCacheMiddleware } = require("../utils/cacheInvalidation");
const { upload, handleMulterError } = require("../middleware/upload");
const {
  productValidation,
  userValidation,
} = require("../middleware/validation");
const { authenticateAdmin, requireAdmin } = require("../middleware/auth");

console.log("🔄 Loading API routes...");

// =============== GLOBAL REQUEST LOGGER ===============
router.use((req, res, next) => {
  console.log(`🌐 Incoming: ${req.method} ${req.originalUrl}`);
  console.log(`🌐 Content-Type: ${req.headers["content-type"]}`);
  console.log(
    `🌐 Authorization: ${req.headers.authorization ? "Present" : "Missing"}`
  );
  console.log(`🌐 Body keys:`, Object.keys(req.body || {}));
  next();
});

// =============== PUBLIC ROUTES ===============
// Authentication
router.post("/auth/login", authController.login);

// Products - NO caching (used by dashboard)
router.get("/products", productController.getAllProducts);
router.get("/products/:id", productController.getProductById);
router.get("/products/:asin", productController.getProduct);

// Keywords - NO caching (used by dashboard)
router.get("/keywords", keywordController.getAllKeywords);

// Categories (Public - Read Only) - NO caching (used by dashboard)
router.get("/categories", categoryController.getAllCategories);
router.get("/category/search", categoryController.searchCategory);

// Featured products - with caching for public frontend
router.get(
  "/featured",
  cacheMiddleware(300),
  productController.getFeaturedProducts
); // 5 min cache
router.get(
  "/labels",
  cacheMiddleware(300),
  productController.getProductsByLabels
); // 5 min cache

// Blog routes are now handled by /api/blog routes (see routes/blog.js)
// All blog endpoints moved to dedicated blog router

// =============== ADMIN PROTECTED ROUTES ===============
router.use(authenticateAdmin);

// Debug route
router.post("/test-formdata", (req, res) => {
  console.log("🧪 TEST ROUTE - Body:", req.body);
  console.log("🧪 TEST ROUTE - Keys:", Object.keys(req.body || {}));

  res.json({
    success: true,
    body: req.body,
    message: "Test completed - Body should have data",
  });
});

// Log every admin route
router.use((req, res, next) => {
  console.log(`🛣️  Route accessed: ${req.method} ${req.path}`);
  next();
});

// =============== PRODUCT MANAGEMENT (ADMIN) ===============
router.post(
  "/products/add",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productValidation.validateASINs,
  productController.addProducts
);
router.patch(
  "/products/:id",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productValidation.validateProductUpdate,
  productController.updateProductById
);
router.patch(
  "/products/:asin",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productValidation.validateProductUpdate,
  productController.updateProduct
);
router.patch(
  "/products/refresh/:asin",
  invalidateCacheMiddleware("cache:/api/products*"),
  productController.refreshProduct
);
router.post(
  "/products/bulk-refresh",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productController.bulkRefresh
);

// Delete routes
router.delete(
  "/products/:asin",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productController.deleteProduct
);
router.patch(
  "/products/:asin/soft-delete",
  invalidateCacheMiddleware(
    "cache:/api/products*",
    "cache:/api/featured*",
    "cache:/api/labels*"
  ),
  productController.softDeleteProduct
);

// =============== CATEGORY MANAGEMENT (ADMIN) ===============
// ✅ Create category (auto-detects main/sub/sub-sub)
router.post(
  "/categories",
  invalidateCacheMiddleware("cache:/api/categories*", "cache:/api/category/*"),
  upload.single("image"),
  handleMulterError,
  categoryController.createCategory
);

// ✅ Update category (optional image)
router.put(
  "/categories/:id",
  invalidateCacheMiddleware("cache:/api/categories*", "cache:/api/category/*"),
  upload.single("image"),
  handleMulterError,
  categoryController.updateCategory
);

// ✅ Delete category (and all nested subcategories)
router.delete(
  "/categories/:id",
  invalidateCacheMiddleware("cache:/api/categories*", "cache:/api/category/*"),
  categoryController.deleteCategory
);

// =============== USER MANAGEMENT (ADMIN) ===============
router.get("/users", requireAdmin, userController.getAllUsers);
router.post(
  "/users",
  requireAdmin,
  userValidation.validateUserCreate,
  userController.createUser
);
router.put(
  "/users/:id",
  requireAdmin,
  userValidation.validateUserUpdate,
  userController.updateUser
);
router.delete("/users/:id", requireAdmin, userController.deleteUser);

// =============== BLOG MANAGEMENT ===============
// Blog routes moved to routes/blog.js
// Access via /api/blog/* endpoints

// =============== ADMIN UPLOAD ===============
const uploadMulter = require("multer")({ 
  storage: require("multer").memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB for videos
});

router.post("/admin/upload", uploadMulter.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No file uploaded" });
    }

    const fs = require("fs");
    const path = require("path");
    
    // Get folder from request or use default
    const folder = req.body.folder || "uploads";
    const uploadDir = path.join(__dirname, "../public/uploads", folder);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(req.file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    fs.writeFileSync(filepath, req.file.buffer);

    // Determine resource type
    const isVideo = req.file.mimetype.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    // Build URL
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const url = `${baseUrl}/uploads/${folder}/${filename}`;

    res.json({
      ok: true,
      asset: {
        url,
        public_id: `${folder}/${filename}`,
        format: ext.replace(".", ""),
        resourceType
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// =============== KEYWORDS (ADMIN) ===============
router.post("/keywords", keywordController.createKeyword);
router.post("/keywords/process", keywordController.processText);
router.post("/keywords/bulk-process", keywordController.bulkProcessTexts);

module.exports = router;
