const AmazonPAAPI = require("../utils/amazonPaapi");
const Product = require("../models/Product");

const amazonController = {
  // Fetch products from Amazon PAAPI
  fetchProductsFromAmazon: async (asins) => {
    try {
      const paapi = new AmazonPAAPI();
      const products = await paapi.getItems(asins);
      return products;
    } catch (error) {
      throw new Error(`Amazon API error: ${error.message}`);
    }
  },

  // Refresh single product from Amazon
  refreshProduct: async (asin) => {
    try {
      const paapi = new AmazonPAAPI();
      const products = await paapi.getItems([asin]);

      if (products.length === 0) {
        throw new Error("Product not found in Amazon response");
      }

      const amazonData = products[0];

      // Update product in database
      const updatedProduct = await Product.findOneAndUpdate(
        { asin: asin.toUpperCase() },
        {
          ...amazonData,
          lastUpdated: new Date(),
        },
        { new: true, runValidators: true }
      );

      return updatedProduct;
    } catch (error) {
      throw new Error(`Refresh failed: ${error.message}`);
    }
  },
};

module.exports = amazonController;
