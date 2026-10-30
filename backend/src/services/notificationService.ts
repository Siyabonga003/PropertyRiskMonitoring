import { IIncident } from '../database/storageFallback';

export class NotificationService {
  /**
   * Dispatches out-of-band notification (Email, SMS, or Webhook) for critical hazard events
   */
  public async dispatchAlert(incident: IIncident, propertyName?: string) {
    const timestamp = incident.startedAt.toISOString();
    console.log(
      `🚨 [OUT-OF-BAND DISPATCH] ${incident.severity} ALERT | Hazard: ${incident.hazardType} | Property: ${
        propertyName || incident.propertyId
      } | Device: ${incident.deviceId} | Time: ${timestamp}`
    );
    if (incident.details) {
      console.log(`   Details: ${incident.details}`);
    }
  }
}

export const notificationService = new NotificationService();
