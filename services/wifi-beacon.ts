/**
 * WiFi UDP Beacon Service for Seeking Mode
 *
 * Broadcasts a survival beacon over local WiFi using UDP.
 * All SurvivalAI devices on the same network can detect this beacon
 * by running the scanner (wifi-scanner.ts).
 *
 * Transport : UDP broadcast → 255.255.255.255:9876 every 3 s
 * Library   : react-native-udp (dgram API)
 * Requires  : Custom dev client (not Expo Go)
 */

import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BEACON_PORT = 9876;
export const BROADCAST_ADDR = '255.255.255.255';
export const BEACON_INTERVAL_MS = 3000;
/** Remove a beacon from the discovered list if not seen for this long */
export const BEACON_TTL_MS = 12000;
export const BEACON_MAGIC = 'SRVAI_V1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BeaconConfig {
  deviceName: string;
  message: string;
  latitude?: number;
  longitude?: number;
}

export interface BeaconPacket {
  magic: string;
  id: string;
  deviceName: string;
  message: string;
  latitude?: number;
  longitude?: number;
  timestamp: number;
}

// ─── Stable per-session device ID ─────────────────────────────────────────────

export const deviceId: string = (() => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'SRV-';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
})();

// ─── Module state ─────────────────────────────────────────────────────────────

let UdpLib: any = null;
let udpSocket: any = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let _active = false;
let _config: BeaconConfig | null = null;
let _startTime: number | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * react-native-tcp-socket is TCP only — it has no datagram support at all, so
 * the previous `createUdpSocket` call threw and the beacon could never start.
 * react-native-udp provides the dgram API this code expects.
 */
function getUdp(): any {
  if (Platform.OS === 'web') return null;
  if (!UdpLib) {
    try {
      UdpLib = require('react-native-udp').default ?? require('react-native-udp');
    } catch {
      return null;
    }
  }
  return UdpLib;
}

function buildPacket(config: BeaconConfig): string {
  const pkt: BeaconPacket = {
    magic: BEACON_MAGIC,
    id: deviceId,
    deviceName: config.deviceName,
    message: config.message,
    timestamp: Date.now(),
  };
  if (config.latitude !== undefined && !isNaN(config.latitude)) pkt.latitude = config.latitude;
  if (config.longitude !== undefined && !isNaN(config.longitude)) pkt.longitude = config.longitude;
  return JSON.stringify(pkt);
}

function sendPacket() {
  if (!_active || !_config || !udpSocket) return;
  const data = buildPacket(_config);
  try {
    udpSocket.send(data, 0, data.length, BEACON_PORT, BROADCAST_ADDR, (err: Error | null) => {
      if (err) console.warn('[Beacon] Send error:', err.message);
    });
  } catch (e) {
    console.warn('[Beacon] Send exception:', e);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start broadcasting a WiFi UDP beacon.
 * Sends a JSON packet to 255.255.255.255:9876 every 3 seconds.
 */
export async function startBeacon(config: BeaconConfig): Promise<void> {
  if (_active) await stopBeacon();

  _config = { ...config };
  _startTime = Date.now();

  const udp = getUdp();
  if (!udp) {
    // Web / missing module — mark active for UI, no real broadcast
    _active = true;
    console.warn('[Beacon] UDP not available on this platform');
    return;
  }

  return new Promise<void>((resolve, reject) => {
    try {
      udpSocket = udp.createSocket({ type: 'udp4', reusePort: true });

      udpSocket.on('error', (err: Error) => {
        console.warn('[Beacon] Socket error:', err.message);
      });

      // Bind to port 0 so OS picks a free sending port
      udpSocket.bind(0, '0.0.0.0', () => {
        try {
          udpSocket.setBroadcast(true);
          _active = true;

          // Broadcast immediately then on interval
          sendPacket();
          intervalId = setInterval(sendPacket, BEACON_INTERVAL_MS);

          console.log(
            `[Beacon] WiFi UDP beacon active — broadcasting to ${BROADCAST_ADDR}:${BEACON_PORT} every ${BEACON_INTERVAL_MS}ms`
          );
          resolve();
        } catch (e) {
          _active = false;
          reject(e);
        }
      });
    } catch (e) {
      _active = false;
      reject(e);
    }
  });
}

/**
 * Update beacon config while it is running (e.g. GPS coords updated).
 */
export function updateBeaconConfig(updates: Partial<BeaconConfig>): void {
  if (_config) {
    _config = { ..._config, ...updates };
  }
}

/**
 * Stop broadcasting the beacon and release the UDP socket.
 */
export async function stopBeacon(): Promise<void> {
  _active = false;
  _startTime = null;
  _config = null;

  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }

  if (udpSocket) {
    try {
      udpSocket.close();
    } catch {
    /* socket already closed */
  }
    udpSocket = null;
  }

  console.log('[Beacon] Stopped');
}

export function isBeaconActive(): boolean {
  return _active;
}

export function getBeaconStatus() {
  return {
    active: _active,
    startTime: _startTime,
    config: _config ? { ..._config } : null,
    deviceId,
  };
}
