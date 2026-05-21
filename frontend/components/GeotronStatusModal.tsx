import React from 'react';
import { View, Text, Modal, StyleSheet, ScrollView, Pressable, TouchableOpacity, Animated, Easing } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { truncCoord } from '../utils/formatters';
import type { GeotronData } from '../types/models.types';
import { normalizeGeotronAssignments } from '../utils/formatters';

interface GeotronStatusModalProps {
  visible: boolean;
  onClose: () => void;
  data: GeotronData;
  assignedGeotrons?: any[];
  roleMap?: Record<string, string>;
  onDeviceLocate?: (deviceId: string) => void;
  onRefresh?: () => Promise<void>;
}

export default function GeotronStatusModal({
  visible,
  onClose,
  data,
  assignedGeotrons = [],
  roleMap = {},
  onDeviceLocate,
  onRefresh,
}: GeotronStatusModalProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const spinValue = React.useRef(new Animated.Value(0)).current;

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);

    // Start infinite spin animation
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    await onRefresh();

    // Stop spin and reset
    spinValue.stopAnimation();
    spinValue.setValue(0);
    setIsRefreshing(false);
  };

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  // Use assigned list as source of truth, fall back to active data keys
  const normalizedAssignments = normalizeGeotronAssignments(assignedGeotrons);
  const deviceIds = normalizedAssignments.length > 0
    ? normalizedAssignments.map(a => a.geotronName)
    : Object.keys(data);

  return (
    <Modal animationType="slide" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.centeredView}>
        <View style={styles.modalView}>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={styles.modalTitle}>Hardware Status</Text>
              {onRefresh && (
                <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing} style={{ padding: 6 }} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={22} color={isRefreshing ? "#94a3b8" : "#3b82f6"} />
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={24} color="#333" />
            </Pressable>
          </View>

          <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
            {deviceIds.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="hardware-chip-outline" size={40} color="#cbd5e1" />
                <Text style={styles.emptyText}>No Geotrons Assigned</Text>
                <Text style={styles.emptySubText}>Contact admin for device assignment</Text>
              </View>
            ) : (
              deviceIds.map((id, index) => {
                const dev = data[id];
                const isActive = dev && (dev.fix_type ?? 0) > 0;
                const isGoodFix = (dev?.fix_type ?? 0) >= 3;
                const hasLocation = dev && dev.latitude && dev.longitude;

                return (
                  <Pressable
                    key={id || `device-${index}`}
                    style={styles.deviceCard}
                    onPress={() => {
                      if (hasLocation && onDeviceLocate) {
                        onDeviceLocate(id);
                        onClose();
                      }
                    }}
                  >
                    {/* Device Header Row with ON/OFF indicator */}
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                        <MaterialIcons name="router" size={20} color="#1e3a8a" />
                        <Text style={styles.deviceId}>{id}</Text>
                        {roleMap[id] ? (
                          <View style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#3730a3' }}>{roleMap[id]}</Text>
                          </View>
                        ) : null}
                      </View>

                      {/* ON/OFF Indicator */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {hasLocation && (
                          <Ionicons name="navigate" size={14} color="#3b82f6" />
                        )}
                        <Text style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: isActive ? '#22c55e' : '#ef4444'
                        }}>
                          {isActive ? 'ON' : 'OFF'}
                        </Text>
                        <View style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: isActive ? '#22c55e' : '#ef4444'
                        }} />
                      </View>
                    </View>

                    {/* Detailed Stats (only show when device has data) */}
                    {dev ? (
                      <>
                        {/* Fix quality badge */}
                        <View style={{ marginBottom: 10 }}>
                          <View style={[styles.badge, { backgroundColor: isGoodFix ? '#dcfce7' : '#fee2e2', alignSelf: 'flex-start' }]}>
                            <Text style={[styles.badgeText, { color: isGoodFix ? '#166534' : '#991b1b' }]}>
                              {isGoodFix ? 'ONLINE' : 'WEAK SIGNAL'}
                            </Text>
                          </View>
                        </View>

                        {/* Stats Grid */}
                        <View style={styles.statsGrid}>
                          <StatItem label="Latitude" value={truncCoord(dev.latitude)} />
                          <StatItem label="Longitude" value={truncCoord(dev.longitude)} />
                          <StatItem
                            label="Control Value"
                            value={dev.accuracy != null
                              ? `${(dev.accuracy * 100).toFixed(2)} cm`
                              : '--'
                            }
                          />
                          <StatItem label="Altitude" value={`${truncCoord(dev.altitude, 3)} m`} />
                        </View>

                        {/* Footer Row */}
                        <View style={styles.cardFooter}>
                          <View style={styles.footerItem}>
                            <MaterialIcons name="satellite" size={18} color="#64748b" />
                            <Text style={styles.footerText}>
                              {(dev.satellites || dev.satellites_used || 0)} Sats
                            </Text>
                          </View>
                          <View style={styles.footerItem}>
                            <MaterialIcons name="gps-fixed" size={18} color="#64748b" />
                            <Text style={styles.footerText}>Fix: {dev.fix_type || 0}</Text>
                          </View>
                          <View style={styles.footerItem}>
                            <MaterialIcons name="battery-std" size={18} color={(dev.battery_percentage || 0) < 20 ? "#ef4444" : "#22c55e"} />
                            <Text style={styles.footerText}>{dev.battery_percentage || 0}%</Text>
                          </View>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.offlineText}>Device offline — no data available</Text>
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const StatItem = ({ label, value }: { label: string, value: string }) => (
  <View style={styles.statBox}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
  },
  modalView: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    maxHeight: '75%',
    width: '100%',
    maxWidth: 520,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3a8a',
  },
  closeBtn: {
    padding: 5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubText: {
    fontSize: 12,
    color: '#cbd5e1',
    marginTop: 4,
  },
  deviceCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  statBox: {
    width: '50%',
    paddingVertical: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  offlineText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
