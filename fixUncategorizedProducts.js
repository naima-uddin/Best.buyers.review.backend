const mongoose = require('mongoose');
const Product = require('./models/Product');
const Category = require('./models/Category');
require('dotenv').config();

async function fixUncategorizedProducts() {
  try {
    // Connect to DB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create Uncategorized category
    let uncategorized = await Category.findOne({ 
      name: "Uncategorized", 
      level: 1 
    });

    if (!uncategorized) {
      uncategorized = await Category.create({
        name: "Uncategorized",
        level: 1,
        parent: null,
        image: null
      });
      console.log('✅ Created Uncategorized category:', uncategorized._id);
    } else {
      console.log('✅ Found Uncategorized category:', uncategorized._id);
    }

    // Find products without mainCategory
    const productsWithoutCategory = await Product.find({
      $or: [
        { mainCategory: { $exists: false } },
        { mainCategory: null }
      ]
    });

    console.log(`📦 Found ${productsWithoutCategory.length} products without category`);

    // Update all products
    const result = await Product.updateMany(
      {
        $or: [
          { mainCategory: { $exists: false } },
          { mainCategory: null }
        ]
      },
      {
        $set: { 
          mainCategory: uncategorized._id,
          subCategory: null,
          subSubCategory: null
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} products`);

    // Verify
    const verifyCount = await Product.countDocuments({
      mainCategory: uncategorized._id
    });
    console.log(`✅ Verification: ${verifyCount} products now in Uncategorized`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixUncategorizedProducts();