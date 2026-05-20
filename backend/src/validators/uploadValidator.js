// src/validators/uploadValidator.js
const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Clean up multer temp files since we're rejecting this request
    if (req.files && Array.isArray(req.files)) {
      const fs = require('fs');
      for (const file of req.files) {
        if (file.path) fs.unlink(file.path, () => {});
      }
    }
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => err.msg)
    });
  }
  next();
};

exports.validateUpload = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('phoneLatitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid phone latitude'),
  body('phoneLongitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid phone longitude'),
  body('readableAddress')
    .optional()
    .trim(),
  handleValidationErrors
];

