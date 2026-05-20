// src/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadController = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');
const { validateUpload } = require('../validators/uploadValidator');

const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Configure multer
const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    cb(null, 'req-' + uniqueSuffix + path.extname(file.originalname || '.jpg'));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 4 // Max 4 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Routes
router.post(
  '/',
  protect,
  upload.array('photos', 4),
  validateUpload,
  uploadController.createReport
);

router.get('/my-markers', protect, uploadController.getUserMarkers);
router.post('/:id/request-delete', protect, uploadController.requestDeleteReport);
router.delete('/:id', protect, uploadController.deleteReport);

module.exports = router;

