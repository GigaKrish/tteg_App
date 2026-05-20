import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BaseModal } from './ui/BaseModal';
import { uploadQueue, QueuedUpload } from '../services/uploadQueue/queueManager';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function UploadQueueModal({ visible, onClose }: Props) {
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = uploadQueue.subscribe((newQueue) => {
      setQueue(newQueue);
    });
    return unsubscribe;
  }, []);

  // Calculate stats from queue
  const stats = {
    pending: queue.filter(u => u.status === 'pending' || u.status === 'retrying').length,
    uploading: queue.filter(u => u.status === 'uploading').length,
    failed: queue.filter(u => u.status === 'failed').length,
    total: queue.length,
  };

  const handleRetry = async (uploadId: string) => {
    try {
      await uploadQueue.retryUpload(uploadId);
      Alert.alert('Success', 'Upload queued for retry');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRemove = (uploadId: string) => {
    Alert.alert(
      'Remove Upload',
      'Are you sure you want to remove this upload from the queue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => uploadQueue.removeFromQueue(uploadId),
        },
      ]
    );
  };

  const handleRetryAll = async () => {
    const failed = uploadQueue.getFailedUploads();
    if (failed.length === 0) {
      Alert.alert('No Failed Uploads', 'There are no failed uploads to retry');
      return;
    }

    Alert.alert(
      'Retry All Failed',
      `Retry ${failed.length} failed upload(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Retry All',
          onPress: async () => {
            await uploadQueue.retryAllFailed();
            Alert.alert('Success', 'All failed uploads queued for retry');
          },
        },
      ]
    );
  };

  const handleClearFailed = async () => {
    const failed = uploadQueue.getFailedUploads();
    if (failed.length === 0) {
      Alert.alert('No Failed Uploads', 'There are no failed uploads to clear');
      return;
    }

    Alert.alert(
      'Clear Failed Uploads',
      `Remove ${failed.length} failed upload(s) from queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await uploadQueue.clearFailedUploads();
            Alert.alert('Success', 'Failed uploads cleared');
          },
        },
      ]
    );
  };

  const getStatusColor = (status: QueuedUpload['status']) => {
    switch (status) {
      case 'success':
        return '#4CAF50';
      case 'uploading':
        return '#2196F3';
      case 'pending':
        return '#FF9800';
      case 'retrying':
        return '#FFC107';
      case 'failed':
        return '#999'; // Grey for failed
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: QueuedUpload['status']) => {
    switch (status) {
      case 'success':
        return 'checkmark-circle';
      case 'uploading':
        return 'cloud-upload';
      case 'pending':
        return 'time';
      case 'retrying':
        return 'refresh';
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const renderUpload = (upload: QueuedUpload) => {
    const isExpanded = expandedId === upload.id;
    const statusColor = getStatusColor(upload.status);

    return (
      <View key={upload.id} style={styles.uploadCard}>
        <Pressable
          style={styles.uploadHeader}
          onPress={() => setExpandedId(isExpanded ? null : upload.id)}
        >
          <View style={styles.uploadHeaderLeft}>
            <Ionicons
              name={getStatusIcon(upload.status) as any}
              size={24}
              color={statusColor}
            />
            <View style={styles.uploadInfo}>
              <Text style={styles.uploadTitle}>
                Upload — {upload.photos.length} photo(s)
              </Text>
              <Text style={styles.uploadSubtitle}>
                Queued: {new Date(upload.timestamp).toLocaleTimeString()}
              </Text>
              <Text style={[styles.uploadStatus, { color: statusColor }]}>
                {upload.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.uploadHeaderRight}>
            <Text style={styles.uploadAttempts}>
              {upload.attempts}/{upload.maxAttempts}
            </Text>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#666"
            />
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.uploadDetails}>
            <Text style={styles.detailText}>
              Photos: {upload.photos.length}
            </Text>
            <Text style={styles.detailText}>
              Queued: {new Date(upload.timestamp).toLocaleString()}
            </Text>
            {upload.lastAttemptTime && (
              <Text style={styles.detailText}>
                Last Attempt: {new Date(upload.lastAttemptTime).toLocaleString()}
              </Text>
            )}
            {upload.lastError && (
              <Text style={styles.errorText}>
                Error: {upload.lastError}
              </Text>
            )}

            <View style={styles.actionButtons}>
              {upload.status === 'failed' && (
                <>
                  <Pressable
                    style={[styles.actionBtn, styles.retryBtn]}
                    onPress={() => handleRetry(upload.id)}
                  >
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Retry</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.removeBtn]}
                    onPress={() => handleRemove(upload.id)}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Remove</Text>
                  </Pressable>
                </>
              )}
              {upload.status === 'success' && (
                <Pressable
                  style={[styles.actionBtn, styles.removeBtn]}
                  onPress={() => handleRemove(upload.id)}
                >
                  <Ionicons name="trash" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Clear</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const pendingCount = queue.filter(u => u.status === 'pending' || u.status === 'uploading').length;
  const failedCount = queue.filter(u => u.status === 'failed').length;
  const successCount = queue.filter(u => u.status === 'success').length;

  return (
    <BaseModal
      visible={visible}
      onClose={onClose}
      title="Upload Queue"
      position="bottom"
      maxHeight="90%"
      contentStyle={{ minHeight: '60%' }}
    >

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{successCount}</Text>
          <Text style={styles.statLabel}>Success</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#999' }]}>{failedCount}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </View>

      {/* Action Buttons */}
      {failedCount > 0 && (
        <View style={styles.globalActions}>
          <Pressable style={styles.globalActionBtn} onPress={handleRetryAll}>
            <Ionicons name="refresh-circle" size={20} color="#2196F3" />
            <Text style={styles.globalActionText}>Retry All Failed</Text>
          </Pressable>
          <Pressable style={styles.globalActionBtn} onPress={handleClearFailed}>
            <Ionicons name="trash" size={20} color="#F44336" />
            <Text style={styles.globalActionText}>Clear Failed</Text>
          </Pressable>
        </View>
      )}

      {/* Upload List */}
      <ScrollView style={styles.uploadList}>
        {queue.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cloud-done" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No uploads in queue</Text>
          </View>
        ) : (
          queue.map(renderUpload)
        )}
      </ScrollView>
    </BaseModal>
  );
}

const styles = StyleSheet.create({
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF9800',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  globalActions: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  globalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    gap: 8,
  },
  globalActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  uploadList: {
    flex: 1,
    padding: 16,
  },
  uploadCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    overflow: 'hidden',
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  uploadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  uploadInfo: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  uploadSubtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  uploadStatus: {
    fontSize: 11,
    fontWeight: '700',
  },
  uploadHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadAttempts: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  uploadDetails: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 8,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 6,
    gap: 6,
  },
  retryBtn: {
    backgroundColor: '#2196F3',
  },
  removeBtn: {
    backgroundColor: '#F44336',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});

