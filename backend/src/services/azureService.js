/* global Buffer */
// src/services/azureService.js
const { getContainerClient, isUsingLocalStorage, getLocalUploadDir } = require('../config/azure');
const sharp = require('sharp');
const piexif = require('piexifjs');
const path = require('path');
const fs = require('fs');

// Input validation helpers
function validateGpsCoordinates(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new Error('GPS coordinates must be numbers');
  }
  if (lat < -90 || lat > 90) {
    throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90`);
  }
  if (lng < -180 || lng > 180) {
    throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180`);
  }
}

function validateFile(file) {
  if (!file || (!file.buffer && !file.path)) {
    throw new Error('Invalid file object: missing buffer or path');
  }

  // Check file size (max 25MB) - if diskStorage, size is in file.size
  const size = file.size || (file.buffer ? file.buffer.length : 0);
  const maxSize = 25 * 1024 * 1024;
  if (size > maxSize) {
    throw new Error(`File too large: ${(size / 1024 / 1024).toFixed(2)}MB. Max: 25MB`);
  }

  if (file.originalname && !/\.(jpe?g|png|gif|webp)$/i.test(file.originalname)) {
    console.warn(`Potentially unsupported file type: ${file.originalname}`);
  }
}

// GPS Helper Functions
function toRational(n) {
  const r = [0, 1];
  if (!n) return r;
  const m = Math.round(n * 1e6);
  return [m, 1e6];
}

function getGpsData(lat, lng) {
  const la = Math.abs(lat);
  const ln = Math.abs(lng);
  return {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: [
      toRational(Math.floor(la)),
      toRational(Math.floor((la - Math.floor(la)) * 60)),
      toRational((la - Math.floor(la) - Math.floor((la - Math.floor(la)) * 60) / 60) * 3600)
    ],
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: [
      toRational(Math.floor(ln)),
      toRational(Math.floor((ln - Math.floor(ln)) * 60)),
      toRational((ln - Math.floor(ln) - Math.floor((ln - Math.floor(ln)) * 60) / 60) * 3600)
    ]
  };
}

