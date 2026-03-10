import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, FontSize, BorderRadius, type ColorScheme } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { getResponse, clearChatHistory, type ChatMode, isOfflineLlmReady, initOfflineLlm, releaseOfflineLlm, subscribeLlmStatus, type LlmStatus } from '@/services/llm';
import { speak, stopSpeaking } from '@/services/voice';
import { setApiKey, hasApiKey, getCustomServerUrl, setCustomServerUrl, getCustomModel, setCustomModel } from '@/services/settings';
import { useLocale, t } from '@/services/i18n';
import {
  AVAILABLE_MODELS,
  type ModelInfo,
  type DownloadStatus,
  type DeviceStorageInfo,
  isModelDownloaded,
  downloadModel,
  cancelDownload,
  deleteModel,
  subscribeDownloadStatus,
  formatBytes,
  getDeviceStorageInfo,
  getRecommendedModel,
  modelFitsOnDevice,
} from '@/services/model-download';
import * as Network from 'expo-network';
import {
  hostRoom,
  joinRoom,
  sendMessage as roomSendMessage,
  disconnect as roomDisconnect,
  subscribeStatus as roomSubscribeStatus,
  subscribeMessages as roomSubscribeMessages,
  type LocalChatMessage,
  type LocalChatStatus,
} from '@/services/local-chat';
import {
  loadAllConversations,
  saveConversation,
  deleteConversation,
  createConversation,
  generateTitle,
  type Conversation,
  type ConvMessage,
} from '@/services/conversations';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  mode: ChatMode;
}

interface QuickTopic {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  questionKey: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const QUICK_TOPICS: QuickTopic[] = [
  { labelKey: 'topic_water', icon: 'water', questionKey: 'topic_water_q' },
  { labelKey: 'topic_first_aid', icon: 'medkit', questionKey: 'topic_first_aid_q' },
  { labelKey: 'topic_shelter', icon: 'home', questionKey: 'topic_shelter_q' },
  { labelKey: 'topic_fire', icon: 'flame', questionKey: 'topic_fire_q' },
  { labelKey: 'topic_navigation', icon: 'compass', questionKey: 'topic_navigation_q' },
  { labelKey: 'topic_food', icon: 'nutrition', questionKey: 'topic_food_q' },
  { labelKey: 'topic_nuclear', icon: 'nuclear', questionKey: 'topic_nuclear_q' },
  { labelKey: 'topic_war_zone', icon: 'shield', questionKey: 'topic_war_zone_q' },
  { labelKey: 'topic_signals', icon: 'radio', questionKey: 'topic_signals_q' },
  { labelKey: 'topic_mental_health', icon: 'heart', questionKey: 'topic_mental_health_q' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Pulsing Mic Indicator ───────────────────────────────────────────────────

function PulsingIndicator({ color }: { color: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);
  return <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }, { transform: [{ scale: pulseAnim }] }]} />;
}

// ─── Typing Indicator ────────────────────────────────────────────────────────

function TypingIndicator({ colors }: { colors: ColorScheme }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]));
    const a1 = mk(dot1, 0); const a2 = mk(dot2, 200); const a3 = mk(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);
  const ds = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing.md, alignSelf: 'flex-start' }}>
      <View style={{ width: 28, height: 28, borderRadius: BorderRadius.full, backgroundColor: `${colors.amber}15`, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, borderWidth: 1, borderColor: `${colors.amber}30` }}>
        <Ionicons name="hardware-chip" size={12} color={colors.amber} />
      </View>
      <View style={{ backgroundColor: colors.bgCard, borderRadius: BorderRadius.lg, borderBottomLeftRadius: BorderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber }, ds(dot1)]} />
          <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber }, ds(dot2)]} />
          <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.amber }, ds(dot3)]} />
        </View>
      </View>
    </View>
  );
}

// ─── Segment Bar (AI / Room) ─────────────────────────────────────────────────

type ChatPanel = 'ai' | 'room';
interface SegBarProps { active: ChatPanel; onSelect: (p: ChatPanel) => void; colors: ColorScheme; }
function SegBar({ active, onSelect, colors }: SegBarProps) {
  const s = useMemo(() => StyleSheet.create({
    bar: { flexDirection: 'row', backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
    option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, gap: Spacing.xs },
    optionActive: { borderBottomWidth: 2, borderBottomColor: colors.amber },
    label: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary },
    labelActive: { color: colors.amber },
  }), [colors]);
  return (
    <View style={s.bar}>
      {(['ai', 'room'] as ChatPanel[]).map((p) => {
        const isActive = active === p;
        return (
          <TouchableOpacity key={p} style={[s.option, isActive && s.optionActive]} onPress={() => onSelect(p)} activeOpacity={0.8}>
            <Ionicons name={p === 'ai' ? 'chatbubbles' : 'people'} size={15} color={isActive ? colors.amber : colors.textSecondary} />
            <Text style={[s.label, isActive && s.labelActive]}>{p === 'ai' ? t('tab_chat') : t('tab_room')}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Threads Drawer ──────────────────────────────────────────────────────────

interface ThreadsDrawerProps {
  visible: boolean;
  conversations: Conversation[];
  activeConvId: string;
  onSelect: (conv: Conversation) => void;
  onDelete: (conv: Conversation) => void;
  onNew: () => void;
  onClose: () => void;
  colors: ColorScheme;
}
function ThreadsDrawer({ visible, conversations, activeConvId, onSelect, onDelete, onNew, onClose, colors }: ThreadsDrawerProps) {
  const s = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, flexDirection: 'row', backgroundColor: colors.overlay },
    panel: { width: '75%', backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: '800', color: colors.text, letterSpacing: 1 },
    newBtn: { width: 32, height: 32, borderRadius: BorderRadius.md, backgroundColor: `${colors.amber}20`, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: `${colors.amber}40` },
    item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight, gap: Spacing.sm },
    itemActive: { backgroundColor: `${colors.amber}10` },
    itemContent: { flex: 1, minWidth: 0 },
    itemTitle: { fontSize: FontSize.sm, fontWeight: '600', color: colors.text, marginBottom: 2 },
    itemDate: { fontSize: FontSize.xs, color: colors.textDim },
    itemPreview: { fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 1 },
    deleteBtn: { padding: Spacing.xs },
    empty: { padding: Spacing.xl, alignItems: 'center' },
    emptyText: { color: colors.textDim, fontSize: FontSize.sm },
  }), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.panel}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{t('thread_conversations')}</Text>
            <TouchableOpacity style={s.newBtn} onPress={onNew} activeOpacity={0.7}>
              <Ionicons name="add" size={18} color={colors.amber} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={conversations}
            keyExtractor={(c) => c.id}
            renderItem={({ item }) => {
              const isActive = item.id === activeConvId;
              const lastMsg = item.messages[item.messages.length - 1];
              return (
                <TouchableOpacity style={[s.item, isActive && s.itemActive]} onPress={() => onSelect(item)} activeOpacity={0.7}>
                  <View style={s.itemContent}>
                    <Text style={s.itemTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.itemDate}>{formatDate(item.updatedAt)}</Text>
                    {lastMsg && (
                      <Text style={s.itemPreview} numberOfLines={1}>{lastMsg.text}</Text>
                    )}
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={16} color={colors.amber} />}
                  <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.red} />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="chatbubble-outline" size={32} color={colors.textDim} />
                <Text style={[s.emptyText, { marginTop: Spacing.sm }]}>{t('thread_empty')}</Text>
              </View>
            }
          />
        </View>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </View>
    </Modal>
  );
}

