import { db } from '../database/db';
import { deviceService } from '../services/deviceService';
import { DEFAULT_THRESHOLDS } from '../config/constants';

export class HeartbeatMonitor {
  private timer: NodeJS.Timeout | null = null;

  public start(intervalMs = 15000) {
    this.timer = setInterval(() => {
      this.checkDevices().catch(console.error);
    }, intervalMs);
    console.log(`💓 [Heartbeat Monitor] Device health check started (every ${intervalMs}ms)`);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async checkDevices() {
    const devices = await db.getDevices();
    const now = Date.now();

    for (const device of devices) {
      if (!device.isOnline || !device.lastSeenAt) continue;

      const elapsed = now - new Date(device.lastSeenAt).getTime();
      if (elapsed > DEFAULT_THRESHOLDS.HEARTBEAT_TIMEOUT_MS) {
        console.warn(
          `⏱ [Heartbeat Monitor] Device ${device.id} heartbeat expired (${Math.round(
            elapsed / 1000
          )}s since last packet). Marking offline.`
        );
        await deviceService.updateOnlineStatus(device.id, false);
      }
    }
  }
}

export const heartbeatMonitor = new HeartbeatMonitor();
