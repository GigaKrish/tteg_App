// src/config/azure.js
const { BlobServiceClient } = require('@azure/storage-blob');
const path = require('path');
const fs = require('fs');

let blobServiceClient = null;
let containerClient = null;
let isLocalMode = false;

// Local storage directory for development
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../../test_upload');

const initializeAzure = () => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'tteg-uploads';

  if (!connectionString) {
    // Local mode - no Azure
    isLocalMode = true;
    console.log('⚠️  Azure not configured - using local file storage (test_upload/)');

    // Create local upload directory if not exists
    if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
      fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    }
    return;
  }

  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);

  console.log('✓ Azure Storage client initialized');
};

const getBlobServiceClient = () => {
  if (!blobServiceClient && !isLocalMode) {
    initializeAzure();
  }
  return blobServiceClient;
};

const getContainerClient = () => {
  if (!containerClient && !isLocalMode) {
    initializeAzure();
  }
  return containerClient;
};

const isUsingLocalStorage = () => {
  if (blobServiceClient === null && !isLocalMode) {
    initializeAzure();
  }
  return isLocalMode;
};

const getLocalUploadDir = () => LOCAL_UPLOAD_DIR;

module.exports = {
  getBlobServiceClient,
  getContainerClient,
  initializeAzure,
  isUsingLocalStorage,
  getLocalUploadDir
};

