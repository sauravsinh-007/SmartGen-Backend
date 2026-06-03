const path = require('path');
const fs = require('fs');
const multer = require('multer');

// ─── Detect whether real Cloudinary credentials are provided ──────────────────
const isCloudinaryConfigured =
  process.env.CLOUDINARY_API_KEY &&
  !process.env.CLOUDINARY_API_KEY.startsWith('your_') &&
  process.env.CLOUDINARY_CLOUD_NAME &&
  !process.env.CLOUDINARY_CLOUD_NAME.startsWith('your_');

// ─── Local fallback storage ───────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const localDiskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `clothing_${Date.now()}_${Math.random().toString(36).slice(2, 9)}${ext}`);
  },
});

// ─── Cloudinary (only loaded when credentials exist) ─────────────────────────
let cloudinaryV2 = null;
let streamifier = null;

if (isCloudinaryConfigured) {
  cloudinaryV2 = require('cloudinary').v2;
  streamifier = require('streamifier');
  cloudinaryV2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  console.log('✅ Cloudinary configured — images will upload to cloud');
} else {
  console.log('⚠️  Cloudinary not configured — images will be stored locally in /uploads');
}

// ─── File filter (shared) ─────────────────────────────────────────────────────
const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
};

// ─── Multer instances ─────────────────────────────────────────────────────────
const storage = isCloudinaryConfigured ? multer.memoryStorage() : localDiskStorage;

const uploadClothingMulter = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadProfileMulter  = multer({ storage, fileFilter: imageFilter, limits: { fileSize: 5  * 1024 * 1024 } });

// ─── Cloudinary stream helper ─────────────────────────────────────────────────
const streamToCloudinary = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinaryV2.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });

// ─── Upload middleware factory ─────────────────────────────────────────────────
// Attaches req.file.path (URL) and req.file.filename (public_id / local name)
// so controllers work the same whether using Cloudinary or local storage.
const uploadToCloudinary = (folder, transformations = []) =>
  async (req, res, next) => {
    if (!req.file) return next();

    if (!isCloudinaryConfigured) {
      // Local mode — file is already on disk; build a URL from it
      const host = `${req.protocol}://${req.get('host')}`;
      req.file.path     = `${host}/uploads/${req.file.filename}`;
      req.file.filename = req.file.filename;   // local filename as public_id
      return next();
    }

    // Cloudinary mode — stream buffer
    try {
      const result = await streamToCloudinary(req.file.buffer, {
        folder: `wardrobeai/${req.user?.id || 'general'}/${folder}`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: transformations.length
          ? transformations
          : [{ width: 800, height: 800, crop: 'limit', quality: 'auto:good' }],
        public_id: `${folder}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      });
      req.file.path     = result.secure_url;
      req.file.filename = result.public_id;
      next();
    } catch (err) {
      next(err);
    }
  };

// ─── Composed middleware arrays used by routes ────────────────────────────────
const clothingUploadMiddleware = [
  uploadClothingMulter.single('image'),
  uploadToCloudinary('clothing'),
];

const profileUploadMiddleware = [
  uploadProfileMulter.single('profilePhoto'),
  uploadToCloudinary('profile', [
    { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' },
  ]),
];

// ─── Delete helper ────────────────────────────────────────────────────────────
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  if (!isCloudinaryConfigured) {
    // Delete local file
    const filePath = path.join(UPLOADS_DIR, publicId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  try {
    await cloudinaryV2.uploader.destroy(publicId);
  } catch (err) {
    console.error('Error deleting from Cloudinary:', err.message);
  }
};

module.exports = {
  cloudinary: cloudinaryV2,
  isCloudinaryConfigured,
  uploadClothing: { single: () => clothingUploadMiddleware },
  uploadProfile:  { single: () => profileUploadMiddleware  },
  clothingUploadMiddleware,
  profileUploadMiddleware,
  deleteFromCloudinary,
  streamToCloudinary: isCloudinaryConfigured ? streamToCloudinary : null,
};
