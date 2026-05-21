// services/uploadQueue/queueManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { reportApi } from '../api/reportApi';

export interface QueuedUpload {
  id: string;
  timestamp: number;
  formData: any;
  photos: string[];
  metadata: {
    selectedProperty?: any;
  };
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  lastAttemptTime?: number;
}

const QUEUE_STORAGE_KEY = '@upload_queue';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 12000]; // 3s, 6s, 12s
const MAX_QUEUE_SIZE = 20; // Prevent unbounded queue growth
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — photo URIs become stale after this

class UploadQueueManager {
  private queue: QueuedUpload[] = [];
  private isProcessing = false;
  private listeners: ((queue: QueuedUpload[]) => void)[] = [];
  private successCallbacks: (() => void)[] = [];

  constructor() {
    this.loadQueue();
  }

  async loadQueue() {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Reset any stuck 'uploading' status to 'pending' on app restart
        this.queue.forEach(u => {
          if (u.status === 'uploading') u.status = 'pending';
        });
        // Purge entries older than TTL (photo URIs are likely stale)
        const now = Date.now();
        const before = this.queue.length;
        const staleEntries = this.queue.filter(u => now - u.timestamp >= QUEUE_TTL_MS);
        this.queue = this.queue.filter(u => now - u.timestamp < QUEUE_TTL_MS);

        if (staleEntries.length > 0) {
          console.log(`[Queue] Purged ${staleEntries.length} stale entries (>24h old)`);

          // Garbage collect stale photo chunks
          for (const entry of staleEntries) {
            for (const uri of entry.photos) {
              try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
              } catch (e) { }
            }
          }
        }
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  }

  async saveQueue() {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save queue:', error);
    }
  }

  // SIMPLIFIED: Direct upload without timeout - let the actual request handle its own timing
  async tryDirectUploadOrQueue(
    upload: Omit<QueuedUpload, 'id' | 'timestamp' | 'status' | 'attempts' | 'maxAttempts'>,
    signal?: AbortSignal
  ): Promise<{ success: boolean; uploadId: string; error?: string }> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      console.log(`[Queue] Starting direct upload: ${uploadId}`);

      const formData = {
        photoUris: upload.photos,
        geotronData: upload.formData.geotronData || '{}',
        roleMap: upload.formData.roleMap,
        surveyData: upload.formData.surveyData,
      };

      // Direct upload - no artificial timeout, let network handle it
      const result = await reportApi.uploadReport(formData, signal);

      if (result && result.success) {
        console.log(`[Queue] ✅ Direct upload successful: ${uploadId}`);
        return { success: true, uploadId };
      } else {
        throw new Error('Server returned failure');
      }

    } catch (error: any) {
      console.log(`[Queue] ❌ Direct upload failed: ${error.message}`);
      
      // Do not queue if the request was cancelled by the user
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log(`[Queue] Upload cancelled by user: ${uploadId}`);
        return { success: false, uploadId, error: 'Upload cancelled by user' };
      }

      // Only queue for network/server errors, not validation errors
      if (this.isRetryableError(error)) {
        // Enforce max queue size to prevent unbounded growth
        if (this.queue.length >= MAX_QUEUE_SIZE) {
          console.log(`[Queue] Queue full (${MAX_QUEUE_SIZE}), dropping upload`);
          return { success: false, uploadId, error: `Queue full (max ${MAX_QUEUE_SIZE}). Clear failed uploads first.` };
        }

        const queuedUpload: QueuedUpload = {
          ...upload,
          id: uploadId,
          timestamp: Date.now(),
          status: 'pending',
          attempts: 0,
          maxAttempts: MAX_RETRIES,
          lastError: error.message,
        };

        this.queue.push(queuedUpload);
        await this.saveQueue();

        // Process queue in background
        this.processQueueInBackground();

        return { success: false, uploadId, error: error.message };
      } else {
        // Non-retryable error (like validation), don't queue
        return { success: false, uploadId, error: error.message };
      }
    }
  }

  // Process queue without blocking
  private processQueueInBackground() {
    if (this.isProcessing) return;

    // Use setTimeout to not block the main thread
    setTimeout(() => this.processQueue(), 100);
  }

  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    console.log('[Queue] Processing queue...');

    while (true) {
      const nextUpload = this.queue.find(u => u.status === 'pending' || u.status === 'retrying');
      if (!nextUpload) break;
      await this.processUpload(nextUpload);
    }

    this.isProcessing = false;
    console.log('[Queue] Queue processing complete');
  }

  private async processUpload(upload: QueuedUpload) {
    // Use a loop instead of recursion to avoid stack overflow on retries
    while (true) {
      upload.status = 'uploading';
      upload.attempts++;
      upload.lastAttemptTime = Date.now();
      await this.saveQueue();

      console.log(`[Queue] Processing upload ${upload.id}, attempt ${upload.attempts}/${upload.maxAttempts}`);

      try {
        const formData = {
          photoUris: upload.photos,
          geotronData: upload.formData.geotronData || '{}',
          roleMap: upload.formData.roleMap,
          surveyData: upload.formData.surveyData,
        };

        const result = await reportApi.uploadReport(formData);

        if (result && result.success) {
          console.log(`[Queue] ✅ Upload successful: ${upload.id}`);
          // Remove from queue on success
          this.queue = this.queue.filter(u => u.id !== upload.id);
          await this.saveQueue();

          // Garbage collect uploaded photos to prevent out-of-storage crash
          for (const uri of upload.photos) {
            try {
              await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch (e) {
              console.log(`[Queue] Failed to purge photo URI: ${uri}`, e);
            }
          }

          this.notifySuccess();
          return; // Done — exit loop
        } else {
          throw new Error('Server returned failure');
        }

      } catch (error: any) {
        console.log(`[Queue] ❌ Upload failed: ${error.message}`);
        upload.lastError = error.message;

        if (upload.attempts < upload.maxAttempts && this.isRetryableError(error)) {
          upload.status = 'retrying';
          await this.saveQueue();

          const delay = RETRY_DELAYS[upload.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.log(`[Queue] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Loop back for retry instead of recursing
        } else {
          upload.status = 'failed';
          await this.saveQueue();
          console.log(`[Queue] Upload permanently failed: ${upload.id}`);
          return; // Done — exit loop
        }
      }
    }
  }

  private isRetryableError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || '';
    // Network errors are retryable
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) return true;
    // Server errors are retryable
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
    // Connection errors
    if (msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('econnreset')) return true;
    // Azure errors
    if (msg.includes('azure') || msg.includes('blob')) return true;
    return false;
  }

  // Retry specific upload
  async retryUpload(uploadId: string) {
    const upload = this.queue.find(u => u.id === uploadId);
    if (!upload) throw new Error('Upload not found in queue');
    if (upload.status === 'uploading') throw new Error('Upload already in progress');

    upload.attempts = 0;
    upload.status = 'pending';
    await this.saveQueue();

    this.processQueueInBackground();
  }

  async removeFromQueue(uploadId: string) {
    this.queue = this.queue.filter(u => u.id !== uploadId);
    await this.saveQueue();
  }

  getQueue(): QueuedUpload[] {
    return [...this.queue];
  }

  getPendingCount(): number {
    return this.queue.filter(u =>
      u.status === 'pending' || u.status === 'retrying' || u.status === 'uploading'
    ).length;
  }

  getFailedUploads(): QueuedUpload[] {
    return this.queue.filter(u => u.status === 'failed');
  }

  subscribe(listener: (queue: QueuedUpload[]) => void) {
    this.listeners.push(listener);
    listener(this.queue);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Subscribe to successful uploads (for refreshing markers)
  onUploadSuccess(callback: () => void) {
    this.successCallbacks.push(callback);
    return () => {
      this.successCallbacks = this.successCallbacks.filter(c => c !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.queue));
  }

  private notifySuccess() {
    this.successCallbacks.forEach(callback => callback());
  }

  async clearFailedUploads() {
    this.queue = this.queue.filter(u => u.status !== 'failed');
    await this.saveQueue();
  }

  async retryAllFailed() {
    const failed = this.getFailedUploads();
    for (const upload of failed) {
      upload.attempts = 0;
      upload.status = 'pending';
    }
    await this.saveQueue();
    this.processQueueInBackground();
  }
}

export const uploadQueue = new UploadQueueManager();
