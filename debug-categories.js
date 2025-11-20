require("dotenv").config();
const mongoose = require("mongoose");
const Category = require("./models/Category");
const Product = require("./models/Product");

async function debugCategories() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Find all categories
    console.log("📁 ALL CATEGORIES:");
    console.log("==================");
    const allCategories = await Category.find().sort({ level: 1, name: 1 });

    const mainCategories = allCategories.filter((c) => c.level === 1);
    console.log("\n🏷️  MAIN CATEGORIES (Level 1):");
    mainCategories.forEach((cat) => {
      console.log(`  - "${cat.name}" (ID: ${cat._id})`);
    });

    // Find "Office" category specifically
    console.log('\n🔍 Looking for "Office" category:');
    const officeCategory = await Category.findOne({ name: "Office", level: 1 });
    if (officeCategory) {
      console.log(
        `✅ Found: "${officeCategory.name}" (ID: ${officeCategory._id})`
      );

      // Find subcategories under Office
      console.log('\n📂 Sub-categories under "Office":');
      const subCategories = await Category.find({
        parent: officeCategory._id,
        level: 2,
      });
      subCategories.forEach((cat) => {
        console.log(`  - "${cat.name}" (ID: ${cat._id})`);
      });

      // Check for "Drafting Tables"
      console.log('\n🔍 Looking for "Drafting Tables" under "Office":');
      const draftingTables = await Category.findOne({
        name: "Drafting Tables",
        level: 2,
        parent: officeCategory._id,
      });

      if (draftingTables) {
        console.log(
          `✅ Found: "${draftingTables.name}" (ID: ${draftingTables._id})`
        );

        // Check products
        console.log("\n📦 Checking products with these categories:");
        const productCount = await Product.countDocuments({
          mainCategory: officeCategory._id,
          subCategory: draftingTables._id,
          isActive: true,
        });
        console.log(`Found ${productCount} active products`);

        if (productCount > 0) {
          const sampleProducts = await Product.find({
            mainCategory: officeCategory._id,
            subCategory: draftingTables._id,
            isActive: true,
          })
            .limit(3)
            .populate("mainCategory", "name")
            .populate("subCategory", "name");

          console.log("\n📦 Sample products:");
          sampleProducts.forEach((p) => {
            console.log(`  - ${p.title}`);
            console.log(
              `    Main: ${p.mainCategory?.name}, Sub: ${p.subCategory?.name}`
            );
          });
        }
      } else {
        console.log("❌ NOT FOUND");
        console.log("Trying case-insensitive search:");
        const anyDrafting = await Category.find({
          name: /drafting/i,
          level: 2,
          parent: officeCategory._id,
        });
        if (anyDrafting.length > 0) {
          console.log("Found similar categories:");
          anyDrafting.forEach((cat) => {
            console.log(`  - "${cat.name}" (exact spelling)`);
          });
        }
      }
    } else {
      console.log("❌ NOT FOUND");
      console.log("Trying case-insensitive search:");
      const anyOffice = await Category.find({ name: /office/i, level: 1 });
      if (anyOffice.length > 0) {
        console.log("Found similar categories:");
        anyOffice.forEach((cat) => {
          console.log(`  - "${cat.name}" (exact spelling)`);
        });
      }
    }

    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

debugCategories();
