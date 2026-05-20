// src/controllers/uploadController.js
const fs = require('fs');
const Report = require('../models/Report');
const azureService = require('../services/azureService');
const { logUpload } = require('../utils/logger');

// Helper: clean up multer temp files on early exit / error
function cleanupTempFiles(files) {
  if (!files || !Array.isArray(files)) return;
  for (const file of files) {
    if (file.path) {
      fs.unlink(file.path, () => {}); // fire-and-forget
    }
  }
}

exports.createReport = async (req, res, next) => {
  try {
    const {
      latitude,
      longitude,
      readableAddress,
      state,
      city,
      district,
      cameraType,
      resourceId,
      remark,
      geotronLocations,
      accuracy,
      deviceInfo
    } = req.body;

    // Validate required files
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }
    if (req.files.length > 4) {
      cleanupTempFiles(req.files);
      return res.status(400).json({ error: 'Maximum 4 photos allowed per report' });
    }

    // Parse geotron locations
    let parsedGeotrons = {};
    if (geotronLocations) {
      try {
        parsedGeotrons = typeof geotronLocations === 'string' ? JSON.parse(geotronLocations) : geotronLocations;
      } catch (e) {
        cleanupTempFiles(req.files);
        return res.status(400).json({ error: 'Invalid geotron data format' });
      }
    }

    // Parse accuracy
    const accuracyValue = accuracy ? parseFloat(accuracy) : null;

    // Generate unique ID for this report before uploading photos
    // This allows us to group photos by report ID in storage
    const reportUniqueId = await Report.generateUniqueId();

    // Upload photos to Azure with GPS EXIF data and watermark
    const uploadResults = await azureService.uploadPhotosWithGPS(
      req.files,
      parseFloat(latitude),
      parseFloat(longitude),
      req.userId,
      {
        accuracy: accuracyValue,
        gpsSource: 'geotron',
        timestamp: new Date().toISOString(), // Trust ONLY server time
        state,
        city,
        district,
        cameraType,
        resourceId,
        remark,
        reportId: reportUniqueId // Pass ID to storage service
      }
    );

    const photoUrls = uploadResults.map(r => r.photoUrl);
    const thumbnailUrls = uploadResults.map(r => r.thumbnailUrl);

    // Parse device info
    let parsedDeviceInfo = null;
    if (deviceInfo) {
      try {
        parsedDeviceInfo = typeof deviceInfo === 'string' ? JSON.parse(deviceInfo) : deviceInfo;
      } catch (e) {
        console.warn('Could not parse deviceInfo:', e);
      }
    }

    // Create report document
    const report = new Report({
      userId: req.userId,
      photos: photoUrls,
      thumbnails: thumbnailUrls,
      state,
      city,
      district,
      cameraType,
      resourceId,
      remark,
      location: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        readableAddress: readableAddress || ''
      },
      accuracy: accuracyValue,
      geotronLocations: parsedGeotrons,
      deviceInfo: parsedDeviceInfo,
      unique_id: reportUniqueId
    });

    try {
      await report.save();
    } catch (reportErr) {
      console.error('Report save failed, rolling back:', reportErr.message);
      try {
        await azureService.deletePhotos([...photoUrls, ...thumbnailUrls]);
      } catch (cleanupErr) {
        console.error('Azure rollback failed:', cleanupErr.message);
      }
      throw reportErr;
    }

    // Ping geotron calibration
    try {
      await fetch('https://transteg.deepgazetech.com/geotron/calibrate', { method: 'GET' });
    } catch (e) {
      console.warn('Calibration ping failed:', e.message);
    }

    logUpload(req.userId, report.unique_id, 'SUCCESS', req.files.length);

    res.status(201).json({
      success: true,
      report: report
    });
  } catch (error) {
    cleanupTempFiles(req.files); // Ensure temp files are always cleaned up
    console.error('Error creating report:', error);
    let friendlyError = error.message;
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      friendlyError = "Validation Failed: " + messages.join(', ');
    }
    logUpload(req.userId, null, 'FAILED', req.files ? req.files.length : 0, friendlyError);
    res.status(500).json({ error: 'Failed to create report', details: friendlyError });
  }
};

exports.getUserMarkers = async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const filter = { userId: req.userId, deleteRequested: { $ne: true } };

    const total = await Report.countDocuments(filter);
    const markers = await Report.find(filter)
      .select('location createdAt photos thumbnails readableAddress state city district cameraType resourceId remark accuracy unique_id geotronLocations')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    res.json({
      data: markers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total,
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.requestDeleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Deletion reason is required' });
    }

    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to request deletion for this report' });
    }

    report.deleteRequested = true;
    report.deleteReason = reason.trim();
    await report.save();

    res.json({
      success: true,
      message: 'Deletion requested successfully. Pending admin review.'
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to delete this report' });
    }

    const filesToDelete = [...(report.photos || []), ...(report.thumbnails || [])];
    await azureService.deletePhotos(filesToDelete);

    await Report.deleteOne({ _id: id });

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

