/**
 * Battery Management Service
 *
 * Monitors device battery level and state using expo-battery.
 * Provides estimates for remaining usage time, accounting for
 * power-intensive features like Seeking mode (BLE beacon).
 */

import * as Battery from 'expo-battery';

/**
 * Get the current battery level as a value between 0 and 1.
 *
 * @returns Battery level from 0.0 (empty) to 1.0 (full)
 */
export async function getBatteryLevel(): Promise<number> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    return level;
  } catch (error) {
    console.error('[Battery] Failed to get battery level:', error);
    return -1;
  }
}

/**
 * Get the current battery charging state as a human-readable string.
 *
 * @returns One of: 'charging', 'unplugged', 'full', or 'unknown'
 */
export async function getBatteryState(): Promise<string> {
  try {
    const state = await Battery.getBatteryStateAsync();

    switch (state) {
      case Battery.BatteryState.CHARGING:
        return 'charging';
      case Battery.BatteryState.UNPLUGGED:
        return 'unplugged';
      case Battery.BatteryState.FULL:
        return 'full';
      default:
        return 'unknown';
    }
  } catch (error) {
    console.error('[Battery] Failed to get battery state:', error);
    return 'unknown';
  }
}

/**
 * Subscribe to battery level changes.
 *
 * The callback is invoked whenever the battery level changes,
 * typically in increments of ~1%.
 *
 * @param callback - Function called with the new battery level (0-1)
 * @returns Unsubscribe function to remove the listener
 */
export function subscribeToBattery(callback: (level: number) => void): () => void {
  const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
    callback(batteryLevel);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Estimate remaining battery time based on current level and usage mode.
 *
 * These are rough estimates based on typical smartphone power consumption:
 * - Normal standby: ~24 hours at 100%
 * - Active app use: ~8 hours at 100%
 * - Seeking mode (BLE + GPS): ~5 hours at 100% (higher drain from
 *   continuous Bluetooth advertising and location services)
 *
 * @param level - Current battery level (0-1)
 * @param seekingMode - Whether Seeking mode (BLE beacon) is active
 * @returns Human-readable estimate string like "~4h remaining"
 */
export function estimateTimeRemaining(level: number, seekingMode: boolean): string {
  if (level <= 0) {
    return 'Battery depleted';
  }

  if (level >= 1) {
    return 'Fully charged';
  }

  // Estimated total hours at 100% battery
  // Seeking mode drains faster due to BLE advertising + GPS
  const totalHoursAtFull = seekingMode ? 5 : 8;

  const hoursRemaining = level * totalHoursAtFull;

  if (hoursRemaining < 0.25) {
    return 'Less than 15 min remaining';
  }

  if (hoursRemaining < 1) {
    const minutes = Math.round(hoursRemaining * 60);
    return `~${minutes}min remaining`;
  }

  const hours = Math.floor(hoursRemaining);
  const minutes = Math.round((hoursRemaining - hours) * 60);

  if (minutes === 0) {
    return `~${hours}h remaining`;
  }

  return `~${hours}h ${minutes}min remaining`;
}
