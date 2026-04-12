const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dahnkpvk2",
  api_key: process.env.CLOUDINARY_API_KEY || "331386394888447",
  api_secret: process.env.CLOUDINARY_API_SECRET || "kO2h8Tr59dN_MBCW3EoWFIxeB_I",
});

// Upload image to cloudinary
const uploadImage = async (fileBuffer, folder = "blog") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `bestbuyersview/${folder}`,
        resource_type: "image",
        transformation: [
          { quality: "auto:good", fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          resourceType: "image"
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Upload video to cloudinary
const uploadVideo = async (fileBuffer, folder = "blog/videos") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `bestbuyersview/${folder}`,
        resource_type: "video",
        chunk_size: 6000000,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          public_id: result.public_id,
          url: result.secure_url,
          width: result.width,
          height: result.height,
          format: result.format,
          duration: result.duration,
          resourceType: "video"
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// Delete asset from cloudinary
const deleteAsset = async (publicId, resourceType = "image") => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    return result;
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadVideo,
  deleteAsset
};
