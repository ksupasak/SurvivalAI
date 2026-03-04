/**
 * Local Network Chat Service
 *
 * Peer-to-peer chat over local WiFi using TCP sockets.
 * One device acts as Host (server on port 8765).
 * Other devices Join (client connecting to host by IP).
 *
 * Requires: react-native-tcp-socket (native build only)
 * Message format: JSON lines terminated with '\n'
 *   { type: 'message' | 'join' | 'leave' | 'ping', text?, sender, timestamp }
 */

import { Platform } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocalChatRole = 'idle' | 'hosting' | 'joined';

export interface LocalChatMessage {
  id: string;
  type: 'message' | 'system' | 'join' | 'leave';
  text: string;
  sender: string;
  timestamp: number;
}

export type LocalChatStatusListener = (status: LocalChatStatus) => void;
export type LocalChatMessageListener = (msg: LocalChatMessage) => void;

export interface LocalChatStatus {
  role: LocalChatRole;
  peerCount: number;
  myIp?: string;
  hostIp?: string;
  error?: string;
}

// ─── Internal state ───────────────────────────────────────────────────────────

const LOCAL_CHAT_PORT = 8765;

let TcpSocket: any = null;
let server: any = null;
let clientSocket: any = null;
const connectedSockets: Map<string, any> = new Map();
let myNickname = 'Survivor';
let role: LocalChatRole = 'idle';

const statusListeners: LocalChatStatusListener[] = [];
const messageListeners: LocalChatMessageListener[] = [];
let currentStatus: LocalChatStatus = { role: 'idle', peerCount: 0 };

function getTcp() {
  if (Platform.OS === 'web') return null;
  if (!TcpSocket) {
    try {
      TcpSocket = require('react-native-tcp-socket');
    } catch {
      return null;
    }
  }
  return TcpSocket;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function setStatus(update: Partial<LocalChatStatus>) {
  currentStatus = { ...currentStatus, ...update };
  for (const l of statusListeners) l(currentStatus);
}

function emitMessage(msg: LocalChatMessage) {
  for (const l of messageListeners) l(msg);
}

function parseMessages(data: string): any[] {
  return data
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function sendJson(socket: any, payload: object) {
  try {
    socket.write(JSON.stringify(payload) + '\n');
  } catch {
    // Ignore write errors
  }
}

function broadcastToClients(payload: object, exclude?: string) {
  for (const [id, sock] of connectedSockets.entries()) {
    if (id !== exclude) sendJson(sock, payload);
  }
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeStatus(listener: LocalChatStatusListener): () => void {
  statusListeners.push(listener);
  listener(currentStatus);
  return () => {
    const idx = statusListeners.indexOf(listener);
    if (idx !== -1) statusListeners.splice(idx, 1);
  };
}

export function subscribeMessages(listener: LocalChatMessageListener): () => void {
  messageListeners.push(listener);
  return () => {
    const idx = messageListeners.indexOf(listener);
    if (idx !== -1) messageListeners.splice(idx, 1);
  };
}

export function getStatus(): LocalChatStatus {
  return currentStatus;
}

// ─── Host Mode ────────────────────────────────────────────────────────────────

export function hostRoom(nickname: string, myIp: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tcp = getTcp();
    if (!tcp) {
      reject(new Error('TCP not available on this platform'));
      return;
    }

    myNickname = nickname;
    role = 'hosting';

    server = tcp.createServer({ paused: false }, (socket: any) => {
      const socketId = generateId();
      connectedSockets.set(socketId, socket);
      let peerName = 'Unknown';
      let buffer = '';

      setStatus({ role: 'hosting', peerCount: connectedSockets.size, myIp });

      socket.on('data', (raw: Buffer | string) => {
        buffer += raw.toString();
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx === -1) return;

        const lines = buffer.substring(0, buffer.lastIndexOf('\n') + 1);
        buffer = buffer.substring(buffer.lastIndexOf('\n') + 1);

        const packets = parseMessages(lines);
        for (const packet of packets) {
          if (packet.type === 'join') {
            peerName = packet.sender || 'Survivor';
            // Notify all others
            const joinMsg: LocalChatMessage = {
              id: generateId(), type: 'join', text: '', sender: peerName, timestamp: Date.now(),
            };
            emitMessage(joinMsg);
            broadcastToClients({ type: 'join', sender: peerName, timestamp: Date.now() }, socketId);
          } else if (packet.type === 'message') {
            const msg: LocalChatMessage = {
              id: generateId(), type: 'message', text: packet.text, sender: peerName, timestamp: packet.timestamp || Date.now(),
            };
            emitMessage(msg);
            broadcastToClients({ type: 'message', text: packet.text, sender: peerName, timestamp: msg.timestamp }, socketId);
          }
        }
      });

      socket.on('close', () => {
        connectedSockets.delete(socketId);
        setStatus({ role: 'hosting', peerCount: connectedSockets.size, myIp });
        if (peerName !== 'Unknown') {
          const leaveMsg: LocalChatMessage = {
            id: generateId(), type: 'leave', text: '', sender: peerName, timestamp: Date.now(),
          };
          emitMessage(leaveMsg);
          broadcastToClients({ type: 'leave', sender: peerName, timestamp: Date.now() });
        }
      });

      socket.on('error', () => {
        connectedSockets.delete(socketId);
        setStatus({ role: 'hosting', peerCount: connectedSockets.size, myIp });
      });
    });

    server.on('error', (err: Error) => {
      role = 'idle';
      setStatus({ role: 'idle', peerCount: 0, error: err.message });
      reject(err);
    });

    server.listen({ port: LOCAL_CHAT_PORT, host: '0.0.0.0' }, () => {
      setStatus({ role: 'hosting', peerCount: 0, myIp });
      const sysMsg: LocalChatMessage = {
        id: generateId(), type: 'system', text: `Hosting on ${myIp}:${LOCAL_CHAT_PORT}`, sender: 'System', timestamp: Date.now(),
      };
      emitMessage(sysMsg);
      resolve();
    });
  });
}

