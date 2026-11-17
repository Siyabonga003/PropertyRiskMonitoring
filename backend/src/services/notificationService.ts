import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { IIncident } from '../database/storageFallback';
import { db } from '../database/db';
import { env } from '../config/env';

export class NotificationService {
  private messaging() {
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;
    try {
      if (!getApps().length) {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
        initializeApp({ credential: cert(serviceAccount) });
      }
      return getMessaging();
    } catch (error) {
      console.error('[FCM] Firebase Admin initialization failed:', error);
      return null;
    }
  }

  public async dispatchAlert(incident: IIncident, propertyName?: string) {
    const timestamp = incident.startedAt.toISOString();
    console.log(`[ALERT] ${incident.severity} ${incident.hazardType} | property=${propertyName || incident.propertyId} | device=${incident.deviceId} | time=${timestamp}`);
    if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) return;
    const messaging = this.messaging();
    if (!messaging) return;

    try {
      const memberIds = await db.getPropertyUserIds(incident.propertyId);
      const registrations = (await Promise.all(memberIds.map((userId) => db.getEnabledPushTokens(userId)))).flat();
      const batches: typeof registrations[] = [];
      for (let i = 0; i < registrations.length; i += 500) batches.push(registrations.slice(i, i + 500));
      for (const batch of batches) {
        const result = await messaging.sendEachForMulticast({
          tokens: batch.map((registration) => registration.token),
          notification: {
            title: `${incident.severity}: ${incident.hazardType.replaceAll('_', ' ')}`,
            body: `${propertyName || 'Your property'} · ${incident.details || 'Hazard detected'}`.slice(0, 500),
          },
          data: {
            incidentId: incident.id,
            propertyId: incident.propertyId,
            deviceId: incident.deviceId,
            hazardType: incident.hazardType,
            severity: incident.severity,
            startedAt: timestamp,
          },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
        const staleTokens: Array<{ userId: string; token: string }> = [];
        result.responses.forEach((response, index) => {
          if (!response.success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(response.error?.code || '')) {
            staleTokens.push({ userId: batch[index].userId, token: batch[index].token });
          }
        });
        await Promise.all(staleTokens.map(({ userId, token }) => db.removePushToken(userId, token)));
      }
    } catch (error) {
      // Alert persistence/socket delivery must not fail because push delivery is unavailable.
      console.error('[FCM] Hazard push dispatch failed:', error);
    }
  }
}

export const notificationService = new NotificationService();
