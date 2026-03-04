/**
 * Local Network Chat Room Screen
 *
 * Peer-to-peer chat over local WiFi.
 * Host mode: creates a TCP server — share your IP with others.
 * Join mode: enter the host's IP to connect and chat.
 *
 * Requires react-native-tcp-socket (native build).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Network from 'expo-network';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { t, useLocale } from '@/services/i18n';
import {
  hostRoom,
  joinRoom,
  sendMessage,
  disconnect,
  subscribeStatus,
  subscribeMessages,
  type LocalChatMessage,
  type LocalChatStatus,
  type LocalChatRole,
} from '@/services/local-chat';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Setup Panel ──────────────────────────────────────────────────────────────

interface SetupPanelProps {
  onHost: (nickname: string, myIp: string) => void;
  onJoin: (nickname: string, hostIp: string) => void;
}

function SetupPanel({ onHost, onJoin }: SetupPanelProps) {
  const [nickname, setNickname] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [myIp, setMyIp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    Network.getIpAddressAsync().then((ip) => setMyIp(ip || '')).catch(() => {});
  }, []);

  const handleHost = async () => {
    const name = nickname.trim() || t('local_chat_survivor');
    setIsLoading(true);
    try {
      await onHost(name, myIp);
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Failed to start room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    const ip = hostIp.trim();
    if (!ip) {
      Alert.alert(t('error'), t('local_chat_enter_ip'));
      return;
    }
    const name = nickname.trim() || t('local_chat_survivor');
    setIsLoading(true);
    try {
      await onJoin(name, ip);
    } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Failed to connect');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.setupContainer}>
      <View style={styles.ipBadge}>
        <Ionicons name="wifi" size={14} color={Colors.green} />
        <Text style={styles.ipText}>{t('local_chat_your_ip')}: {myIp || '...'}</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t('local_chat_nickname')}</Text>
        <TextInput
          style={styles.textInput}
          value={nickname}
          onChangeText={setNickname}
          placeholder={t('local_chat_nickname_placeholder')}
          placeholderTextColor={Colors.textDim}
          maxLength={20}
          autoCapitalize="words"
        />
      </View>

      <TouchableOpacity
        style={[styles.actionButton, styles.hostButton, isLoading && styles.buttonDisabled]}
        onPress={handleHost}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Ionicons name="radio" size={18} color={Colors.bg} />
        <View style={styles.buttonTextGroup}>
          <Text style={styles.actionButtonText}>{t('local_chat_host')}</Text>
          <Text style={styles.actionButtonSub}>{t('local_chat_host_desc')}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('local_chat_or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>{t('local_chat_host_ip')}</Text>
        <TextInput
          style={styles.textInput}
          value={hostIp}
          onChangeText={setHostIp}
          placeholder="192.168.1.100"
          placeholderTextColor={Colors.textDim}
          autoCapitalize="none"
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity
        style={[styles.actionButton, styles.joinButton, isLoading && styles.buttonDisabled]}
        onPress={handleJoin}
        activeOpacity={0.8}
        disabled={isLoading}
      >
        <Ionicons name="enter" size={18} color={Colors.bg} />
        <View style={styles.buttonTextGroup}>
          <Text style={styles.actionButtonText}>{t('local_chat_join')}</Text>
          <Text style={styles.actionButtonSub}>{t('local_chat_join_desc')}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.platformNote}>
        {t('local_chat_platform_note')}
      </Text>
    </View>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────

interface ChatViewProps {
  messages: LocalChatMessage[];
  status: LocalChatStatus;
  onSend: (text: string) => void;
  onDisconnect: () => void;
  myNickname: string;
}

function ChatView({ messages, status, onSend, onDisconnect, myNickname }: ChatViewProps) {
  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const flatListRef = useRef<FlatList<LocalChatMessage>>(null);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    onSend(text);
    setInputText('');
  }, [inputText, onSend]);

  const renderMessage = useCallback(({ item }: { item: LocalChatMessage }) => {
    const isMe = item.sender === myNickname;
    const isSystem = item.type === 'system' || item.type === 'join' || item.type === 'leave';

    if (isSystem) {
      const systemText = item.type === 'join'
        ? `${item.sender} ${t('local_chat_joined')}`
        : item.type === 'leave'
        ? `${item.sender} ${t('local_chat_left')}`
        : item.text;
      return (
        <View style={styles.systemMsgRow}>
          <Text style={styles.systemMsgText}>{systemText}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowPeer]}>
        {!isMe && (
          <Text style={styles.senderName}>{item.sender}</Text>
        )}
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubblePeer]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextPeer]}>
            {item.text}
          </Text>
          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  }, [myNickname]);

  return (
    <View style={styles.chatContainer}>
      {/* Status bar */}
      <View style={styles.chatStatusBar}>
        <View style={styles.chatStatusLeft}>
          <View style={[styles.statusDot, { backgroundColor: Colors.green }]} />
          <Text style={styles.chatStatusText}>
            {status.role === 'hosting'
              ? `${t('local_chat_hosting')} · ${status.peerCount} ${t('local_chat_peers')}`
              : `${t('local_chat_connected_to')} ${status.hostIp}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.disconnectButton}
          onPress={onDisconnect}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={16} color={Colors.red} />
          <Text style={styles.disconnectText}>{t('local_chat_leave')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.inputRow, inputFocused && styles.inputRowFocused]}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t('local_chat_send_msg')}
            placeholderTextColor={Colors.textDim}
            multiline
            maxLength={500}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          <TouchableOpacity
            style={[styles.sendButton, inputText.trim().length > 0 && styles.sendButtonActive]}
            onPress={handleSend}
            activeOpacity={0.7}
            disabled={inputText.trim().length === 0}
          >
            <Ionicons
              name="arrow-up"
              size={20}
              color={inputText.trim().length > 0 ? Colors.bg : Colors.textDim}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RoomScreen() {
  useLocale();

  const [status, setStatus] = useState<LocalChatStatus>({ role: 'idle', peerCount: 0 });
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [myNickname, setMyNickname] = useState('Survivor');

  useEffect(() => {
    const unsubStatus = subscribeStatus((s) => setStatus(s));
    const unsubMessages = subscribeMessages((msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    return () => {
      unsubStatus();
      unsubMessages();
    };
  }, []);

  const handleHost = useCallback(async (nickname: string, myIp: string) => {
    setMyNickname(nickname);
    setMessages([]);
    await hostRoom(nickname, myIp);
  }, []);

  const handleJoin = useCallback(async (nickname: string, hostIp: string) => {
    setMyNickname(nickname);
    setMessages([]);
    await joinRoom(nickname, hostIp);
  }, []);

  const handleSend = useCallback((text: string) => {
    sendMessage(text);
  }, []);

  const handleDisconnect = useCallback(() => {
    Alert.alert(
      t('local_chat_leave_title'),
      t('local_chat_leave_confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('local_chat_leave'), style: 'destructive', onPress: () => disconnect() },
      ]
    );
  }, []);

  const isActive = status.role !== 'idle';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerAccent} />
          <Text style={styles.headerTitle}>{t('local_chat_room')}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{t('local_chat_subtitle')}</Text>
      </View>

      {isActive ? (
        <ChatView
          messages={messages}
          status={status}
          onSend={handleSend}
          onDisconnect={handleDisconnect}
          myNickname={myNickname}
        />
      ) : (
        <SetupPanel onHost={handleHost} onJoin={handleJoin} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  headerAccent: {
    width: 4,
    height: 26,
    backgroundColor: Colors.green,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginLeft: Spacing.lg + Spacing.xs,
  },

  // Setup Panel
  setupContainer: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  ipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: `${Colors.green}15`,
    borderWidth: 1,
    borderColor: `${Colors.green}40`,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
    alignSelf: 'flex-start',
  },
  ipText: {
    fontSize: FontSize.sm,
    color: Colors.green,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  textInput: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  hostButton: {
    backgroundColor: Colors.green,
  },
  joinButton: {
    backgroundColor: Colors.amber,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextGroup: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.bg,
    letterSpacing: 1,
  },
  actionButtonSub: {
    fontSize: FontSize.xs,
    color: `${Colors.bg}aa`,
    marginTop: 2,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    letterSpacing: 1,
    fontWeight: '600',
  },
  platformNote: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },

  // Chat View
  chatContainer: {
    flex: 1,
  },
  chatStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chatStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatStatusText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  disconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  disconnectText: {
    fontSize: FontSize.sm,
    color: Colors.red,
    fontWeight: '600',
  },
  messagesList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  messageRow: {
    marginBottom: Spacing.md,
    maxWidth: '80%',
  },
  messageRowMe: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  messageRowPeer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    marginBottom: 4,
    marginLeft: Spacing.xs,
    letterSpacing: 0.5,
  },
  messageBubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bubbleMe: {
    backgroundColor: Colors.green,
    borderBottomRightRadius: BorderRadius.sm,
  },
  bubblePeer: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  messageTextMe: {
    color: Colors.bg,
    fontWeight: '500',
  },
  messageTextPeer: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    color: `${Colors.bg}88`,
    textAlign: 'right',
  },
  systemMsgRow: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  systemMsgText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },

  // Input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
    gap: Spacing.sm,
  },
  inputRowFocused: {
    borderTopColor: Colors.green,
  },
  chatInput: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
});
