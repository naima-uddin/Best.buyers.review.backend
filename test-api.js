const axios = require("axios");

async function testAPI() {
  try {
    console.log("🧪 Testing API endpoint...\n");

    const params = {
      mainCategoryName: "Office",
      subCategoryName: "Drafting Tables",
      page: 1,
      limit: 10,
      sort: "default",
    };

    console.log("📤 Request parameters:");
    console.log(JSON.stringify(params, null, 2));

    const response = await axios.get("http://localhost:5000/api/products", {
      params: params,
    });

    console.log("\n✅ Response status:", response.status);
    console.log("✅ Response data:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.success) {
      const { products, pagination } = response.data.data;
      console.log(`\n✅ SUCCESS! Found ${products.length} products`);
      console.log(`Total products: ${pagination.total}`);
      console.log(`Pages: ${pagination.pages}`);

      if (products.length > 0) {
        console.log("\n📦 First 3 products:");
        products.slice(0, 3).forEach((p, i) => {
          console.log(`${i + 1}. ${p.title?.substring(0, 80)}...`);
          console.log(
            `   Main: ${p.mainCategory?.name}, Sub: ${p.subCategory?.name}`
          );
        });
      }
    } else {
      console.log("\n❌ API returned success: false");
      console.log("Message:", response.data.message);
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

testAPI();
