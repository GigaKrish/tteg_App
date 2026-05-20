// utils/geotronLogger.ts
// Terminal-based debug logger for Geotron connection tracking

// ╔══════════════════════════════════════════╗
// ║  TOGGLE: Set true to enable debug logs   ║
// ╚══════════════════════════════════════════╝
const GEOTRON_DEBUG = false;

class GeotronLogger {
  private enabled: boolean = GEOTRON_DEBUG;
  private startTime: number = 0;
  private connectionStartTime: number = 0;
  private lastSignatures: Record<string, string> = {};
  private disconnectReasons: string[] = [];

  private log(tag: string, message: string) {
    if (!this.enabled) return;
    console.log(`[GEOTRON][${tag}] ${message}`);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}min`;
  }

  // ============ CONNECTION ============

  connectionAttemptStarted(devices: string[]) {
    this.connectionStartTime = Date.now();
    this.startTime = Date.now();
    this.disconnectReasons = [];
    this.log('CONNECT', `Started for ${devices.length} device(s): ${devices.join(', ')}`);
    this.log('CONNECT', `7-second validation window opened`);
  }

  connectionEstablished(deviceId: string, timeToConnect: number) {
    this.log('CONNECT', `${deviceId} connected in ${this.formatDuration(timeToConnect)}`);
  }

  connectionFailed(deviceId: string, reason: string) {
    this.log('CONNECT', `${deviceId} FAILED: ${reason}`);
  }

  // ============ POLLING ============

  pollReceived(deviceId: string, data: any, responseTimeMs: number) {
    if (!this.enabled) return;

    const newSig = this.buildSignature(data);
    const oldSig = this.lastSignatures[deviceId];
    const changed = oldSig !== newSig;
    this.lastSignatures[deviceId] = newSig;

    const tag = changed ? 'CHANGED' : 'SAME';
    this.log('POLL', `${tag} ${deviceId} ${responseTimeMs}ms | lat:${data?.latitude} lon:${data?.longitude} alt:${data?.altitude} acc:${data?.accuracy} vAcc:${data?.vAcc} fix:${data?.fix_type} sats:${data?.satellites ?? data?.satellites_used ?? 0} bat:${data?.battery_percentage}%`);
  }

  pollFailed(deviceId: string, error: string) {
    this.log('POLL', `FAIL ${deviceId}: ${error}`);
  }

  pollNoData(deviceId: string) {
    this.log('POLL', `NO DATA ${deviceId}`);
  }

  // ============ STATUS ============

  statusChanged(deviceId: string, oldStatus: string, newStatus: string, reason: string) {
    this.log('STATUS', `${deviceId}: ${oldStatus} -> ${newStatus} | ${reason}`);
    if (newStatus === 'OFFLINE') {
      this.disconnectReasons.push(`${deviceId}: ${reason}`);
    }
  }

  // ============ VALIDATION ============

  validationProgress(deviceId: string, elapsedMs: number, dataReceived: boolean, signatureChanged: boolean) {
    const remaining = Math.max(0, 7000 - elapsedMs);
    this.log('VALIDATE', `${deviceId} | ${this.formatDuration(elapsedMs)} elapsed, ${this.formatDuration(remaining)} left | data:${dataReceived ? 'yes' : 'no'} sigChanged:${signatureChanged ? 'yes' : 'no'}`);
  }

  validationEarlyGraduation(deviceId: string, elapsedMs: number) {
    this.log('VALIDATE', `GRADUATED ${deviceId} in ${this.formatDuration(elapsedMs)} (data + signature changed)`);
  }

  validationWindowExpired(deviceResults: Array<{ deviceId: string; dataReceived: boolean; signatureChanged: boolean; graduated: boolean }>) {
    if (!this.enabled) return;
    this.log('VALIDATE', `7s window expired`);
    for (const r of deviceResults) {
      if (r.graduated) {
        this.log('VALIDATE', `  ${r.deviceId}: ACTIVE (graduated early)`);
      } else if (!r.dataReceived) {
        this.log('VALIDATE', `  ${r.deviceId}: OFFLINE (no data in 7s)`);
      } else if (!r.signatureChanged) {
        this.log('VALIDATE', `  ${r.deviceId}: OFFLINE (zombie - data identical for 7s)`);
      }
    }
  }

  calibrationProgress(deviceId: string, count: number, required: number) {
    this.log('CALIBRATE', `${deviceId}: ${count}/${required} packets`);
  }

  calibrationComplete(deviceId: string, timeMs: number) {
    this.log('CALIBRATE', `${deviceId} complete in ${this.formatDuration(timeMs)}`);
  }

  // ============ ZOMBIE ============

  zombieCheck(deviceId: string, stagnantMs: number, threshold: number) {
    const remaining = threshold - stagnantMs;
    if (remaining > 0 && remaining < 3000) {
      this.log('ZOMBIE', `${deviceId} stagnant ${this.formatDuration(stagnantMs)} (offline in ${this.formatDuration(remaining)})`);
    }
  }

  zombieDetected(deviceId: string, stagnantMs: number) {
    this.log('ZOMBIE', `${deviceId} OFFLINE - unchanged for ${this.formatDuration(stagnantMs)}`);
  }

  // ============ DISCONNECT ============

  disconnectTriggered(reason: string, activeDevices: number, totalDevices: number) {
    const elapsed = Date.now() - this.connectionStartTime;
    this.log('DISCONNECT', `Auto-disconnect after ${this.formatDuration(elapsed)} | ${reason} | active:${activeDevices}/${totalDevices}`);
  }

  manualDisconnect(devices: string[]) {
    this.log('DISCONNECT', `Manual disconnect for ${devices.length} device(s)`);
  }

  // ============ SUMMARY ============

  printSummary() {
    const elapsed = Date.now() - this.startTime;
    this.log('SUMMARY', `Session: ${this.formatDuration(elapsed)} | Reasons: ${this.disconnectReasons.length > 0 ? this.disconnectReasons.join(', ') : 'None'}`);
  }

  // ============ UTILITIES ============

  private buildSignature(data: any): string {
    if (!data) return 'null';
    return `${data.latitude}|${data.longitude}|${data.altitude}|${data.accuracy}|${data.vAcc}|${data.fix_type}|${data.battery_percentage}`;
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  isEnabled(): boolean { return this.enabled; }

  clear() {
    this.lastSignatures = {};
    this.disconnectReasons = [];
    this.startTime = Date.now();
    this.connectionStartTime = Date.now();
  }
}

export const geotronLogger = new GeotronLogger();
