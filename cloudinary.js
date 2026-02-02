const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const isOfficeFile = ['doc','docx','ppt','pptx','xls','xlsx'].includes(ext);
    
    return {
      folder: 'uploads',
      allowed_formats: [
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
        'mp4', 'mov', 'avi'
      ],
      resource_type: 'auto',
      
      ...(isOfficeFile && { 
        raw_convert: "aspose",
        resource_type: "raw"  
      })
    };
  }
});

const parser = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

module.exports = { cloudinary, parser };