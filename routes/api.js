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
const { default: blogController } = require("../controllers/blogController");

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

// Products - with caching
router.get("/products", cacheMiddleware(300), productController.getAllProducts); // 5 min cache
router.get("/products/:id", cacheMiddleware(300), productController.getProductById);
router.get("/products/:asin", cacheMiddleware(300), productController.getProduct);

// Keywords
router.get("/keywords", cacheMiddleware(3600), keywordController.getAllKeywords); // 1 hour cache

// Categories (Public - Read Only) - cache heavily as they change rarely
router.get("/categories", cacheMiddleware(3600), categoryController.getAllCategories); // 1 hour cache
router.get("/category/search", cacheMiddleware(600), categoryController.searchCategory); // 10 min cache

// Featured products - with caching
router.get("/featured", cacheMiddleware(300), productController.getFeaturedProducts); // 5 min cache
router.get("/labels", cacheMiddleware(300), productController.getProductsByLabels); // 5 min cache

// Blogs (Public - Read Only) - with caching
router.get("/blog", cacheMiddleware(600), blogController.getAllBlogs); // 10 min cache
router.get("/blog/:slug", cacheMiddleware(1800), blogController.getBlogBySlug); // 30 min cache



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
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
  productValidation.validateASINs,
  productController.addProducts
);
router.patch(
  "/products/:id",
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
  productValidation.validateProductUpdate,
  productController.updateProductById
);
router.patch(
  "/products/:asin",
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
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
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
  productController.bulkRefresh
);

// Delete routes
router.delete(
  "/products/:asin",
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
  productController.deleteProduct
);
router.patch(
  "/products/:asin/soft-delete",
  invalidateCacheMiddleware("cache:/api/products*", "cache:/api/featured*", "cache:/api/labels*"),
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
router.post("/blog", blogController.createBlog);
router.patch("/blog/:slug", blogController.updateBlog);
router.delete("/blog/:slug", blogController.deleteBlog);

// =============== KEYWORDS (ADMIN) ===============
router.post("/keywords", keywordController.createKeyword);
router.post("/keywords/process", keywordController.processText);
router.post("/keywords/bulk-process", keywordController.bulkProcessTexts);

module.exports = router;
