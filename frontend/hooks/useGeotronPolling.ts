// hooks/useGeotronPolling.ts
// Simplified: transteg API now returns null when hardware is off.
// No zombie/stale detection needed — data = ACTIVE, null = OFFLINE.

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { normalizeGeotronAssignments } from '../utils/formatters';
import type { GeotronAssignment } from '../types/models.types';

type DeviceStatus = 'OFFLINE' | 'ACTIVE';

interface DeviceState {
  data: any | null;
  status: DeviceStatus;
}

// Build a lightweight fingerprint of the data to detect real changes
const buildSignature = (data: any): string => {
  if (!data) return 'null';
  return `${data.latitude ?? 0}|${data.longitude ?? 0}|${data.altitude ?? 0}|${data.accuracy ?? 0}|${data.fix_type ?? 0}|${data.battery_percentage ?? 0}`;
};

export const useGeotronPolling = (isActive: boolean, user: any, onDisconnect: () => void) => {
  const [deviceStates, setDeviceStates] = useState<Record<string, DeviceState>>({});
  const [isConnecting, setIsConnecting] = useState(false);

  const isMounted = useRef(true);
  const onDisconnectRef = useRef(onDisconnect);

  // Signature cache — lives in a ref so it doesn't trigger re-renders itself
  const lastSignatures = useRef<Record<string, string>>({});

  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  useEffect(() => {
    isMounted.current = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let isPolling = false;
    let appStateSub: ReturnType<typeof AppState.addEventListener> | null = null;
    let firstPollDone = false;

    const fetchAllDevices = async () => {
      if (isPolling) return;
      isPolling = true;

      try {
        const assignments: GeotronAssignment[] = normalizeGeotronAssignments(user?.assignedGeotrons);
        const assignedIds: string[] = assignments.map(a => a.geotronName);
        if (assignedIds.length === 0) return;

        // Three outcomes per device:
        //   confirmed:true  + data   → device is ON  (ACTIVE)
        //   confirmed:true  + null   → device is OFF (OFFLINE) — transteg said so
        //   confirmed:false + null   → network error  — keep previous state
        const results = await Promise.all(
          assignedIds.map(async (devId) => {
            try {
              const response = await fetch("https://transteg.deepgazetech.com/geotron", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ client_id: "test_user", HARDCODED_CLIENT_ID: devId })
              });

              if (!response.ok) return { id: devId, data: null, confirmed: false };

              const rawText = await response.text();
              if (!rawText || rawText === "null") return { id: devId, data: null, confirmed: true };

              let data = JSON.parse(rawText);
              if (typeof data === 'string') data = JSON.parse(data);

              return { id: devId, data, confirmed: true };
            } catch (e: any) {
              return { id: devId, data: null, confirmed: false };
            }
          })
        );

        if (!isMounted.current) return;

        // Stop spinner after the very first confirmed poll completes
        if (!firstPollDone && results.some(r => r.confirmed)) {
          firstPollDone = true;
          setIsConnecting(false);
        }

        // --- CRITICAL OPTIMIZATION ---
        // Only call setDeviceStates when something actually changed.
        // This prevents the 1Hz full-tree re-render that causes OOM over long sessions.
        setDeviceStates(prev => {
          if (!isMounted.current) return prev;

          let changed = false;
          const next: Record<string, DeviceState> = {};

          for (const { id: devId, data, confirmed } of results) {
            const prevState = prev[devId];

            if (!confirmed) {
              // Network error — retain previous state (don't flash offline)
              if (prevState) {
                next[devId] = prevState;
              }
              continue;
            }

            const newStatus: DeviceStatus = data ? 'ACTIVE' : 'OFFLINE';
            const newSig = buildSignature(data);
            const prevSig = lastSignatures.current[devId];

            if (!prevState || prevState.status !== newStatus || prevSig !== newSig) {
              changed = true;
              lastSignatures.current[devId] = newSig;
              next[devId] = { data, status: newStatus };
            } else {
              next[devId] = prevState;
            }
          }

          if (!changed) return prev;
          return next;
        });

      } finally {
        isPolling = false;
      }
    };

    if (isActive) {
      setIsConnecting(true);
      firstPollDone = false;
      lastSignatures.current = {};

      fetchAllDevices();
      intervalId = setInterval(fetchAllDevices, 1000);

      // Pause polling when app is backgrounded to save battery & prevent Android OOM
      const handleAppState = (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          if (!intervalId) {
            fetchAllDevices();
            intervalId = setInterval(fetchAllDevices, 1000);
          }
        } else {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      };
      appStateSub = AppState.addEventListener('change', handleAppState);

    } else {
      setDeviceStates({});
      lastSignatures.current = {};
    }

    return () => {
      isMounted.current = false;
      if (intervalId) clearInterval(intervalId);
      if (appStateSub) appStateSub.remove();
    };
  }, [isActive, user]);

  // Export only active devices with data
  const multiDeviceData = useMemo(() => {
    return Object.entries(deviceStates).reduce((acc, [key, state]) => {
      if (state.status === 'ACTIVE' && state.data) {
        acc[key] = state.data;
      }
      return acc;
    }, {} as Record<string, any>);
  }, [deviceStates]);

  // Button color based on best fix type
  const getButtonColor = useCallback(() => {
    if (!isActive) return '#656565'; // Grey (Off)
    if (isConnecting) return '#656565'; // Grey (Connecting)

    const activeDevices = Object.values(deviceStates).filter(s => s.status === 'ACTIVE' && s.data);
    if (activeDevices.length === 0) return '#656565'; // Grey (No live devices)

    const maxFixType = Math.max(...activeDevices.map(d => d.data?.fix_type || 0));
    if (maxFixType <= 2) return '#FF3B30'; // Red
    if (maxFixType === 3) return '#2196F3'; // Blue
    if (maxFixType === 4) return '#4CD964'; // Green
    if (maxFixType === 5) return '#E91E63'; // Pink
    return '#656565';
  }, [deviceStates, isActive, isConnecting]);

  // Build role map: deviceId → role (e.g. "GEOTRON_01" → "MID")
  const roleMap = useMemo(() => {
    const assignments: GeotronAssignment[] = normalizeGeotronAssignments(user?.assignedGeotrons);
    return assignments.reduce((acc, a) => {
      acc[a.geotronName] = a.role;
      return acc;
    }, {} as Record<string, string>);
  }, [user]);

  return { multiDeviceData, isConnecting, setIsConnecting, getButtonColor, roleMap };
};