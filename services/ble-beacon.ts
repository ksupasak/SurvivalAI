/**
 * BLE Beacon Service for Seeking Mode
 *
 * Manages Bluetooth Low Energy (BLE) advertising to broadcast
 * the device's presence and location to nearby rescuers or
 * other SurvivalAI users.
 *
 * NOTE: BLE advertising requires native modules that are not available
 * in Expo's managed workflow. This service provides the interface and
 * state management, with placeholder implementations for the actual
 * BLE operations.
 *
 * For real implementation, you would need one of:
 *
 * 1. react-native-ble-advertiser
 *    - Dedicated BLE advertising library
 *    - npm install react-native-ble-advertiser
 *    - Supports both iOS (Core Bluetooth) and Android (BluetoothLeAdvertiser)
 *    - Best option for broadcasting beacon signals
 *
 * 2. react-native-ble-plx
 *    - Full-featured BLE library (scanning + advertising)
 *    - npm install react-native-ble-plx
 *    - More comprehensive but heavier
 *    - Supports peripheral mode on some platforms
 *
 * 3. Expo development build with custom native module
 *    - Use expo-modules-api to create a native module
 *    - Wraps platform-specific BLE advertising APIs
 *    - Most integrated with Expo workflow
 *
 * Required permissions:
 * - Android: BLUETOOTH, BLUETOOTH_ADMIN, BLUETOOTH_ADVERTISE (Android 12+),
 *            ACCESS_FINE_LOCATION
 * - iOS: NSBluetoothAlwaysUsageDescription, NSBluetoothPeripheralUsageDescription
 */

export type BeaconConfig = {
  /** Display name broadcast to nearby devices */
  deviceName: string;
  /** Short message included in advertisement data */
  message: string;
  /** Optional latitude for location-aware rescue */
  latitude?: number;
  /** Optional longitude for location-aware rescue */
  longitude?: number;
};

// Internal state
let active = false;
let startTime: number | null = null;
let currentConfig: BeaconConfig | null = null;

/**
 * Start broadcasting a BLE beacon signal.
 *
 * In a real implementation, this would:
 * 1. Check Bluetooth permissions
 * 2. Verify BLE advertising support on the device
 * 3. Configure the advertisement data (UUID, device name, message)
 * 4. Start advertising via the native BLE module
 *
 * The beacon would broadcast:
 * - A SurvivalAI-specific service UUID for discovery
 * - The device name for identification
 * - Encoded message and optional GPS coordinates in the advertisement payload
 *
 * @param config - Beacon configuration with name, message, and optional location
 */
export async function startBeacon(config: BeaconConfig): Promise<void> {
  if (active) {
    console.warn('[BLE Beacon] Beacon is already active. Stop it before starting a new one.');
    return;
  }

  console.log('[BLE Beacon] Starting beacon (placeholder)');
  console.log(`[BLE Beacon] Device Name: ${config.deviceName}`);
  console.log(`[BLE Beacon] Message: ${config.message}`);

  if (config.latitude !== undefined && config.longitude !== undefined) {
    console.log(`[BLE Beacon] Location: ${config.latitude}, ${config.longitude}`);
  }

  // In production, this is where you would call:
  // await BleAdvertiser.broadcast(serviceUUID, manufacturerData, options);
  // or set up a GATT server with react-native-ble-plx

  active = true;
  startTime = Date.now();
  currentConfig = { ...config };

  console.log(
    '[BLE Beacon] Beacon started (placeholder). Install react-native-ble-advertiser for real BLE broadcasting.'
  );
}

/**
 * Stop the BLE beacon broadcast.
 *
 * In a real implementation, this would stop the BLE advertiser
 * and release Bluetooth resources.
 */
export async function stopBeacon(): Promise<void> {
  if (!active) {
    console.warn('[BLE Beacon] No active beacon to stop.');
    return;
  }

  console.log('[BLE Beacon] Stopping beacon (placeholder)');

  // In production: await BleAdvertiser.stopBroadcast();

  active = false;
  startTime = null;
  currentConfig = null;

  console.log('[BLE Beacon] Beacon stopped.');
}

/**
 * Check if a beacon is currently broadcasting.
 */
export function isBeaconActive(): boolean {
  return active;
}

/**
 * Get the full beacon status including uptime and configuration.
 */
export function getBeaconStatus(): {
  active: boolean;
  startTime: number | null;
  config: BeaconConfig | null;
} {
  return {
    active,
    startTime,
    config: currentConfig ? { ...currentConfig } : null,
  };
}
