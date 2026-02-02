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
    const isOfficeFile = ['doc','docx','ppt','pptx'].includes(ext);
    const isPdf = ext === 'pdf';
    
    return {
      folder: 'uploads',
      allowed_formats: [
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'pdf', 'doc', 'docx', 'ppt', 'pptx',
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
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.split('.').pop().toLowerCase();
    const ALLOWED_EXTENSIONS = ['jpg','jpeg','png','gif','webp','mp4','mov','avi','pdf','doc','docx','ppt','pptx'];
    
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      console.error(`❌ File rejected: ${ext}`);
      return cb(new Error(`File type .${ext} is not allowed`), false);
    }
    
    console.log(`✅ File accepted: ${ext}`);
    cb(null, true);
  }
});

module.exports = { cloudinary, parser };