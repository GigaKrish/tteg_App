// backend/models/Report.js
const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // --- NEW FIELDS ---
  state: { type: String, required: true },
  city: { type: String, required: true },
  district: { type: String, required: true },
  cameraType: { 
    type: String, 
    required: true,
    enum: ['PTZ Camera', 'Bullet Camera', 'UHD Camera', 'Dome Camera']
  },
  resourceId: { type: String, required: true },
  remark: { type: String, default: '' },

  // --- Store Array of Photo URLs/Metadata ---
  photos: {
    type: [String],
    required: true,
    validate: [val => val.length <= 4, 'Max 4 photos allowed']
  },
  thumbnails: {
    type: [String], // Store paths/URLs to 90x90 thumbnails
    default: []
  },

  // Primary location (Geotron if available, else Phone)
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    readableAddress: { type: String },
  },

  // GPS metadata
  accuracy: { type: Number }, // In meters, from Geotron if available

  geotronLocations: { type: Object, default: {} },

  unique_id: { type: String, required: true, unique: true }, // 5 digit unique ID

  // --- SOFT DELETION QUARANTINE ---
  deleteRequested: { type: Boolean, default: false },
  deleteReason: { type: String, default: null },

  // --- DEVICE INFO ---
  deviceInfo: {
    os: { type: String, default: null },              // "Android" or "iOS"
    osVersion: { type: String, default: null },       // e.g. "14", "17.2"
    manufacturer: { type: String, default: null },    // e.g. "Samsung", "Xiaomi", "Apple"
    brand: { type: String, default: null },           // e.g. "Galaxy", "Redmi"
    modelName: { type: String, default: null },       // e.g. "SM-A525F"
    deviceName: { type: String, default: null },      // e.g. "John's Phone"
  },

}, { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// --- PERFORMANCE INDEXES ---
reportSchema.index({ userId: 1, createdAt: -1 }); // Optimizes /my-markers queries

// Static method to generate 5 digit unique id
reportSchema.statics.generateUniqueId = async function () {
  let unique = false;
  let newId;
  while (!unique) {
    newId = Math.floor(10000 + Math.random() * 90000).toString();
    const exists = await this.findOne({ unique_id: newId });
    if (!exists) {
      unique = true;
    }
  }
  return newId;
};

// Hook to auto-generate unique_id before saving if not present
reportSchema.pre('validate', async function() {
  if (!this.unique_id) {
    this.unique_id = await this.constructor.generateUniqueId();
  }
});

module.exports = mongoose.model("Report", reportSchema);


