const express = require("express");
const router = express.Router();

const productController = require("../controllers/productController");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const categoryController = require("../controllers/categoryController");
const keywordController = require("../controllers/keywordController");

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
// Products
router.get("/products", productController.getAllProducts);
router.get("/products/:id", productController.getProductById);
router.get("/products/:asin", productController.getProduct);
// Keywords
router.get("/keywords", keywordController.getAllKeywords);
// Categories (Public - Read Only)
router.get("/categories", categoryController.getAllCategories);
router.get("/featured", productController.getFeaturedProducts);

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
  productValidation.validateASINs,
  productController.addProducts
);
router.patch(
  "/products/:id",
  productValidation.validateProductUpdate,
  productController.updateProductById
);
router.patch(
  "/products/:asin",
  productValidation.validateProductUpdate,
  productController.updateProduct
);
router.patch("/products/refresh/:asin", productController.refreshProduct);
router.post("/products/bulk-refresh", productController.bulkRefresh);

// Delete routes
router.delete("/products/:asin", productController.deleteProduct);
router.patch(
  "/products/:asin/soft-delete",
  productController.softDeleteProduct
);

// =============== CATEGORY MANAGEMENT (ADMIN) ===============
// ✅ Create category (auto-detects main/sub/sub-sub)
router.post(
  "/categories",
  upload.single("image"),
  handleMulterError,
  categoryController.createCategory
);

// ✅ Update category (optional image)
router.put(
  "/categories/:id",
  upload.single("image"),
  handleMulterError,
  categoryController.updateCategory
);

// ✅ Delete category (and all nested subcategories)
router.delete("/categories/:id", categoryController.deleteCategory);

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

// =============== KEYWORDS (ADMIN) ===============
router.post("/keywords", keywordController.createKeyword);
router.post("/keywords/process", keywordController.processText);
router.post("/keywords/bulk-process", keywordController.bulkProcessTexts);

module.exports = router;