// ─── Room helpers ────────────────────────────────────────────────────────────

function roomFormatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Room: Setup Panel ───────────────────────────────────────────────────────

interface RoomSetupPanelProps {
  onHost: (nickname: string, myIp: string) => void;
  onJoin: (nickname: string, hostIp: string) => void;
  colors: ColorScheme;
}
function RoomSetupPanel({ onHost, onJoin, colors }: RoomSetupPanelProps) {
  const [nickname, setNickname] = useState('');
  const [hostIp, setHostIp] = useState('');
  const [myIp, setMyIp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const s = useMemo(() => createRoomStyles(colors), [colors]);

  useEffect(() => {
    Network.getIpAddressAsync().then((ip) => setMyIp(ip || '')).catch(() => {});
  }, []);

  const handleHost = async () => {
    const name = nickname.trim() || t('local_chat_survivor');
    setIsLoading(true);
    try { await onHost(name, myIp); } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Failed to start room');
    } finally { setIsLoading(false); }
  };

  const handleJoin = async () => {
    const ip = hostIp.trim();
    if (!ip) { Alert.alert(t('error'), t('local_chat_enter_ip')); return; }
    const name = nickname.trim() || t('local_chat_survivor');
    setIsLoading(true);
    try { await onJoin(name, ip); } catch (e: any) {
      Alert.alert(t('error'), e.message || 'Failed to connect');
    } finally { setIsLoading(false); }
  };

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.setupContainer} showsVerticalScrollIndicator={false}>
      <View style={s.ipBadge}>
        <Ionicons name="wifi" size={14} color={colors.green} />
        <Text style={s.ipText}>{t('local_chat_your_ip')}: {myIp || '...'}</Text>
      </View>
      <View style={s.inputGroup}>
        <Text style={s.inputLabel}>{t('local_chat_nickname')}</Text>
        <TextInput style={s.textInput} value={nickname} onChangeText={setNickname}
          placeholder={t('local_chat_nickname_placeholder')} placeholderTextColor={colors.textDim}
          maxLength={20} autoCapitalize="words" />
      </View>
      <TouchableOpacity style={[s.actionButton, s.hostButton, isLoading && s.buttonDisabled]}
        onPress={handleHost} activeOpacity={0.8} disabled={isLoading}>
        <Ionicons name="radio" size={18} color={colors.bg} />
        <View style={s.buttonTextGroup}>
          <Text style={s.actionButtonText}>{t('local_chat_host')}</Text>
          <Text style={s.actionButtonSub}>{t('local_chat_host_desc')}</Text>
        </View>
      </TouchableOpacity>
      <View style={s.dividerRow}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>{t('local_chat_or')}</Text>
        <View style={s.dividerLine} />
      </View>
      <View style={s.inputGroup}>
        <Text style={s.inputLabel}>{t('local_chat_host_ip')}</Text>
        <TextInput style={s.textInput} value={hostIp} onChangeText={setHostIp}
          placeholder="192.168.1.100" placeholderTextColor={colors.textDim}
          autoCapitalize="none" keyboardType="decimal-pad" />
      </View>
      <TouchableOpacity style={[s.actionButton, s.joinButton, isLoading && s.buttonDisabled]}
        onPress={handleJoin} activeOpacity={0.8} disabled={isLoading}>
        <Ionicons name="enter" size={18} color={colors.bg} />
        <View style={s.buttonTextGroup}>
          <Text style={s.actionButtonText}>{t('local_chat_join')}</Text>
          <Text style={s.actionButtonSub}>{t('local_chat_join_desc')}</Text>
        </View>
      </TouchableOpacity>
      <Text style={s.platformNote}>{t('local_chat_platform_note')}</Text>
    </ScrollView>
  );
}

// ─── Room: Chat View ─────────────────────────────────────────────────────────

