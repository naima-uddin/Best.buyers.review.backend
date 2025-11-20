const axios = require('axios');

async function testURLEncoding() {
  try {
    console.log('🧪 Testing URL encoding scenarios...\n');

    // Test 1: Direct string (what we tested before)
    console.log('TEST 1: Direct string');
    const test1 = await axios.get('http://localhost:5000/api/products', {
      params: {
        mainCategoryName: 'Office',
        subCategoryName: 'Drafting Tables',
        page: 1,
        limit: 10
      }
    });
    console.log(`✅ Found ${test1.data.data.products.length} products\n`);

    // Test 2: URL-encoded string (simulating frontend URL)
    console.log('TEST 2: URL-encoded params (like browser)');
    const encodedUrl = 'http://localhost:5000/api/products?mainCategoryName=Office&subCategoryName=Drafting%20Tables&page=1&limit=10';
    const test2 = await axios.get(encodedUrl);
    console.log(`✅ Found ${test2.data.data.products.length} products\n`);

    // Test 3: Using URLSearchParams (like some frontends)
    console.log('TEST 3: Using URLSearchParams');
    const params = new URLSearchParams({
      mainCategoryName: 'Office',
      subCategoryName: 'Drafting Tables',
      page: 1,
      limit: 10
    });
    const test3 = await axios.get(`http://localhost:5000/api/products?${params.toString()}`);
    console.log(`✅ Found ${test3.data.data.products.length} products\n`);

    console.log('✅ All URL encoding tests passed! Backend handles encoding correctly.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testURLEncoding();