function createWatermarkSvg(width, height, metadata) {
  const { latitude, longitude, accuracy, gpsSource, timestamp } = metadata;

  // Format values
  const latStr = latitude != null ? String(latitude) : 'N/A';
  const lngStr = longitude != null ? String(longitude) : 'N/A';
  const accStr = accuracy != null ? `${(accuracy * 100).toFixed(2)}cm` : 'N/A';
  const sourceStr = gpsSource === 'geotron' ? 'Geotron' : 'Phone';
  const timeStr = timestamp ? new Date(timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }) : 'N/A';

  // ── Responsive sizing: scale watermark to ~55% of image width, capped ──
  const scale = Math.min(width / 1920, 1);           // 1.0 at 1920px, 0.625 at 1200px, etc.
  const fontSize = Math.max(Math.round(40 * scale), 18); // Min 18px font
  const lineHeight = Math.round(fontSize * 1.8);
  const padding = Math.round(40 * scale);
  const innerPad = Math.round(30 * scale);

  const boxWidth = Math.min(Math.round(1120 * scale), width - padding * 2);
  const boxHeight = lineHeight * 3 + innerPad * 2;    // 3 rows of text + vertical padding
  const cornerRadius = Math.round(16 * scale);

  // Position: bottom-right, clamped so it stays fully inside the image
  const x = Math.max(padding, width - boxWidth - padding);
  const y = Math.max(padding, height - boxHeight - padding);

  // Column offsets (proportional to box width)
  const col1 = x + innerPad;
  const col1Val = col1 + Math.round(boxWidth * 0.11);
  const col2 = x + Math.round(boxWidth * 0.50);
  const col2Val = col2 + Math.round(boxWidth * 0.12);

  const row1 = y + innerPad + fontSize;
  const row2 = row1 + lineHeight;
  const row3 = row2 + lineHeight;

  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <style>
          .wm-val { fill: white; font-family: Arial, sans-serif; font-size: ${fontSize}px; font-weight: bold; }
          .wm-lbl { fill: rgba(255,255,255,0.85); font-family: Arial, sans-serif; font-size: ${fontSize}px; font-weight: bold; }
        </style>
      </defs>
      <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${cornerRadius}" ry="${cornerRadius}" fill="rgba(0,0,0,0.65)"/>
      <text x="${col1}" y="${row1}" class="wm-lbl">Lat:</text>
      <text x="${col1Val}" y="${row1}" class="wm-val">${latStr}</text>
      <text x="${col2}" y="${row1}" class="wm-lbl">Long:</text>
      <text x="${col2Val}" y="${row1}" class="wm-val">${lngStr}</text>
      <text x="${col1}" y="${row2}" class="wm-lbl">Acc:</text>
      <text x="${col1Val}" y="${row2}" class="wm-val">${accStr}</text>
      <text x="${col2}" y="${row2}" class="wm-lbl">GPS:</text>
      <text x="${col2Val}" y="${row2}" class="wm-val">${sourceStr}</text>
      <text x="${col1}" y="${row3}" class="wm-lbl">Time:</text>
      <text x="${col1Val}" y="${row3}" class="wm-val">${timeStr}</text>
    </svg>
  `;

  return Buffer.from(svg);
}

async function processImage(fileBuffer, latitude, longitude, metadata = {}) {
  try {
    const originalInfo = await sharp(fileBuffer).metadata();
    const originalWidth = originalInfo.width || 1200;
    
    const resizeWidth = Math.min(originalWidth, 1920);
    const resizedImage = await sharp(fileBuffer)
      .resize({ width: resizeWidth, withoutEnlargement: true })
      .toBuffer({ resolveWithObject: true });

    const resizedWidth = resizedImage.info.width;
    const resizedHeight = resizedImage.info.height;

    const watermarkSvg = createWatermarkSvg(resizedWidth, resizedHeight, {
      latitude,
      longitude,
      accuracy: metadata.accuracy,
      gpsSource: metadata.gpsSource || 'phone',
      timestamp: metadata.timestamp || new Date().toISOString()
    });

    const compressedBuffer = await sharp(resizedImage.data)
      .composite([{
        input: watermarkSvg,
        top: 0,
        left: 0
      }])
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    let fileBinary = compressedBuffer.toString('binary');
    const gps = getGpsData(latitude, longitude);
    const exifObj = { '0th': {}, 'Exif': {}, 'GPS': gps };
    
    // Embed custom metadata to EXIF UserComment if needed
    if (metadata.cameraType || metadata.resourceId) {
       const userCommentText = JSON.stringify({
          cameraType: metadata.cameraType,
          resourceId: metadata.resourceId,
          remark: metadata.remark
       });
       exifObj['Exif'][piexif.ExifIFD.UserComment] = [...Buffer.from(userCommentText)];
    }

    const exifBytes = piexif.dump(exifObj);
    const newFileBinary = piexif.insert(exifBytes, fileBinary);
    return Buffer.from(newFileBinary, 'binary');
  } catch (error) {
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

async function createThumbnail(fileBuffer) {
  try {
    return await sharp(fileBuffer)
      .resize(90, 90, { fit: 'cover' })
      .jpeg({ quality: 60 })
      .toBuffer();
  } catch (error) {
    throw new Error(`Thumbnail processing failed: ${error.message}`);
  }
}

async function uploadToLocal(files, latitude, longitude, userId, metadata = {}) {
  const localDir = getLocalUploadDir();
  const results = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    validateFile(file);
    validateGpsCoordinates(latitude, longitude);

    const fileBuffer = file.path ? await fs.promises.readFile(file.path) : file.buffer;
    
    const mainBuffer = await processImage(fileBuffer, latitude, longitude, metadata);
    const thumbBuffer = await createThumbnail(fileBuffer);
    
    // cleanup
    if (file.path) await fs.promises.unlink(file.path).catch(() => {});
    file.buffer = null;

    const timestamp = Date.now();
    const reportFolder = metadata.reportId ? `RPT_${metadata.reportId}` : `RPT_UNKNOWN_${timestamp}`;
    const folderPath = path.join(localDir, String(userId), reportFolder);
    
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const mainName = `photo_${index}.jpg`;
    const thumbName = `thumb_${index}.jpg`;
    
    const mainPath = path.join(folderPath, mainName);
    const thumbPath = path.join(folderPath, thumbName);

    fs.writeFileSync(mainPath, mainBuffer);
    fs.writeFileSync(thumbPath, thumbBuffer);

    results.push({
      photoUrl: `file://${mainPath.replace(/\\/g, '/')}`,
      thumbnailUrl: `file://${thumbPath.replace(/\\/g, '/')}`
    });
  }

  return results;
}

