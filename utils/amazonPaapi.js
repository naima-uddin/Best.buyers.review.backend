// 1.utils/amazonPaapi.js - The Amazon Communicator
// Takes your ASIN
// Sends request to Amazon
// Gets back product info
// Transforms it into our format

// 2.controllers/productController.js - The Product Manager
// Receives ASINs from frontend
// Calls the Amazon communicator
// Saves products to database

// 3.routes/api.js - The Traffic Director
// Routes: POST /api/products/add → goes to product controller
const crypto = require("crypto");
const axios = require("axios");

class AmazonPAAPI {
  constructor() {
    this.accessKey = process.env.AMAZON_ACCESS_KEY;
    this.secretKey = process.env.AMAZON_SECRET_KEY;
    this.partnerTag = process.env.AMAZON_PARTNER_TAG;

    // Auto-detect region based on partner tag
    this.host = this.detectHostFromTag();
    this.region = this.detectRegionFromTag();
    this.service = "ProductAdvertisingAPI";

    console.log("🌍 Detected configuration:", {
      partnerTag: this.partnerTag,
      host: this.host,
      region: this.region,
    });
  }

  detectHostFromTag() {
    const tag = this.partnerTag || "";
    if (tag.includes(".co.uk") || tag.endsWith("-21")) {
      return "webservices.amazon.co.uk";
    } else if (tag.includes(".ca") || tag.endsWith("-22")) {
      return "webservices.amazon.ca";
    } else if (tag.includes(".de") || tag.endsWith("-23")) {
      return "webservices.amazon.de";
    } else if (tag.includes(".fr") || tag.endsWith("-24")) {
      return "webservices.amazon.fr";
    } else if (tag.includes(".co.jp") || tag.endsWith("-25")) {
      return "webservices.amazon.co.jp";
    } else {
      return "webservices.amazon.com"; // Default to US
    }
  }

  detectRegionFromTag() {
    const host = this.host;
    if (
      host.includes(".co.uk") ||
      host.includes(".de") ||
      host.includes(".fr")
    ) {
      return "eu-west-1";
    } else if (host.includes(".co.jp")) {
      return "us-west-2";
    } else {
      return "us-east-1"; // Default to US
    }
  }

  getMarketplace() {
    const host = this.host;
    if (host.includes(".co.uk")) return "www.amazon.co.uk";
    if (host.includes(".ca")) return "www.amazon.ca";
    if (host.includes(".de")) return "www.amazon.de";
    if (host.includes(".fr")) return "www.amazon.fr";
    if (host.includes(".co.jp")) return "www.amazon.co.jp";
    return "www.amazon.com"; // Default to US
  }

