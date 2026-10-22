/**
 * Push Notifications Service
 * Handles Expo push token registration and permission requests.
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSetting, setSetting } from './settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const ANDROID_CHANNEL_ID = 'board';

/**
 * Standalone builds cannot derive the EAS project from the manifest the way
 * Expo Go does, so the id has to be passed explicitly or token requests fail.
 */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    undefined
  );
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Message board',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#d97706',
  });
}

/**
 * Ask for notification permission and return an Expo push token.
 *
 * Call this only when the user has asked for something that needs it (i.e.
 * subscribing to the board) — prompting at launch, with no context, reads as
 * unexplained to users and to store reviewers.
 *
 * @returns the token, or null if unavailable or declined
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    await ensureAndroidChannel();

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId = getProjectId();
    if (!projectId) {
      console.warn(
        '[Push] No EAS projectId configured (app.json → expo.extra.eas.projectId). ' +
          'Push tokens cannot be issued for this build.'
      );
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await setSetting('push_token', token);
    return token;
  } catch (e) {
    console.warn('[Push] Registration failed:', e);
    return null;
  }
}

/** True when permission was already granted, without prompting for it. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  return getSetting('push_token');
}

export function addNotificationListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
