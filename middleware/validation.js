const Joi = require("joi");

const productValidation = {
  // Validate ASINs array
  // Validate ASINs array - UPDATED to include categories and SEO
  validateASINs: (req, res, next) => {
    const schema = Joi.object({
      asins: Joi.array()
        .items(
          Joi.string()
            .pattern(/^[A-Z0-9]{10}$/)
            .required()
        )
        .min(1)
        .max(10)
        .required(),

      // Add category fields
      mainCategory: Joi.string().max(100).allow(""),
      subCategory: Joi.string().max(100).allow(""),
      subSubCategory: Joi.string().max(100).allow(""),

      // Add SEO fields
      seo: Joi.object({
        title: Joi.string().max(60).allow(""),
        description: Joi.string().max(160).allow(""),
        keywords: Joi.array().items(Joi.string()).allow(null),
      }).allow(null),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      console.log("❌ Validation error:", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  },

  // Validate product update - EXPANDED to include all fields
  validateProductUpdate: (req, res, next) => {
    const schema = Joi.object({
      // Basic Information
      title: Joi.string().min(1).max(500),
      brand: Joi.string().max(100),
      mainCategory: Joi.string().max(100),
      subCategory: Joi.string().max(100),
      subSubCategory: Joi.string().max(100),

      labels: Joi.array().items(Joi.string()).default([]),
      // Images
      images: Joi.array().items(
        Joi.object({
          url: Joi.string().uri(),
          variant: Joi.string(),
          height: Joi.number(),
          width: Joi.number(),
        })
      ),

      // Pricing
      price: Joi.object({
        amount: Joi.number().min(0),
        currency: Joi.string(),
        displayAmount: Joi.string(),
      }),
      listPrice: Joi.object({
        amount: Joi.number().min(0),
        currency: Joi.string(),
        displayAmount: Joi.string(),
      }),
      discount: Joi.object({
        amount: Joi.number().min(0),
        currency: Joi.string(),
        displayAmount: Joi.string(),
        percentage: Joi.number().min(0).max(100),
      }),

      // Custom Rating
      customRating: Joi.object({
        rating: Joi.number().min(0).max(5),
        reviewCount: Joi.number().min(0),
      }),

      // Features & Specifications
      features: Joi.object({
        feature: Joi.array().items(Joi.string()),
      }),
      colors: Joi.array().items(Joi.string()),
      styles: Joi.array().items(Joi.string()),
      specifications: Joi.array().items(
        Joi.object({
          key: Joi.string(),
          value: Joi.string(),
        })
      ),
      customReviews: Joi.array().items(
        Joi.object({
          author: Joi.string(),
          rating: Joi.number().min(0).max(5),
          title: Joi.string(),
          content: Joi.string(),
          date: Joi.date(),
        })
      ),

      // SEO
      seo: Joi.object({
        title: Joi.string().max(60),
        description: Joi.string().max(160),
        keywords: Joi.array().items(Joi.string()),
      }),

      anchorTags: Joi.array().items(
        Joi.object({
          word: Joi.string().required(),
          link: Joi.string().required(),
          isExternal: Joi.boolean().default(false),
        })
      ),

      // Content
      description: Joi.string(),
      descriptionTitle: Joi.string(),
      introduction: Joi.string(),
      factorsToConsider: Joi.array().items(Joi.string()),
      mostImportantFactors: Joi.object({
        heading: Joi.string(),
        text: Joi.string(),
      }),
      commonQuestions: Joi.array().items(
        Joi.object({
          question: Joi.string(),
          answer: Joi.string(),
        })
      ),
      conclusion: Joi.object({
        heading: Joi.string(),
        text: Joi.string(),
      }),

      // Affiliate & Status
      affiliateUrl: Joi.string().uri(),
      isFullReview: Joi.boolean(),
      isFeatured: Joi.boolean(),
      availability: Joi.string().valid(
        "In Stock",
        "Out of Stock",
        "Pre-order",
        "Available"
      ),
      isActive: Joi.boolean(),
    }).min(1); // At least one field must be provided

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  },
};

const userValidation = {
  validateUserCreate: (req, res, next) => {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      role: Joi.string().valid("admin", "moderator").default("moderator"),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  },

  validateUserUpdate: (req, res, next) => {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50),
      email: Joi.string().email(),
      password: Joi.string().min(6),
      role: Joi.string().valid("admin", "moderator"),
      isActive: Joi.boolean(),
    }).min(1);

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    next();
  },
};

module.exports = { productValidation, userValidation };