// ─── Join Mode ────────────────────────────────────────────────────────────────

export function joinRoom(nickname: string, hostIp: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tcp = getTcp();
    if (!tcp) {
      reject(new Error('TCP not available on this platform'));
      return;
    }

    myNickname = nickname;
    role = 'joined';
    let buffer = '';

    clientSocket = tcp.createConnection({ port: LOCAL_CHAT_PORT, host: hostIp }, () => {
      setStatus({ role: 'joined', peerCount: 1, hostIp });
      sendJson(clientSocket, { type: 'join', sender: nickname, timestamp: Date.now() });
      const sysMsg: LocalChatMessage = {
        id: generateId(), type: 'system', text: `Connected to ${hostIp}`, sender: 'System', timestamp: Date.now(),
      };
      emitMessage(sysMsg);
      resolve();
    });

    clientSocket.on('data', (raw: Buffer | string) => {
      buffer += raw.toString();
      if (!buffer.includes('\n')) return;
      const lines = buffer.substring(0, buffer.lastIndexOf('\n') + 1);
      buffer = buffer.substring(buffer.lastIndexOf('\n') + 1);

      const packets = parseMessages(lines);
      for (const packet of packets) {
        if (packet.type === 'message') {
          const msg: LocalChatMessage = {
            id: generateId(), type: 'message', text: packet.text, sender: packet.sender, timestamp: packet.timestamp || Date.now(),
          };
          emitMessage(msg);
        } else if (packet.type === 'join') {
          const msg: LocalChatMessage = {
            id: generateId(), type: 'join', text: '', sender: packet.sender, timestamp: packet.timestamp || Date.now(),
          };
          emitMessage(msg);
        } else if (packet.type === 'leave') {
          const msg: LocalChatMessage = {
            id: generateId(), type: 'leave', text: '', sender: packet.sender, timestamp: packet.timestamp || Date.now(),
          };
          emitMessage(msg);
        }
      }
    });

    clientSocket.on('close', () => {
      role = 'idle';
      setStatus({ role: 'idle', peerCount: 0 });
      const sysMsg: LocalChatMessage = {
        id: generateId(), type: 'system', text: 'Disconnected from room', sender: 'System', timestamp: Date.now(),
      };
      emitMessage(sysMsg);
    });

    clientSocket.on('error', (err: Error) => {
      role = 'idle';
      setStatus({ role: 'idle', peerCount: 0, error: err.message });
      reject(err);
    });
  });
}

// ─── Send message ─────────────────────────────────────────────────────────────

export function sendMessage(text: string) {
  const payload = { type: 'message', text, sender: myNickname, timestamp: Date.now() };

  if (role === 'hosting') {
    broadcastToClients(payload);
    const msg: LocalChatMessage = {
      id: generateId(), type: 'message', text, sender: myNickname, timestamp: Date.now(),
    };
    emitMessage(msg);
  } else if (role === 'joined' && clientSocket) {
    sendJson(clientSocket, payload);
    const msg: LocalChatMessage = {
      id: generateId(), type: 'message', text, sender: myNickname, timestamp: Date.now(),
    };
    emitMessage(msg);
  }
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export function disconnect() {
  if (server) {
    try { server.close(); } catch {}
    server = null;
  }
  if (clientSocket) {
    try { clientSocket.destroy(); } catch {}
    clientSocket = null;
  }
  connectedSockets.clear();
  role = 'idle';
  myNickname = 'Survivor';
  setStatus({ role: 'idle', peerCount: 0, myIp: undefined, hostIp: undefined, error: undefined });
}

export function getNickname(): string { return myNickname; }
export function getRole(): LocalChatRole { return role; }
