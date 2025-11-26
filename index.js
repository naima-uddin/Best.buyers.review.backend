const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/database");
const apiRoutes = require("./routes/api");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// Security + CORS
app.use(helmet());
// app.use(
//   cors({
//     origin: "*",
//   })
// );

const allowedOrigins = [
  "https://www.bestbuyersview.com",
  "https://best-buyers-review-frontend-2.onrender.com",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // allow non-browser requests
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".bestbuyersview.com")
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
  })
);


app.use(express.json({ limit: '50mb' })); // Increased from default ~100KB to 50MB
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Serve uploaded images with CORP fix
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "public", "uploads"))
);

// API
app.use("/api", apiRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
