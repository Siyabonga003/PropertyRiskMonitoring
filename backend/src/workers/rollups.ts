import { db } from '../database/db';

export class RollupWorker {
  private timer: NodeJS.Timeout | null = null;

  public start(intervalMs = 60000 * 60) {
    // Run initial rollup computation
    this.computeRollups().catch(console.error);

    this.timer = setInterval(() => {
      this.computeRollups().catch(console.error);
    }, intervalMs);
    console.log(`⏱ [Rollup Worker] Started rollup scheduler (interval: ${intervalMs}ms)`);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async computeRollups() {
    const devices = await db.getDevices();
    const now = new Date();
    // Hourly bucket
    const bucketStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);

    for (const device of devices) {
      const history = await db.getTelemetryHistory(device.id, 500);
      if (!history || history.length === 0) continue;

      let sumTemp = 0;
      let minTemp = Infinity;
      let maxTemp = -Infinity;
      let tempCount = 0;

      let sumHum = 0;
      let humCount = 0;

      let sumSmoke = 0;
      let maxSmoke = -Infinity;
      let smokeCount = 0;

      let waterEvents = 0;
      let motionEvents = 0;

      for (const r of history) {
        if (r.temperature !== null && r.temperature !== undefined) {
          sumTemp += r.temperature;
          tempCount++;
          if (r.temperature < minTemp) minTemp = r.temperature;
          if (r.temperature > maxTemp) maxTemp = r.temperature;
        }
        if (r.humidity !== null && r.humidity !== undefined) {
          sumHum += r.humidity;
          humCount++;
        }
        if (r.smokePpm !== null && r.smokePpm !== undefined) {
          sumSmoke += r.smokePpm;
          smokeCount++;
          if (r.smokePpm > maxSmoke) maxSmoke = r.smokePpm;
        }
        if (r.waterDetected) waterEvents++;
        if (r.motionDetected) motionEvents++;
      }

      await db.saveRollup({
        deviceId: device.id,
        bucketStart,
        avgTemp: tempCount > 0 ? Number((sumTemp / tempCount).toFixed(2)) : null,
        minTemp: minTemp !== Infinity ? Number(minTemp.toFixed(2)) : null,
        maxTemp: maxTemp !== -Infinity ? Number(maxTemp.toFixed(2)) : null,
        avgHumidity: humCount > 0 ? Number((sumHum / humCount).toFixed(2)) : null,
        avgSmokePpm: smokeCount > 0 ? Number((sumSmoke / smokeCount).toFixed(2)) : null,
        maxSmokePpm: maxSmoke !== -Infinity ? Number(maxSmoke.toFixed(2)) : null,
        waterEvents,
        motionEvents,
      });
    }
  }
}

export const rollupWorker = new RollupWorker();
