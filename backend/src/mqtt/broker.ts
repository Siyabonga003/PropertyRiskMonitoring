import Aedes from 'aedes';
import net from 'net';
import { env } from '../config/env';

export class EmbeddedMqttBroker {
  private aedesInstance: any = null;
  private server: net.Server | null = null;
  private isRunning = false;

  public async start(port: number = env.MQTT_PORT): Promise<boolean> {
    if (this.isRunning) return true;

    return new Promise((resolve) => {
      try {
        this.aedesInstance = (Aedes as any)();
        this.server = net.createServer(this.aedesInstance.handle);

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(
              `ℹ [Embedded MQTT] Port ${port} is already in use (external Mosquitto broker likely running). Skipping embedded broker.`
            );
          } else {
            console.warn(`⚠ [Embedded MQTT] Server error:`, err.message);
          }
          this.isRunning = false;
          resolve(false);
        });

        this.server.listen(port, () => {
          this.isRunning = true;
          console.log(`🚀 [Embedded MQTT] Aedes MQTT broker listening on port ${port}`);

          this.aedesInstance.on('client', (client: any) => {
            console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
          });

          this.aedesInstance.on('clientDisconnect', (client: any) => {
            console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
          });

          this.aedesInstance.on('publish', (packet: any, client: any) => {
            if (client && packet.topic && !packet.topic.startsWith('$SYS')) {
              // verbose debug logging can be placed here if needed
            }
          });

          resolve(true);
        });
      } catch (err: any) {
        console.warn(`⚠ [Embedded MQTT] Failed to initialize broker:`, err.message);
        this.isRunning = false;
        resolve(false);
      }
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    return new Promise((resolve) => {
      if (this.aedesInstance) {
        this.aedesInstance.close(() => {
          if (this.server) {
            this.server.close(() => {
              this.isRunning = false;
              console.log('[Embedded MQTT] Broker stopped.');
              resolve();
            });
          } else {
            this.isRunning = false;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  public get running(): boolean {
    return this.isRunning;
  }
}

export const embeddedBroker = new EmbeddedMqttBroker();