  // Generate signature key
  getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto
      .createHmac("sha256", "AWS4" + key)
      .update(dateStamp, "utf8")
      .digest();
    const kRegion = crypto
      .createHmac("sha256", kDate)
      .update(regionName, "utf8")
      .digest();
    const kService = crypto
      .createHmac("sha256", kRegion)
      .update(serviceName, "utf8")
      .digest();
    const kSigning = crypto
      .createHmac("sha256", kService)
      .update("aws4_request", "utf8")
      .digest();
    return kSigning;
  }

  // Generate AWS v4 headers
  generateHeaders(payload) {
    const method = "POST";
    const canonicalUri = "/paapi5/getitems";
    const canonicalQueryString = "";

    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const canonicalHeaders =
      [
        "content-type:application/json; charset=utf-8",
        `host:${this.host}`,
        `x-amz-date:${amzDate}`,
        "x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
      ].join("\n") + "\n";

    const signedHeaders = "content-type;host;x-amz-date;x-amz-target";

    // Hash the payload
    const payloadHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");

    // Create canonical request
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;

    // Hash the canonical request
    const canonicalRequestHash = crypto
      .createHash("sha256")
      .update(canonicalRequest, "utf8")
      .digest("hex");

    // Create string to sign
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join("\n");

    // Calculate the signature
    const signingKey = this.getSignatureKey(
      this.secretKey,
      dateStamp,
      this.region,
      this.service
    );
    const signature = crypto
      .createHmac("sha256", signingKey)
      .update(stringToSign, "utf8")
      .digest("hex");

    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      Accept: "application/json, text/javascript",
      "Accept-Encoding": "identity",
      "Content-Type": "application/json; charset=utf-8",
      "Content-Encoding": "amz-1.0",
      "X-Amz-Date": amzDate,
      "X-Amz-Target": "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems",
      Authorization: authorizationHeader,
    };
  }

  async getItems(asins) {
    try {
      console.log("🔍 Fetching products for ASINs:", asins);
      console.log("🔑 Using Partner Tag:", this.partnerTag);
      console.log("🌍 Marketplace:", this.getMarketplace());

      const payload = {
        ItemIds: asins,
        ItemIdType: "ASIN",
        PartnerTag: this.partnerTag,
        PartnerType: "Associates",
        Marketplace: this.getMarketplace(), // Use detected marketplace
        // In your getItems method - UPDATE THE RESOURCES:
        Resources: [
          "Images.Primary.Small",
          "Images.Primary.Medium",
          "Images.Primary.Large",
          "Images.Variants.Small",
          "Images.Variants.Medium",
          "Images.Variants.Large",
          "ItemInfo.Title",
          "ItemInfo.ByLineInfo",
          "ItemInfo.Features",
          "ItemInfo.ManufactureInfo",
          "ItemInfo.ProductInfo",
          "Offers.Listings.Price",
          "Offers.Listings.SavingBasis",
          "Offers.Listings.MerchantInfo",
          "Offers.Listings.Condition",
          "Offers.Listings.DeliveryInfo.IsPrimeEligible",
          "Offers.Summaries.LowestPrice",
        ],
      };

      console.log("📤 Payload being sent:", JSON.stringify(payload, null, 2));

      const headers = this.generateHeaders(payload);

      console.log(
        "🌐 Making request to:",
        `https://${this.host}/paapi5/getitems`
      );

      const response = await axios.post(
        `https://${this.host}/paapi5/getitems`,
        payload,
        {
          headers: headers,
          timeout: 10000,
        }
      );

      console.log("📥 Response:", response);
      console.log("📥 Response Status:", response.status);
      console.log("📥 Raw Response:", response.data);

      const data = response.data;

      if (data.Errors && data.Errors.length > 0) {
        console.error("❌ PAAPI Errors:", data.Errors);

        // Provide more helpful error messages
        const error = data.Errors[0];
        if (error.Code === "InvalidParameterValue") {
          throw new Error(
            `Invalid ASIN(s). Please check if the products exist in ${this.getMarketplace()}`
          );
        } else if (error.Code === "NoResults") {
          throw new Error(
            "No products found for the given ASINs in your region"
          );
        } else {
          throw new Error(error.Message || "Amazon API error");
        }
      }

      if (
        !data.ItemsResult ||
        !data.ItemsResult.Items ||
        data.ItemsResult.Items.length === 0
      ) {
        throw new Error("No products found for the given ASINs");
      }

      console.log(
        "✅ Successfully fetched",
        data.ItemsResult.Items.length,
        "products"
      );
      return data.ItemsResult.Items.map((item) =>
        this.transformProductData(item)
      );
    } catch (error) {
      console.error("💥 PAAPI Fetch Error:", error);
      throw new Error(`Amazon API error: ${error.message}`);
    }
  }

  transformProductData(item) {
    const itemInfo = item.ItemInfo || {};
    const offers = item.Offers || {};
    const images = item.Images || {};

    console.log("🧾 Amazon Raw Item Sample:", JSON.stringify(item, null, 2));

    // Extract price
    let price = null;
    let listPrice = null;
    let discount = null;

    if (offers.Listings && offers.Listings[0] && offers.Listings[0].Price) {
      const listingPrice = offers.Listings[0].Price;
      price = {
        amount: listingPrice.Amount || 0,
        currency: listingPrice.Currency || "USD",
        displayAmount: listingPrice.DisplayAmount || "$0.00",
      };

      // Extract original price (SavingBasis) - ADD THIS
      const listing = offers.Listings[0];

      if (listing.SavingBasis) {
        const savingBasis = listing.SavingBasis;
        listPrice = {
          amount: savingBasis.Amount || 0,
          currency: savingBasis.Currency || "USD",
          displayAmount: savingBasis.DisplayAmount || "$0.00",
        };
      } else if (listing.AmountSaved && listing.Price) {
        // Derive original price manually
        const original = listing.Price.Amount + listing.AmountSaved.Amount;
        listPrice = {
          amount: original,
          currency: listing.Price.Currency || "USD",
          displayAmount: `$${original.toFixed(2)}`,
        };
      }

      // Calculate discount if both prices are available - ADD THIS
      if (price && listPrice && listPrice.amount > price.amount) {
        const discountAmount = listPrice.amount - price.amount;
        const discountPercentage = Math.round(
          (discountAmount / listPrice.amount) * 100
        );

        discount = {
          amount: discountAmount,
          currency: price.currency,
          displayAmount: `-${discountPercentage}%`,
          percentage: discountPercentage,
        };
      } else {
        // No discount - set listPrice same as price
        listPrice = price;
        discount = {
          amount: 0,
          currency: price.currency,
          displayAmount: "0%",
          percentage: 0,
        };
      }
    }

    // If no listing price but we have price, set listPrice = price - ADD THIS
    if (price && !listPrice) {
      listPrice = { ...price };
      discount = {
        amount: 0,
        currency: price.currency,
        displayAmount: "0%",
        percentage: 0,
      };
    }

    // Extract images
    const productImages = [];
    if (images.Primary) {
      if (images.Primary.Large) {
        productImages.push({
          url: images.Primary.Large.URL,
          variant: "MAIN",
          height: images.Primary.Large.Height,
          width: images.Primary.Large.Width,
        });
      } else if (images.Primary.Medium) {
        productImages.push({
          url: images.Primary.Medium.URL,
          variant: "MAIN",
          height: images.Primary.Medium.Height,
          width: images.Primary.Medium.Width,
        });
      }
    }

    // Variant images (sub-images)
    if (images.Variants && images.Variants.length > 0) {
      images.Variants.forEach((variant, index) => {
        if (variant.Medium) {
          productImages.push({
            url: variant.Medium.URL,
            variant: "SUB",
            height: variant.Medium.Height,
            width: variant.Medium.Width,
            caption: `View ${index + 1}`,
          });
        } else if (variant.Small) {
          productImages.push({
            url: variant.Small.URL,
            variant: "SUB",
            height: variant.Small.Height,
            width: variant.Small.Width,
            caption: `View ${index + 1}`,
          });
        }
      });
    }

    // If no variant images but we have multiple primary sizes, use them as sub-images
    if (productImages.length === 1 && images.Primary) {
      if (images.Primary.Medium && images.Primary.Small) {
        productImages.push({
          url: images.Primary.Medium.URL,
          variant: "SUB",
          height: images.Primary.Medium.Height,
          width: images.Primary.Medium.Width,
        });
      }
    }

    // Extract features
    const features = itemInfo.Features
      ? itemInfo.Features.DisplayValues || []
      : [];

    return {
      asin: item.ASIN ? item.ASIN.toUpperCase() : "UNKNOWN_ASIN",
      title: itemInfo.Title
        ? itemInfo.Title.DisplayValue
        : "No Title Available",
      images: productImages,
      price: price,
      listPrice: listPrice,
      discount: discount,
      offers: {
        totalOffers: offers.Summaries
          ? offers.Summaries[0]?.OfferCount || 0
          : 0,
        lowestPrice: offers.Summaries?.[0]?.LowestPrice
          ? {
              amount: offers.Summaries[0].LowestPrice.Amount || 0,
              currency: offers.Summaries[0].LowestPrice.Currency || "USD",
              displayAmount:
                offers.Summaries[0].LowestPrice.DisplayAmount || "$0.00",
            }
          : null,
      },
      brand: itemInfo.ByLineInfo
        ? itemInfo.ByLineInfo.Brand?.DisplayValue || "Unknown Brand"
        : "Unknown Brand",
      availability: "In Stock",
      description: itemInfo.Features
        ? features.join(". ")
        : "No description available",
      details: {
        brand: itemInfo.ByLineInfo
          ? itemInfo.ByLineInfo.Brand?.DisplayValue || "Unknown Brand"
          : "Unknown Brand",
        manufacturer: itemInfo.ByLineInfo
          ? itemInfo.ByLineInfo.Manufacturer?.DisplayValue ||
            "Unknown Manufacturer"
          : "Unknown Manufacturer",
      },
      features: {
        feature: features,
      },
      isFullReview: false,
      isCoupon: false,
      affiliateUrl: `https://www.amazon.com/dp/${item.ASIN}?tag=${this.partnerTag}`,
      lastUpdated: new Date(),
      isActive: true,
    };
  }
}

module.exports = AmazonPAAPI;
