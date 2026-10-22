/**
 * WiFi Scanner Service
 *
 * Listens on UDP port 9876 for SurvivalAI survival beacons broadcast
 * by nearby devices running Seeking Mode.
 *
 * Works on the same local WiFi network — no internet required.
 * Library: react-native-udp (dgram API)
 */

import { Platform } from 'react-native';
import { BEACON_PORT, BEACON_MAGIC, BEACON_TTL_MS, BeaconPacket } from './wifi-beacon';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredBeacon extends BeaconPacket {
  lastSeen: number;
  fromAddress: string;
}

type ScanListener = (beacons: DiscoveredBeacon[]) => void;

// ─── Module state ─────────────────────────────────────────────────────────────

let UdpLib: any = null;
let scanSocket: any = null;
let _scanning = false;
const beaconMap = new Map<string, DiscoveredBeacon>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
const listeners: ScanListener[] = [];

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

function notify() {
  const sorted = Array.from(beaconMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  for (const l of listeners) l(sorted);
}

function purgeStale() {
  const now = Date.now();
  let changed = false;
  for (const [id, b] of beaconMap) {
    if (now - b.lastSeen > BEACON_TTL_MS) {
      beaconMap.delete(id);
      changed = true;
    }
  }
  if (changed) notify();
}

function handleMessage(data: Buffer | string, rinfo: { address: string; port: number }) {
  try {
    const text = typeof data === 'string' ? data : data.toString('utf8');
    const pkt: BeaconPacket = JSON.parse(text);
    if (pkt.magic !== BEACON_MAGIC) return;

    beaconMap.set(pkt.id, {
      ...pkt,
      lastSeen: Date.now(),
      fromAddress: rinfo.address,
    });
    notify();
  } catch {
    // Ignore malformed or unrelated UDP packets
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Subscribe to the discovered beacons list.
 * Callback fires immediately with current list, then on every change.
 * Returns an unsubscribe function.
 */
export function subscribeBeacons(listener: ScanListener): () => void {
  listeners.push(listener);
  listener(Array.from(beaconMap.values()));
  return () => {
    const i = listeners.indexOf(listener);
    if (i !== -1) listeners.splice(i, 1);
  };
}

/**
 * Start listening for beacons. Binds a UDP socket on port 9876.
 */
export function startScanning(): Promise<void> {
  if (_scanning) return Promise.resolve();

  const udp = getUdp();
  if (!udp) {
    // Web or missing module — still mark scanning so UI shows correct state
    _scanning = true;
    cleanupTimer = setInterval(purgeStale, 5000);
    console.warn('[Scanner] UDP not available on this platform');
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    try {
      scanSocket = udp.createSocket({ type: 'udp4', reusePort: true });

      scanSocket.on('message', handleMessage);

      scanSocket.on('error', (err: Error) => {
        console.warn('[Scanner] Error:', err.message);
      });

      scanSocket.bind(BEACON_PORT, '0.0.0.0', () => {
        _scanning = true;
        cleanupTimer = setInterval(purgeStale, 5000);
        console.log(`[Scanner] Listening for beacons on UDP port ${BEACON_PORT}`);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Stop listening and clear discovered beacons.
 */
export function stopScanning(): void {
  _scanning = false;
  beaconMap.clear();

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  if (scanSocket) {
    try {
      scanSocket.close();
    } catch {
    /* socket already closed */
  }
    scanSocket = null;
  }

  // Notify listeners with empty list
  notify();
}

export function isScanning(): boolean {
  return _scanning;
}

export function getDiscoveredBeacons(): DiscoveredBeacon[] {
  return Array.from(beaconMap.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}