async function uploadToAzure(files, latitude, longitude, userId, metadata = {}) {
  const containerClient = getContainerClient();

  await containerClient.createIfNotExists({
    access: 'blob'
  });

  const results = [];

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    validateFile(file);
    validateGpsCoordinates(latitude, longitude);

    const fileBuffer = file.path ? await fs.promises.readFile(file.path) : file.buffer;

    const mainBuffer = await processImage(fileBuffer, latitude, longitude, metadata);
    const thumbBuffer = await createThumbnail(fileBuffer);
    
    // cleanup
    if (file.path) await fs.promises.unlink(file.path).catch(() => {});
    file.buffer = null;

    const timestamp = Date.now();
    const reportFolder = metadata.reportId ? `RPT_${metadata.reportId}` : `RPT_UNKNOWN_${timestamp}`;
    const folderPath = `${String(userId)}/${reportFolder}`;
    
    const mainName = `${folderPath}/photo_${index}.jpg`;
    const thumbName = `${folderPath}/thumb_${index}.jpg`;

    const mainBlobClient = containerClient.getBlockBlobClient(mainName);
    await mainBlobClient.uploadData(mainBuffer, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' }
    });

    const thumbBlobClient = containerClient.getBlockBlobClient(thumbName);
    await thumbBlobClient.uploadData(thumbBuffer, {
      blobHTTPHeaders: { blobContentType: 'image/jpeg' }
    });

    results.push({
      photoUrl: mainBlobClient.url,
      thumbnailUrl: thumbBlobClient.url
    });
  }

  return results;
}

exports.uploadPhotosWithGPS = async (files, latitude, longitude, userId, metadata = {}) => {
  if (!files || !Array.isArray(files) || files.length === 0) {
    throw new Error('No files provided for upload');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  validateGpsCoordinates(latitude, longitude);

  if (isUsingLocalStorage()) {
    return await uploadToLocal(files, latitude, longitude, userId, metadata);
  }
  return await uploadToAzure(files, latitude, longitude, userId, metadata);
};

exports.deletePhotos = async (photoUrls) => {
  if (isUsingLocalStorage()) {
    photoUrls.forEach((url) => {
      try {
        const filePath = url.replace('file://', '');
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (error) {
        console.error(`Failed to delete local file: ${url}`, error);
      }
    });
    return;
  }

  const containerClient = getContainerClient();
  const deletePromises = photoUrls.map(async (url) => {
    try {
      const urlParts = url.split('/');
      const containerIndex = urlParts.indexOf(process.env.AZURE_STORAGE_CONTAINER_NAME || 'tteg-uploads');
      if (containerIndex !== -1) {
         const blobName = urlParts.slice(containerIndex + 1).join('/');
         const blockBlobClient = containerClient.getBlockBlobClient(blobName);
         await blockBlobClient.deleteIfExists();
      }
    } catch (error) {
      console.error(`Failed to delete photo: ${url}`, error);
    }
  });

  await Promise.all(deletePromises);
};