interface RoomChatViewProps {
  messages: LocalChatMessage[];
  status: LocalChatStatus;
  onSend: (text: string) => void;
  onDisconnect: () => void;
  myNickname: string;
  colors: ColorScheme;
}
function RoomChatView({ messages, status, onSend, onDisconnect, myNickname, colors }: RoomChatViewProps) {
  const [inputText, setInputText] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const flatRef = useRef<FlatList<LocalChatMessage>>(null);
  const s = useMemo(() => createRoomStyles(colors), [colors]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    onSend(text);
    setInputText('');
  }, [inputText, onSend]);

  const renderMsg = useCallback(({ item }: { item: LocalChatMessage }) => {
    const isMe = item.sender === myNickname;
    const isSystem = item.type === 'system' || item.type === 'join' || item.type === 'leave';
    if (isSystem) {
      const txt = item.type === 'join' ? `${item.sender} ${t('local_chat_joined')}`
        : item.type === 'leave' ? `${item.sender} ${t('local_chat_left')}` : item.text;
      return <View style={s.systemMsgRow}><Text style={s.systemMsgText}>{txt}</Text></View>;
    }
    return (
      <View style={[s.messageRow, isMe ? s.messageRowMe : s.messageRowPeer]}>
        {!isMe && <Text style={s.senderName}>{item.sender}</Text>}
        <View style={[s.messageBubble, isMe ? s.bubbleMe : s.bubblePeer]}>
          <Text style={[s.messageText, isMe ? s.messageTextMe : s.messageTextPeer]}>{item.text}</Text>
          <Text style={s.messageTime}>{roomFormatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  }, [myNickname, s]);

  return (
    <View style={{ flex: 1 }}>
      <View style={s.chatStatusBar}>
        <View style={s.chatStatusLeft}>
          <View style={[s.statusDot, { backgroundColor: colors.green }]} />
          <Text style={s.chatStatusText}>
            {status.role === 'hosting'
              ? `${t('local_chat_hosting')} · ${status.peerCount} ${t('local_chat_peers')}`
              : `${t('local_chat_connected_to')} ${status.hostIp}`}
          </Text>
        </View>
        <TouchableOpacity style={s.disconnectButton} onPress={onDisconnect} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color={colors.red} />
          <Text style={s.disconnectText}>{t('local_chat_leave')}</Text>
        </TouchableOpacity>
      </View>
      <FlatList ref={flatRef} data={messages} renderItem={renderMsg} keyExtractor={(m) => m.id}
        contentContainerStyle={s.messagesList} showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.inputRow, inputFocused && s.inputRowFocused]}>
          <TextInput style={s.chatInput} value={inputText} onChangeText={setInputText}
            placeholder={t('local_chat_send_msg')} placeholderTextColor={colors.textDim}
            multiline maxLength={500}
            onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} />
          <TouchableOpacity
            style={[s.sendButton, inputText.trim().length > 0 && s.sendButtonActive]}
            onPress={handleSend} activeOpacity={0.7} disabled={inputText.trim().length === 0}>
            <Ionicons name="arrow-up" size={20} color={inputText.trim().length > 0 ? colors.bg : colors.textDim} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const locale = useLocale();
  const { colors, isDark, toggleTheme } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', text: t('chat_welcome'), sender: 'ai', timestamp: new Date(), mode: 'knowledge' },
  ]);
  const [inputText, setInputText] = useState('');
  const [currentMode, setCurrentMode] = useState<ChatMode>('knowledge');
  const [isLoading, setIsLoading] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [savedCustomUrl, setSavedCustomUrl] = useState<string | null>(null);
  const [offlineLlmAvailable, setOfflineLlmAvailable] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LlmStatus>({ state: 'idle' });
  const [downloadStatus, setDownloadStatusState] = useState<DownloadStatus>({ state: 'idle' });
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [storageInfo, setStorageInfo] = useState<DeviceStorageInfo | null>(null);
  const [recommendedModelId, setRecommendedModelId] = useState<string>('phi-3-mini');

  // ── Panel switcher (AI vs Room) ───────────────────────────────────────
  const [activePanel, setActivePanel] = useState<ChatPanel>('ai');

  // ── Room state ────────────────────────────────────────────────────────
  const [roomStatus, setRoomStatus] = useState<LocalChatStatus>({ role: 'idle', peerCount: 0 });
  const [roomMessages, setRoomMessages] = useState<LocalChatMessage[]>([]);
  const [myNickname, setMyNickname] = useState('Survivor');

  // ── Conversation / Threads state ──────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [showThreadsDrawer, setShowThreadsDrawer] = useState(false);
  const convRef = useRef<Conversation | null>(null);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // ── Styles (theme-reactive) ───────────────────────────────────────────
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Load conversations on mount ───────────────────────────────────────
  useEffect(() => {
    loadAllConversations().then((convs) => {
      if (convs.length === 0) {
        const newConv = createConversation('knowledge');
        convRef.current = newConv;
        setConversations([newConv]);
        setActiveConvId(newConv.id);
      } else {
        setConversations(convs);
        const latest = convs[0];
        convRef.current = latest;
        setActiveConvId(latest.id);
        if (latest.messages.length > 0) {
          setMessages(latest.messages.map((m) => ({
            id: m.id,
            text: m.text,
            sender: m.sender as 'user' | 'ai',
            timestamp: new Date(m.timestamp),
            mode: m.mode as ChatMode,
          })));
          if (latest.mode) setCurrentMode(latest.mode as ChatMode);
        }
      }
    });
  }, []);

  // ── Auto-save conversation when messages change ───────────────────────
  useEffect(() => {
    const conv = convRef.current;
    if (!conv) return;
    const hasUserMsg = messages.some((m) => m.sender === 'user');
    if (!hasUserMsg) return;

    const convMessages: ConvMessage[] = messages.map((m) => ({
      id: m.id,
      text: m.text,
      sender: m.sender,
      timestamp: m.timestamp.getTime(),
      mode: m.mode,
    }));
    const title = generateTitle(convMessages) || conv.title;
    const updated: Conversation = { ...conv, title, updatedAt: Date.now(), messages: convMessages, mode: currentMode };
    convRef.current = updated;
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      return prev;
    });
    saveConversation(updated);
  }, [messages]);

  // ── Check API key + model + subscriptions on mount ────────────────────
  useEffect(() => {
    checkApiKey();
    checkDownloadedModels();
    loadStorageInfo();

    const unsubLlm = subscribeLlmStatus((status) => {
      setLlmStatus(status);
      setOfflineLlmAvailable(status.state === 'ready');
    });
    const unsubDl = subscribeDownloadStatus((status) => {
      setDownloadStatusState(status);
      if (status.state === 'completed') checkDownloadedModels();
    });
    const unsubRoomStatus = roomSubscribeStatus((s) => setRoomStatus(s));
    const unsubRoomMsgs = roomSubscribeMessages((msg) =>
      setRoomMessages((prev) => [...prev, msg])
    );
    return () => { unsubLlm(); unsubDl(); unsubRoomStatus(); unsubRoomMsgs(); };
  }, []);

  const checkApiKey = async () => {
    const [has, customUrl, customModel] = await Promise.all([hasApiKey('openai'), getCustomServerUrl(), getCustomModel()]);
    setOnlineAvailable(has || !!customUrl);
    setSavedCustomUrl(customUrl);
    if (customUrl) setCustomUrlInput(customUrl);
    if (customModel) setCustomModelInput(customModel);
  };

  const checkDownloadedModels = async () => {
    const downloaded = new Set<string>();
    for (const model of AVAILABLE_MODELS) {
      if (await isModelDownloaded(model)) downloaded.add(model.id);
    }
    setDownloadedModels(downloaded);
    if (downloaded.size > 0 && !isOfflineLlmReady()) initOfflineLlm();
  };

  const loadStorageInfo = async () => {
    const info = await getDeviceStorageInfo();
    setStorageInfo(info);
    setRecommendedModelId(getRecommendedModel(info.freeSpace).id);
  };

  const handleDownloadModel = async (model: ModelInfo) => {
    try { await downloadModel(model); await initOfflineLlm(model); } catch {}
  };

  const handleDeleteModel = async (model: ModelInfo) => {
    await releaseOfflineLlm();
    await deleteModel(model);
    setDownloadedModels((prev) => { const next = new Set(prev); next.delete(model.id); return next; });
    setOfflineLlmAvailable(false);
    if (currentMode === 'offline-llm') setCurrentMode('knowledge');
  };

  // ── Mode options ──────────────────────────────────────────────────────
  const modeOptions = [
    { key: 'knowledge' as ChatMode, label: t('mode_knowledge'), available: true },
    { key: 'offline-llm' as ChatMode, label: t('mode_offline_llm'), available: offlineLlmAvailable || downloadedModels.size > 0 },
    { key: 'online' as ChatMode, label: t('mode_online'), available: onlineAvailable },
  ];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── Send message ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInputText('');
    const userMessage: ChatMessage = { id: generateId(), text: trimmed, sender: 'user', timestamp: new Date(), mode: currentMode };
    setMessages((prev) => [...prev, userMessage]);
    scrollToBottom();
    setIsLoading(true);
    try {
      const response = await getResponse(trimmed, currentMode);
      const aiMessage: ChatMessage = { id: generateId(), text: response, sender: 'ai', timestamp: new Date(), mode: currentMode };
      setMessages((prev) => [...prev, aiMessage]);
      scrollToBottom();
      if (voiceEnabled) { try { await speak(response); } catch {} }
    } catch {
      setMessages((prev) => [...prev, { id: generateId(), text: t('chat_error'), sender: 'ai', timestamp: new Date(), mode: currentMode }]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  }, [currentMode, isLoading, voiceEnabled, scrollToBottom, locale]);

  const handleQuickTopic = useCallback((topic: QuickTopic) => sendMessage(t(topic.questionKey)), [sendMessage, locale]);

  const handleModeChange = useCallback((mode: ChatMode) => {
    if (mode === 'offline-llm') {
      if (downloadedModels.size === 0) { setShowSettings(true); return; }
      if (!isOfflineLlmReady()) initOfflineLlm();
      setCurrentMode(mode); return;
    }
    if (mode === 'online' && !onlineAvailable) { setShowSettings(true); return; }
    setCurrentMode(mode);
    if (mode === 'online') clearChatHistory();
  }, [onlineAvailable, downloadedModels]);

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) { Alert.alert(t('error'), t('api_key_empty')); return; }
    if (!savedCustomUrl && !trimmed.startsWith('sk-')) { Alert.alert(t('error'), t('api_key_invalid_format')); return; }
    await setApiKey('openai', trimmed);
    setOnlineAvailable(true); setApiKeyInput(''); setShowSettings(false); setCurrentMode('online'); clearChatHistory();
    Alert.alert(t('success'), t('api_key_saved'));
  }, [apiKeyInput, savedCustomUrl]);

  const handleSaveCustomServer = useCallback(async () => {
    const url = customUrlInput.trim(); const model = customModelInput.trim();
    await setCustomServerUrl(url); await setCustomModel(model); setSavedCustomUrl(url || null);
    if (url) { setOnlineAvailable(true); setCurrentMode('online'); clearChatHistory(); }
    else { const has = await hasApiKey('openai'); setOnlineAvailable(has); }
    setShowSettings(false);
    Alert.alert(t('success'), url ? t('custom_server_saved') : t('custom_server_cleared'));
  }, [customUrlInput, customModelInput]);

  const handleRemoveApiKey = useCallback(async () => {
    await setApiKey('openai', '');
    setOnlineAvailable(false);
    if (currentMode === 'online') setCurrentMode('knowledge');
    setApiKeyInput(''); setShowSettings(false); clearChatHistory();
  }, [currentMode]);

  const toggleVoice = useCallback(() => { if (voiceEnabled) stopSpeaking(); setVoiceEnabled((p) => !p); }, [voiceEnabled]);

  const toggleListening = useCallback(() => {
    if (isListening) { setIsListening(false); return; }
    setIsListening(true);
    setTimeout(() => { setIsListening(false); Alert.alert(t('voice_input'), t('voice_coming_soon'), [{ text: t('ok') }]); }, 2000);
  }, [isListening, locale]);

  // ── Thread handlers ───────────────────────────────────────────────────
  const handleNewThread = useCallback(() => {
    const newConv = createConversation(currentMode);
    convRef.current = newConv;
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setMessages([{ id: 'welcome', text: t('chat_welcome'), sender: 'ai', timestamp: new Date(), mode: 'knowledge' }]);
    clearChatHistory();
    setShowThreadsDrawer(false);
  }, [currentMode, locale]);

  const handleSelectThread = useCallback((conv: Conversation) => {
    convRef.current = conv;
    setActiveConvId(conv.id);
    if (conv.messages.length > 0) {
      setMessages(conv.messages.map((m) => ({ id: m.id, text: m.text, sender: m.sender as 'user' | 'ai', timestamp: new Date(m.timestamp), mode: m.mode as ChatMode })));
    } else {
      setMessages([{ id: 'welcome', text: t('chat_welcome'), sender: 'ai', timestamp: new Date(), mode: 'knowledge' }]);
    }
    if (conv.mode) setCurrentMode(conv.mode as ChatMode);
    clearChatHistory();
    setShowThreadsDrawer(false);
  }, [locale]);

  const handleDeleteThread = useCallback((conv: Conversation) => {
    Alert.alert(t('thread_delete'), t('thread_delete_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('thread_delete'), style: 'destructive',
        onPress: async () => {
          await deleteConversation(conv.id);
          setConversations((prev) => {
            const next = prev.filter((c) => c.id !== conv.id);
            if (conv.id === activeConvId) {
              if (next.length > 0) handleSelectThread(next[0]);
              else handleNewThread();
            }
            return next;
          });
        },
      },
    ]);
  }, [activeConvId, handleSelectThread, handleNewThread, locale]);

  // ── Room handlers ─────────────────────────────────────────────────────
  const handleRoomHost = useCallback(async (nickname: string, myIp: string) => {
    setMyNickname(nickname); setRoomMessages([]); await hostRoom(nickname, myIp);
  }, []);

  const handleRoomJoin = useCallback(async (nickname: string, hostIp: string) => {
    setMyNickname(nickname); setRoomMessages([]); await joinRoom(nickname, hostIp);
  }, []);

  const handleRoomSend = useCallback((text: string) => { roomSendMessage(text); }, []);

  const handleRoomDisconnect = useCallback(() => {
    Alert.alert(t('local_chat_leave_title'), t('local_chat_leave_confirm'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('local_chat_leave'), style: 'destructive', onPress: () => roomDisconnect() },
    ]);
  }, [locale]);

  // ── Render message ────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAi]}>
        {!isUser && (
          <View style={styles.aiIcon}>
            <Ionicons name="hardware-chip" size={14} color={colors.amber} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.aiMessageText]}>{item.text}</Text>
          <Text style={[styles.messageTimestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>{formatTime(item.timestamp)}</Text>
        </View>
      </View>
    );
  }, [styles, colors]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // ── Current conversation title ────────────────────────────────────────
  const currentConvTitle = useMemo(() => {
    const c = conversations.find((c) => c.id === activeConvId);
    return c?.title || t('thread_new');
  }, [conversations, activeConvId, locale]);

  const isRoomActive = roomStatus.role !== 'idle';

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* ── Threads Drawer ───────────────────────────────────────────── */}
      <ThreadsDrawer
        visible={showThreadsDrawer}
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={handleSelectThread}
        onDelete={handleDeleteThread}
        onNew={handleNewThread}
        onClose={() => setShowThreadsDrawer(false)}
        colors={colors}
      />

      {/* ── Segment Bar ──────────────────────────────────────────────── */}
      <SegBar active={activePanel} onSelect={setActivePanel} colors={colors} />

      {/* ══ AI PANEL ════════════════════════════════════════════════════ */}
      <KeyboardAvoidingView
        style={[styles.container, activePanel !== 'ai' && { display: 'none' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              {/* Threads button */}
              <TouchableOpacity style={styles.threadsButton} onPress={() => setShowThreadsDrawer(true)} activeOpacity={0.7}>
                <Ionicons name="menu" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.headerAccent} />
              <View>
                <Text style={styles.headerTitle}>{t('ai_assistant')}</Text>
                {conversations.length > 0 && (
                  <Text style={styles.headerSubtitle} numberOfLines={1}>{currentConvTitle}</Text>
                )}
              </View>
            </View>
            <View style={styles.headerActions}>
              {/* New thread button */}
              <TouchableOpacity style={styles.headerButton} onPress={handleNewThread} activeOpacity={0.7}>
                <Ionicons name="add" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {/* Theme toggle */}
              <TouchableOpacity style={styles.headerButton} onPress={toggleTheme} activeOpacity={0.7}>
                <Ionicons name={isDark ? 'sunny' : 'moon'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerButton, voiceEnabled && styles.headerButtonActive]} onPress={toggleVoice} activeOpacity={0.7}>
                <Ionicons name={voiceEnabled ? 'volume-high' : 'volume-mute'} size={18} color={voiceEnabled ? colors.amber : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerButton, onlineAvailable && styles.headerButtonActive]} onPress={() => setShowSettings(true)} activeOpacity={0.7}>
                <Ionicons name="settings-sharp" size={18} color={onlineAvailable ? colors.green : colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            {modeOptions.map((mode) => {
              const isActive = currentMode === mode.key;
              return (
                <TouchableOpacity key={mode.key} style={[styles.modePill, isActive && styles.modePillActive, mode.key === 'online' && onlineAvailable && styles.modePillOnline]} onPress={() => handleModeChange(mode.key)} activeOpacity={0.7}>
                  {mode.key === 'offline-llm' && <Ionicons name="hardware-chip" size={12} color={isActive ? colors.cyan : downloadedModels.size > 0 ? colors.cyan : colors.textDim} />}
                  {mode.key === 'online' && <Ionicons name="cloud" size={12} color={isActive ? colors.green : onlineAvailable ? colors.green : colors.textDim} />}
                  <Text style={[styles.modePillText, isActive && styles.modePillTextActive, mode.key === 'online' && isActive && { color: colors.green }]}>{mode.label}</Text>
                  {mode.key === 'offline-llm' && downloadedModels.size === 0 && <View style={styles.setupBadge}><Text style={styles.setupBadgeText}>{t('setup')}</Text></View>}
                  {mode.key === 'offline-llm' && llmStatus.state === 'loading' && <View style={styles.comingSoonBadge}><Text style={styles.comingSoonText}>{Math.round((llmStatus as any).progress * 100)}%</Text></View>}
                  {mode.key === 'online' && !onlineAvailable && <View style={styles.setupBadge}><Text style={styles.setupBadgeText}>{t('setup')}</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Messages ───────────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={isLoading ? <TypingIndicator colors={colors} /> : null}
        />

        {/* ── Quick Topics ───────────────────────────────────────────── */}
        <View style={styles.quickTopicsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickTopicsScroll}>
            {QUICK_TOPICS.map((topic) => (
              <TouchableOpacity key={topic.labelKey} style={styles.topicChip} onPress={() => handleQuickTopic(topic)} activeOpacity={0.7} disabled={isLoading}>
                <Ionicons name={topic.icon} size={12} color={colors.amber} />
                <Text style={styles.topicChipText}>{t(topic.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Input Area ─────────────────────────────────────────────── */}
        <View style={styles.inputArea}>
          {isListening && (
            <View style={styles.listeningBar}>
              <PulsingIndicator color={colors.red} />
              <Text style={styles.listeningText}>{t('listening')}</Text>
              <TouchableOpacity onPress={toggleListening} activeOpacity={0.7}>
                <Text style={styles.listeningCancel}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={[styles.micButton, isListening && styles.micButtonActive]} onPress={toggleListening} activeOpacity={0.7} disabled={isLoading}>
              <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={20} color={isListening ? colors.red : colors.textSecondary} />
            </TouchableOpacity>
            <View style={[styles.inputWrapper, inputFocused && styles.inputWrapperFocused]}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('chat_placeholder')}
                placeholderTextColor={colors.textDim}
                multiline maxLength={1000}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onSubmitEditing={() => sendMessage(inputText)}
                blurOnSubmit={false}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              style={[styles.sendButton, inputText.trim().length > 0 && !isLoading ? styles.sendButtonActive : styles.sendButtonDisabled]}
              onPress={() => sendMessage(inputText)} activeOpacity={0.7}
              disabled={inputText.trim().length === 0 || isLoading}
            >
              <Ionicons name="arrow-up" size={20} color={inputText.trim().length > 0 && !isLoading ? colors.bg : colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Settings Modal ─────────────────────────────────────────── */}
        <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('settings_title')}</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Theme Section */}
                <View style={styles.settingsSection}>
                  <View style={styles.settingsSectionHeader}>
                    <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.amber} />
                    <Text style={styles.settingsSectionTitle}>{t('theme_mode')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
                    {(['light', 'dark', 'system'] as const).map((mode) => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => {/* handled by toggleTheme in header */}}
                        style={[styles.modePill, isDark === (mode === 'dark') && styles.modePillActive]}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={mode === 'light' ? 'sunny' : mode === 'dark' ? 'moon' : 'phone-portrait'} size={12} color={colors.amber} />
                        <Text style={[styles.modePillText, isDark === (mode === 'dark') && styles.modePillTextActive]}>
                          {t(`theme_${mode}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Online AI Section */}
                <View style={styles.settingsSection}>
                  <View style={styles.settingsSectionHeader}>
                    <Ionicons name="cloud" size={20} color={colors.green} />
                    <Text style={styles.settingsSectionTitle}>{t('online_ai_chatgpt')}</Text>
                  </View>
                  <Text style={styles.settingsDescription}>{t('api_key_description')}</Text>
                  {onlineAvailable ? (
                    <View style={styles.apiKeyStatus}>
                      <View style={styles.apiKeyStatusRow}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.green} />
                        <Text style={styles.apiKeyStatusText}>{t('api_key_configured')}</Text>
                      </View>
                      <TouchableOpacity style={styles.removeKeyButton} onPress={handleRemoveApiKey} activeOpacity={0.7}>
                        <Ionicons name="trash-outline" size={16} color={colors.red} />
                        <Text style={styles.removeKeyText}>{t('remove_key')}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.apiKeyInput}>
                      <TextInput style={styles.apiKeyTextInput} value={apiKeyInput} onChangeText={setApiKeyInput}
                        placeholder="sk-proj-..." placeholderTextColor={colors.textDim}
                        secureTextEntry autoCapitalize="none" autoCorrect={false} />
                      <TouchableOpacity style={[styles.saveKeyButton, apiKeyInput.trim().length > 0 && styles.saveKeyButtonActive]}
                        onPress={handleSaveApiKey} activeOpacity={0.7} disabled={apiKeyInput.trim().length === 0}>
                        <Text style={[styles.saveKeyText, apiKeyInput.trim().length > 0 && styles.saveKeyTextActive]}>{t('save')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <Text style={styles.securityNote}>{t('api_key_security_note')}</Text>
                </View>

                {/* Custom Server Section */}
                <View style={styles.settingsSection}>
                  <View style={styles.settingsSectionHeader}>
                    <Ionicons name="server" size={20} color={colors.amber} />
                    <Text style={styles.settingsSectionTitle}>{t('custom_server_title')}</Text>
                  </View>
                  <Text style={styles.settingsDescription}>{t('custom_server_desc')}</Text>
                  {savedCustomUrl ? (
                    <View style={styles.apiKeyStatus}>
                      <View style={styles.apiKeyStatusRow}>
                        <Ionicons name="checkmark-circle" size={18} color={colors.amber} />
                        <Text style={[styles.apiKeyStatusText, { color: colors.amber, flex: 1 }]} numberOfLines={1}>{savedCustomUrl}</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.apiKeyInput}>
                    <TextInput style={[styles.apiKeyTextInput, { marginBottom: Spacing.sm }]}
                      value={customUrlInput} onChangeText={setCustomUrlInput}
                      placeholder={t('custom_server_placeholder')} placeholderTextColor={colors.textDim}
                      autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                    <TextInput style={styles.apiKeyTextInput}
                      value={customModelInput} onChangeText={setCustomModelInput}
                      placeholder={t('custom_model_placeholder')} placeholderTextColor={colors.textDim}
                      autoCapitalize="none" autoCorrect={false} />
                  </View>
                  <TouchableOpacity style={[styles.saveKeyButton, styles.saveKeyButtonActive, { marginTop: Spacing.md, alignSelf: 'flex-start' }]}
                    onPress={handleSaveCustomServer} activeOpacity={0.7}>
                    <Text style={styles.saveKeyTextActive}>{t('save')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Offline AI Model Section */}
                <View style={styles.settingsSection}>
                  <View style={styles.settingsSectionHeader}>
                    <Ionicons name="hardware-chip" size={20} color={colors.cyan} />
                    <Text style={styles.settingsSectionTitle}>{t('offline_ai_model')}</Text>
                  </View>
                  <Text style={styles.settingsDescription}>{t('model_download_desc')}</Text>
                  {llmStatus.state === 'ready' && (
                    <View style={styles.apiKeyStatus}>
                      <View style={styles.apiKeyStatusRow}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.cyan} />
                        <Text style={[styles.apiKeyStatusText, { color: colors.cyan }]}>{t('model_ready')}: {(llmStatus as any).modelName}</Text>
                      </View>
                    </View>
                  )}
                  {llmStatus.state === 'loading' && (
                    <View style={styles.modelProgressContainer}>
                      <Text style={styles.modelProgressText}>{t('model_loading')}</Text>
                      <View style={styles.modelProgressBar}>
                        <View style={[styles.modelProgressFill, { width: `${Math.round((llmStatus as any).progress * 100)}%` }]} />
                      </View>
                    </View>
                  )}
                  {storageInfo && (
                    <View style={styles.storageInfoRow}>
                      <Ionicons name="phone-portrait-outline" size={14} color={colors.textDim} />
                      <Text style={styles.storageInfoText}>Free: {storageInfo.freeSpaceLabel}</Text>
                    </View>
                  )}
                  {AVAILABLE_MODELS.map((model) => {
                    const isDownloaded = downloadedModels.has(model.id);
                    const isCurrentlyDownloading = downloadStatus.state === 'downloading';
                    const fits = !storageInfo || modelFitsOnDevice(model, storageInfo.freeSpace);
                    const isRecommended = model.id === recommendedModelId;
                    return (
                      <View key={model.id} style={[styles.modelCard, !fits && !isDownloaded && styles.modelCardDisabled]}>
                        <View style={styles.modelCardHeader}>
                          <View style={styles.modelNameRow}>
                            <Text style={[styles.modelName, !fits && !isDownloaded && { color: colors.textDim }]}>{model.name}</Text>
                            {isRecommended && <View style={styles.recommendedBadge}><Text style={styles.recommendedText}>{t('recommended')}</Text></View>}
                            {isDownloaded && <View style={[styles.recommendedBadge, { backgroundColor: `${colors.cyan}20` }]}><Text style={[styles.recommendedText, { color: colors.cyan }]}>{t('downloaded')}</Text></View>}
                          </View>
                          <Text style={styles.modelDesc}>{model.description}</Text>
                          <View style={styles.modelStats}>
                            <Text style={styles.modelStat}>{model.sizeLabel}</Text>
                            <Text style={styles.modelStatDivider}>|</Text>
                            <Text style={styles.modelStat}>{t('ram')}: {model.ramRequired}</Text>
                            <Text style={styles.modelStatDivider}>|</Text>
                            <Text style={styles.modelStat}>{model.quantization}</Text>
                          </View>
                        </View>
                        <View style={styles.modelCardActions}>
                          {isDownloaded ? (
                            <TouchableOpacity style={styles.modelDeleteButton} onPress={() => handleDeleteModel(model)} activeOpacity={0.7}>
                              <Ionicons name="trash-outline" size={14} color={colors.red} />
                              <Text style={styles.modelDeleteText}>{t('delete_model')}</Text>
                            </TouchableOpacity>
                          ) : isCurrentlyDownloading ? (
                            <View style={styles.modelDownloadingRow}>
                              <View style={styles.modelMiniProgress}><View style={[styles.modelMiniProgressFill, { width: `${Math.round((downloadStatus as any).progress * 100)}%` }]} /></View>
                              <Text style={styles.modelDownloadingText}>{Math.round((downloadStatus as any).progress * 100)}%</Text>
                              <TouchableOpacity onPress={cancelDownload} activeOpacity={0.7}><Ionicons name="close-circle" size={18} color={colors.red} /></TouchableOpacity>
                            </View>
                          ) : fits ? (
                            <TouchableOpacity style={styles.modelDownloadButton} onPress={() => handleDownloadModel(model)} activeOpacity={0.7}>
                              <Ionicons name="cloud-download" size={14} color={colors.cyan} />
                              <Text style={styles.modelDownloadText}>{t('download')}</Text>
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.modelNoSpaceRow}>
                              <Ionicons name="alert-circle" size={14} color={colors.textDim} />
                              <Text style={styles.modelNoSpaceText}>Not enough space</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* About Modes */}
                <View style={styles.settingsSection}>
                  <View style={styles.settingsSectionHeader}>
                    <Ionicons name="information-circle" size={20} color={colors.amber} />
                    <Text style={styles.settingsSectionTitle}>{t('about_modes')}</Text>
                  </View>
                  <View style={styles.modeInfoList}>
                    {[{ color: colors.amber, label: t('mode_knowledge'), desc: t('mode_knowledge_desc') },
                      { color: colors.cyan, label: t('mode_offline_llm'), desc: t('mode_offline_llm_desc') },
                      { color: colors.green, label: t('mode_online'), desc: t('mode_online_desc') }].map((item) => (
                      <View key={item.label} style={styles.modeInfoItem}>
                        <View style={[styles.modeInfoDot, { backgroundColor: item.color }]} />
                        <View style={styles.modeInfoTextContainer}>
                          <Text style={styles.modeInfoLabel}>{item.label}</Text>
                          <Text style={styles.modeInfoDesc}>{item.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>

      {/* ══ ROOM PANEL ══════════════════════════════════════════════════ */}
      <View style={[{ flex: 1, backgroundColor: colors.bg }, activePanel !== 'room' && { display: 'none' }]}>
        {isRoomActive ? (
          <RoomChatView messages={roomMessages} status={roomStatus} onSend={handleRoomSend} onDisconnect={handleRoomDisconnect} myNickname={myNickname} colors={colors} />
        ) : (
          <RoomSetupPanel onHost={handleRoomHost} onJoin={handleRoomJoin} colors={colors} />
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Style factories ─────────────────────────────────────────────────────────

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },

    // Header
    header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    threadsButton: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, marginRight: Spacing.sm },
    headerAccent: { width: 3, height: 22, backgroundColor: c.amber, borderRadius: 2, marginRight: Spacing.sm },
    headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: c.text, letterSpacing: 3 },
    headerSubtitle: { fontSize: FontSize.xs, color: c.textDim, letterSpacing: 0.5, maxWidth: 140 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    headerButton: { width: 36, height: 36, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    headerButtonActive: { borderColor: c.amber, backgroundColor: `${c.amber}15` },

    // Mode Selector
    modeSelector: { flexDirection: 'row', gap: Spacing.sm },
    modePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, gap: Spacing.xs },
    modePillActive: { backgroundColor: `${c.amber}20`, borderColor: c.amber },
    modePillOnline: { borderColor: `${c.green}40` },
    modePillText: { fontSize: FontSize.xs, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.5 },
    modePillTextActive: { color: c.amber },
    comingSoonBadge: { backgroundColor: c.bgCardHover, paddingHorizontal: Spacing.xs + 2, paddingVertical: 1, borderRadius: BorderRadius.sm },
    comingSoonText: { fontSize: 8, fontWeight: '700', color: c.textDim, letterSpacing: 0.5 },
    setupBadge: { backgroundColor: `${c.green}20`, paddingHorizontal: Spacing.xs + 2, paddingVertical: 1, borderRadius: BorderRadius.sm },
    setupBadgeText: { fontSize: 8, fontWeight: '700', color: c.green, letterSpacing: 0.5 },

    // Messages
    messagesList: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
    messageRow: { flexDirection: 'row', marginBottom: Spacing.md, maxWidth: '85%' },
    messageRowUser: { alignSelf: 'flex-end' },
    messageRowAi: { alignSelf: 'flex-start' },
    aiIcon: { width: 28, height: 28, borderRadius: BorderRadius.full, backgroundColor: `${c.amber}15`, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm, marginTop: Spacing.xs, borderWidth: 1, borderColor: `${c.amber}30` },
    messageBubble: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, flex: 1 },
    userBubble: { backgroundColor: c.amber, borderBottomRightRadius: BorderRadius.sm },
    aiBubble: { backgroundColor: c.bgCard, borderBottomLeftRadius: BorderRadius.sm, borderWidth: 1, borderColor: c.border },
    messageText: { fontSize: FontSize.md, lineHeight: 20 },
    userMessageText: { color: c.bg },
    aiMessageText: { color: c.text },
    messageTimestamp: { fontSize: FontSize.xs, marginTop: Spacing.xs },
    userTimestamp: { color: `${c.bg}80`, textAlign: 'right' },
    aiTimestamp: { color: c.textDim },

    // Quick Topics
    quickTopicsContainer: { borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    quickTopicsScroll: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, gap: Spacing.sm },
    topicChip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    topicChipText: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '600' },

    // Input Area
    inputArea: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    listeningBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.sm, backgroundColor: `${c.red}15`, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: `${c.red}40`, gap: Spacing.sm },
    listeningText: { flex: 1, fontSize: FontSize.sm, color: c.red, fontWeight: '600' },
    listeningCancel: { fontSize: FontSize.sm, color: c.textSecondary, fontWeight: '600' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
    micButton: { width: 44, height: 44, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border },
    micButtonActive: { backgroundColor: `${c.red}15`, borderColor: c.red },
    inputWrapper: { flex: 1, backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: c.border, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, minHeight: 44, justifyContent: 'center' },
    inputWrapperFocused: { borderColor: c.amber },
    textInput: { fontSize: FontSize.md, color: c.text, maxHeight: 120 },
    sendButton: { width: 44, height: 44, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
    sendButtonActive: { backgroundColor: c.amber },
    sendButtonDisabled: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },

    // Settings Modal
    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: c.bg, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: 40, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xl },
    modalTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: c.text, letterSpacing: 2 },
    settingsSection: { marginBottom: Spacing.xl, padding: Spacing.lg, backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: c.border },
    settingsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    settingsSectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: c.text },
    settingsDescription: { fontSize: FontSize.sm, color: c.textSecondary, lineHeight: 18, marginBottom: Spacing.md },
    apiKeyStatus: { marginBottom: Spacing.md },
    apiKeyStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    apiKeyStatusText: { fontSize: FontSize.sm, color: c.green, fontWeight: '600' },
    removeKeyButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    removeKeyText: { fontSize: FontSize.sm, color: c.red, fontWeight: '600' },
    apiKeyInput: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    apiKeyTextInput: { flex: 1, backgroundColor: c.bgSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.sm, color: c.text, borderWidth: 1, borderColor: c.border },
    saveKeyButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: c.bgSecondary, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
    saveKeyButtonActive: { backgroundColor: c.amber, borderColor: c.amber },
    saveKeyText: { fontSize: FontSize.sm, fontWeight: '700', color: c.textDim },
    saveKeyTextActive: { color: c.bg },
    securityNote: { fontSize: FontSize.xs, color: c.textDim, lineHeight: 16 },

    // Model cards
    modelProgressContainer: { marginBottom: Spacing.md },
    modelProgressText: { fontSize: FontSize.sm, color: c.textSecondary, marginBottom: Spacing.xs },
    modelProgressBar: { height: 4, backgroundColor: c.bgSecondary, borderRadius: 2, overflow: 'hidden' },
    modelProgressFill: { height: '100%', backgroundColor: c.cyan },
    storageInfoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.md },
    storageInfoText: { fontSize: FontSize.xs, color: c.textDim },
    modelCard: { backgroundColor: c.bgSecondary, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: c.border },
    modelCardDisabled: { opacity: 0.5 },
    modelCardHeader: { marginBottom: Spacing.sm },
    modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs, flexWrap: 'wrap' },
    modelName: { fontSize: FontSize.md, fontWeight: '700', color: c.text },
    recommendedBadge: { backgroundColor: `${c.amber}20`, paddingHorizontal: Spacing.xs + 2, paddingVertical: 2, borderRadius: BorderRadius.sm },
    recommendedText: { fontSize: 9, fontWeight: '700', color: c.amber },
    modelDesc: { fontSize: FontSize.xs, color: c.textSecondary, lineHeight: 16, marginBottom: Spacing.xs },
    modelStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    modelStat: { fontSize: FontSize.xs, color: c.textDim },
    modelStatDivider: { fontSize: FontSize.xs, color: c.textDim },
    modelCardActions: { flexDirection: 'row', alignItems: 'center' },
    modelDownloadButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: `${c.cyan}20`, borderWidth: 1, borderColor: `${c.cyan}40` },
    modelDownloadText: { fontSize: FontSize.xs, fontWeight: '700', color: c.cyan },
    modelDeleteButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: `${c.red}10`, borderWidth: 1, borderColor: `${c.red}30` },
    modelDeleteText: { fontSize: FontSize.xs, fontWeight: '700', color: c.red },
    modelDownloadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    modelMiniProgress: { flex: 1, height: 4, backgroundColor: c.bgCard, borderRadius: 2, overflow: 'hidden' },
    modelMiniProgressFill: { height: '100%', backgroundColor: c.cyan },
    modelDownloadingText: { fontSize: FontSize.xs, color: c.textSecondary, fontWeight: '600', minWidth: 36 },
    modelNoSpaceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    modelNoSpaceText: { fontSize: FontSize.xs, color: c.textDim },

    // About modes
    modeInfoList: { gap: Spacing.md },
    modeInfoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
    modeInfoDot: { width: 10, height: 10, borderRadius: BorderRadius.full, marginTop: 3 },
    modeInfoTextContainer: { flex: 1 },
    modeInfoLabel: { fontSize: FontSize.sm, fontWeight: '700', color: c.text, marginBottom: 2 },
    modeInfoDesc: { fontSize: FontSize.xs, color: c.textSecondary, lineHeight: 16 },
  });
}

// ─── Room style factory ───────────────────────────────────────────────────────

function createRoomStyles(c: ColorScheme) {
  return StyleSheet.create({
    setupContainer: { padding: Spacing.xl, gap: Spacing.lg },
    ipBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: `${c.green}15`, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: `${c.green}30`, alignSelf: 'flex-start' },
    ipText: { fontSize: FontSize.sm, color: c.green, fontWeight: '600' },
    inputGroup: { gap: Spacing.xs },
    inputLabel: { fontSize: FontSize.sm, fontWeight: '700', color: c.textSecondary, letterSpacing: 0.5 },
    textInput: { backgroundColor: c.bgCard, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md, color: c.text, borderWidth: 1, borderColor: c.border },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg },
    hostButton: { backgroundColor: c.amber },
    joinButton: { backgroundColor: c.green },
    buttonDisabled: { opacity: 0.5 },
    buttonTextGroup: { flex: 1 },
    actionButtonText: { fontSize: FontSize.md, fontWeight: '800', color: c.bg, letterSpacing: 0.5 },
    actionButtonSub: { fontSize: FontSize.xs, color: `${c.bg}CC`, marginTop: 2 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
    dividerText: { fontSize: FontSize.xs, color: c.textDim, fontWeight: '600' },
    platformNote: { fontSize: FontSize.xs, color: c.textDim, textAlign: 'center', lineHeight: 16 },
    chatStatusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.sm, backgroundColor: `${c.green}10`, borderBottomWidth: 1, borderBottomColor: `${c.green}20` },
    chatStatusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    chatStatusText: { fontSize: FontSize.xs, fontWeight: '600', color: c.green },
    disconnectButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    disconnectText: { fontSize: FontSize.xs, fontWeight: '700', color: c.red },
    messagesList: { padding: Spacing.lg, gap: Spacing.sm },
    messageRow: { maxWidth: '80%', gap: Spacing.xs },
    messageRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
    messageRowPeer: { alignSelf: 'flex-start', alignItems: 'flex-start' },
    senderName: { fontSize: FontSize.xs, fontWeight: '700', color: c.amber, marginLeft: Spacing.sm },
    messageBubble: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
    bubbleMe: { backgroundColor: c.amber, borderBottomRightRadius: BorderRadius.sm },
    bubblePeer: { backgroundColor: c.bgCard, borderBottomLeftRadius: BorderRadius.sm, borderWidth: 1, borderColor: c.border },
    messageText: { fontSize: FontSize.md, lineHeight: 20 },
    messageTextMe: { color: c.bg },
    messageTextPeer: { color: c.text },
    messageTime: { fontSize: FontSize.xs, marginTop: 4, color: `${c.bg}80` },
    systemMsgRow: { alignItems: 'center', paddingVertical: Spacing.xs },
    systemMsgText: { fontSize: FontSize.xs, color: c.textDim, fontStyle: 'italic' },
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg },
    inputRowFocused: { borderTopColor: c.amber },
    chatInput: { flex: 1, backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.md, color: c.text, borderWidth: 1, borderColor: c.border, maxHeight: 100 },
    sendButton: { width: 44, height: 44, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    sendButtonActive: { backgroundColor: c.amber, borderColor: c.amber },
  });
}
