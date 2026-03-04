import React, { useState, useRef, useCallback, useEffect } from 'react';
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
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
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

// ─── Pulsing Mic Indicator Component ────────────────────────────────────────

function PulsingIndicator() {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.pulsingDot,
        { transform: [{ scale: pulseAnim }] },
      ]}
    />
  );
}

// ─── Typing Indicator Component ─────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createDotAnimation = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );

    const anim1 = createDotAnimation(dot1, 0);
    const anim2 = createDotAnimation(dot2, 200);
    const anim3 = createDotAnimation(dot3, 400);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [
      {
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
      },
    ],
  });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.aiIconSmall}>
        <Ionicons name="hardware-chip" size={12} color={Colors.amber} />
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.typingDots}>
          <Animated.View style={[styles.typingDot, dotStyle(dot1)]} />
          <Animated.View style={[styles.typingDot, dotStyle(dot2)]} />
          <Animated.View style={[styles.typingDot, dotStyle(dot3)]} />
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      text: t('chat_welcome'),
      sender: 'ai',
      timestamp: new Date(),
      mode: 'knowledge',
    },
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

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // ─── Check API key + model on mount ──────────────────────────────────
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
      if (status.state === 'completed') {
        checkDownloadedModels();
      }
    });

    return () => {
      unsubLlm();
      unsubDl();
    };
  }, []);

  const checkApiKey = async () => {
    const [has, customUrl, customModel] = await Promise.all([
      hasApiKey('openai'),
      getCustomServerUrl(),
      getCustomModel(),
    ]);
    setOnlineAvailable(has || !!customUrl);
    setSavedCustomUrl(customUrl);
    if (customUrl) setCustomUrlInput(customUrl);
    if (customModel) setCustomModelInput(customModel);
  };

  const checkDownloadedModels = async () => {
    const downloaded = new Set<string>();
    for (const model of AVAILABLE_MODELS) {
      if (await isModelDownloaded(model)) {
        downloaded.add(model.id);
      }
    }
    setDownloadedModels(downloaded);
    if (downloaded.size > 0 && !isOfflineLlmReady()) {
      // Auto-init if model is downloaded
      initOfflineLlm();
    }
  };

  const loadStorageInfo = async () => {
    const info = await getDeviceStorageInfo();
    setStorageInfo(info);
    const recommended = getRecommendedModel(info.freeSpace);
    setRecommendedModelId(recommended.id);
  };

  const handleDownloadModel = async (model: ModelInfo) => {
    try {
      await downloadModel(model);
      await initOfflineLlm(model);
    } catch {
      // Error handled by download status listener
    }
  };

  const handleDeleteModel = async (model: ModelInfo) => {
    await releaseOfflineLlm();
    await deleteModel(model);
    setDownloadedModels((prev) => {
      const next = new Set(prev);
      next.delete(model.id);
      return next;
    });
    setOfflineLlmAvailable(false);
    if (currentMode === 'offline-llm') {
      setCurrentMode('knowledge');
    }
  };

  // ─── Build mode options dynamically ──────────────────────────────────
  const modeOptions = [
    { key: 'knowledge' as ChatMode, label: t('mode_knowledge'), available: true },
    { key: 'offline-llm' as ChatMode, label: t('mode_offline_llm'), available: offlineLlmAvailable || downloadedModels.size > 0 },
    { key: 'online' as ChatMode, label: t('mode_online'), available: onlineAvailable },
  ];

  // ─── Scroll to bottom ──────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // ─── Send message ─────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setInputText('');

      const userMessage: ChatMessage = {
        id: generateId(),
        text: trimmed,
        sender: 'user',
        timestamp: new Date(),
        mode: currentMode,
      };

      setMessages((prev) => [...prev, userMessage]);
      scrollToBottom();
      setIsLoading(true);

      try {
        const response = await getResponse(trimmed, currentMode);

        const aiMessage: ChatMessage = {
          id: generateId(),
          text: response,
          sender: 'ai',
          timestamp: new Date(),
          mode: currentMode,
        };

        setMessages((prev) => [...prev, aiMessage]);
        scrollToBottom();

        if (voiceEnabled) {
          try {
            await speak(response);
          } catch {
            // Silently fail if TTS errors
          }
        }
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: generateId(),
          text: t('chat_error'),
          sender: 'ai',
          timestamp: new Date(),
          mode: currentMode,
        };
        setMessages((prev) => [...prev, errorMessage]);
        scrollToBottom();
      } finally {
        setIsLoading(false);
      }
    },
    [currentMode, isLoading, voiceEnabled, scrollToBottom, locale]
  );

  // ─── Quick topic handler ──────────────────────────────────────────────

  const handleQuickTopic = useCallback(
    (topic: QuickTopic) => {
      sendMessage(t(topic.questionKey));
    },
    [sendMessage, locale]
  );

  // ─── Mode selection ───────────────────────────────────────────────────

  const handleModeChange = useCallback((mode: ChatMode) => {
    if (mode === 'offline-llm') {
      if (downloadedModels.size === 0) {
        setShowSettings(true);
        return;
      }
      if (!isOfflineLlmReady()) {
        initOfflineLlm();
      }
      setCurrentMode(mode);
      return;
    }
    if (mode === 'online' && !onlineAvailable) {
      setShowSettings(true);
      return;
    }
    setCurrentMode(mode);
    if (mode === 'online') {
      clearChatHistory();
    }
  }, [onlineAvailable, downloadedModels]);

  // ─── Save API key ─────────────────────────────────────────────────────

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      Alert.alert(t('error'), t('api_key_empty'));
      return;
    }
    // Only enforce sk- format when no custom server is configured
    if (!savedCustomUrl && !trimmed.startsWith('sk-')) {
      Alert.alert(t('error'), t('api_key_invalid_format'));
      return;
    }

    await setApiKey('openai', trimmed);
    setOnlineAvailable(true);
    setApiKeyInput('');
    setShowSettings(false);
    setCurrentMode('online');
    clearChatHistory();

    Alert.alert(t('success'), t('api_key_saved'));
  }, [apiKeyInput, savedCustomUrl]);

  const handleSaveCustomServer = useCallback(async () => {
    const url = customUrlInput.trim();
    const model = customModelInput.trim();
    await setCustomServerUrl(url);
    await setCustomModel(model);
    setSavedCustomUrl(url || null);
    if (url) {
      setOnlineAvailable(true);
      setCurrentMode('online');
      clearChatHistory();
    } else {
      const has = await hasApiKey('openai');
      setOnlineAvailable(has);
    }
    setShowSettings(false);
    Alert.alert(t('success'), url ? t('custom_server_saved') : t('custom_server_cleared'));
  }, [customUrlInput, customModelInput]);

  const handleRemoveApiKey = useCallback(async () => {
    await setApiKey('openai', '');
    setOnlineAvailable(false);
    if (currentMode === 'online') {
      setCurrentMode('knowledge');
    }
    setApiKeyInput('');
    setShowSettings(false);
    clearChatHistory();
  }, [currentMode]);

  // ─── Voice toggle ─────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    if (voiceEnabled) {
      stopSpeaking();
    }
    setVoiceEnabled((prev) => !prev);
  }, [voiceEnabled]);

  // ─── Mic toggle (placeholder) ─────────────────────────────────────────

  const toggleListening = useCallback(() => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      setTimeout(() => {
        setIsListening(false);
        Alert.alert(
          t('voice_input'),
          t('voice_coming_soon'),
          [{ text: t('ok') }]
        );
      }, 2000);
    }
  }, [isListening, locale]);

  // ─── Library button ───────────────────────────────────────────────────

  const showLibrary = useCallback(() => {
    Alert.alert(
      t('doc_library'),
      t('doc_library_desc'),
      [{ text: t('ok') }]
    );
  }, [locale]);

  // ─── Render message ───────────────────────────────────────────────────

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === 'user';

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAi,
        ]}
      >
        {!isUser && (
          <View style={styles.aiIcon}>
            <Ionicons name="hardware-chip" size={14} color={Colors.amber} />
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.aiBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userMessageText : styles.aiMessageText,
            ]}
          >
            {item.text}
          </Text>
          <Text
            style={[
              styles.messageTimestamp,
              isUser ? styles.userTimestamp : styles.aiTimestamp,
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  }, []);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerAccent} />
              <Text style={styles.headerTitle}>{t('ai_assistant')}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={showLibrary}
                activeOpacity={0.7}
              >
                <Ionicons name="library" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  voiceEnabled && styles.headerButtonActive,
                ]}
                onPress={toggleVoice}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={voiceEnabled ? 'volume-high' : 'volume-mute'}
                  size={18}
                  color={voiceEnabled ? Colors.amber : Colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerButton,
                  onlineAvailable && styles.headerButtonActive,
                ]}
                onPress={() => setShowSettings(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="settings-sharp"
                  size={18}
                  color={onlineAvailable ? Colors.green : Colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mode Selector */}
          <View style={styles.modeSelector}>
            {modeOptions.map((mode) => {
              const isActive = currentMode === mode.key;
              return (
                <TouchableOpacity
                  key={mode.key}
                  style={[
                    styles.modePill,
                    isActive && styles.modePillActive,
                    mode.key === 'online' && onlineAvailable && styles.modePillOnline,
                  ]}
                  onPress={() => handleModeChange(mode.key)}
                  activeOpacity={0.7}
                >
                  {mode.key === 'offline-llm' && (
                    <Ionicons
                      name="hardware-chip"
                      size={12}
                      color={isActive ? Colors.cyan : downloadedModels.size > 0 ? Colors.cyan : Colors.textDim}
                    />
                  )}
                  {mode.key === 'online' && (
                    <Ionicons
                      name="cloud"
                      size={12}
                      color={isActive ? Colors.green : onlineAvailable ? Colors.green : Colors.textDim}
                    />
                  )}
                  <Text
                    style={[
                      styles.modePillText,
                      isActive && styles.modePillTextActive,
                      mode.key === 'online' && isActive && { color: Colors.green },
                    ]}
                  >
                    {mode.label}
                  </Text>
                  {mode.key === 'offline-llm' && downloadedModels.size === 0 && (
                    <View style={styles.setupBadge}>
                      <Text style={styles.setupBadgeText}>{t('setup')}</Text>
                    </View>
                  )}
                  {mode.key === 'offline-llm' && llmStatus.state === 'loading' && (
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>{Math.round((llmStatus as any).progress * 100)}%</Text>
                    </View>
                  )}
                  {mode.key === 'online' && !onlineAvailable && (
                    <View style={styles.setupBadge}>
                      <Text style={styles.setupBadgeText}>{t('setup')}</Text>
                    </View>
                  )}
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
          ListFooterComponent={isLoading ? <TypingIndicator /> : null}
        />

        {/* ── Quick Topics ───────────────────────────────────────────── */}
        <View style={styles.quickTopicsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickTopicsScroll}
          >
            {QUICK_TOPICS.map((topic) => (
              <TouchableOpacity
                key={topic.labelKey}
                style={styles.topicChip}
                onPress={() => handleQuickTopic(topic)}
                activeOpacity={0.7}
                disabled={isLoading}
              >
                <Ionicons name={topic.icon} size={12} color={Colors.amber} />
                <Text style={styles.topicChipText}>{t(topic.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Input Area ─────────────────────────────────────────────── */}
        <View style={styles.inputArea}>
          {isListening && (
            <View style={styles.listeningBar}>
              <PulsingIndicator />
              <Text style={styles.listeningText}>{t('listening')}</Text>
              <TouchableOpacity onPress={toggleListening} activeOpacity={0.7}>
                <Text style={styles.listeningCancel}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
              ]}
              onPress={toggleListening}
              activeOpacity={0.7}
              disabled={isLoading}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={20}
                color={isListening ? Colors.red : Colors.textSecondary}
              />
            </TouchableOpacity>

            <View
              style={[
                styles.inputWrapper,
                inputFocused && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={t('chat_placeholder')}
                placeholderTextColor={Colors.textDim}
                multiline
                maxLength={1000}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onSubmitEditing={() => sendMessage(inputText)}
                blurOnSubmit={false}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.sendButton,
                inputText.trim().length > 0 && !isLoading
                  ? styles.sendButtonActive
                  : styles.sendButtonDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              activeOpacity={0.7}
              disabled={inputText.trim().length === 0 || isLoading}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={
                  inputText.trim().length > 0 && !isLoading
                    ? Colors.bg
                    : Colors.textDim
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── API Key Settings Modal ─────────────────────────────────── */}
        <Modal
          visible={showSettings}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('settings_title')}</Text>
                <TouchableOpacity
                  onPress={() => setShowSettings(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>

              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="cloud" size={20} color={Colors.green} />
                  <Text style={styles.settingsSectionTitle}>{t('online_ai_chatgpt')}</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  {t('api_key_description')}
                </Text>

                {onlineAvailable ? (
                  <View style={styles.apiKeyStatus}>
                    <View style={styles.apiKeyStatusRow}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
                      <Text style={styles.apiKeyStatusText}>{t('api_key_configured')}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeKeyButton}
                      onPress={handleRemoveApiKey}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={16} color={Colors.red} />
                      <Text style={styles.removeKeyText}>{t('remove_key')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.apiKeyInput}>
                    <TextInput
                      style={styles.apiKeyTextInput}
                      value={apiKeyInput}
                      onChangeText={setApiKeyInput}
                      placeholder="sk-proj-..."
                      placeholderTextColor={Colors.textDim}
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={[
                        styles.saveKeyButton,
                        apiKeyInput.trim().length > 0 && styles.saveKeyButtonActive,
                      ]}
                      onPress={handleSaveApiKey}
                      activeOpacity={0.7}
                      disabled={apiKeyInput.trim().length === 0}
                    >
                      <Text style={[
                        styles.saveKeyText,
                        apiKeyInput.trim().length > 0 && styles.saveKeyTextActive,
                      ]}>
                        {t('save')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.securityNote}>
                  {t('api_key_security_note')}
                </Text>
              </View>

              {/* ── Custom Server Section (Ollama etc.) ─────────────── */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="server" size={20} color={Colors.amber} />
                  <Text style={styles.settingsSectionTitle}>{t('custom_server_title')}</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  {t('custom_server_desc')}
                </Text>
                {savedCustomUrl ? (
                  <View style={styles.apiKeyStatus}>
                    <View style={styles.apiKeyStatusRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.amber} />
                      <Text style={[styles.apiKeyStatusText, { color: Colors.amber, flex: 1 }]} numberOfLines={1}>
                        {savedCustomUrl}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={styles.apiKeyInput}>
                  <TextInput
                    style={[styles.apiKeyTextInput, { marginBottom: Spacing.sm }]}
                    value={customUrlInput}
                    onChangeText={setCustomUrlInput}
                    placeholder={t('custom_server_placeholder')}
                    placeholderTextColor={Colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TextInput
                    style={styles.apiKeyTextInput}
                    value={customModelInput}
                    onChangeText={setCustomModelInput}
                    placeholder={t('custom_model_placeholder')}
                    placeholderTextColor={Colors.textDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveKeyButton, styles.saveKeyButtonActive, { marginTop: Spacing.md, alignSelf: 'flex-start' }]}
                  onPress={handleSaveCustomServer}
                  activeOpacity={0.7}
                >
                  <Text style={styles.saveKeyTextActive}>{t('save')}</Text>
                </TouchableOpacity>
              </View>

              {/* ── Offline AI Model Section ─────────────────────────── */}
              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="hardware-chip" size={20} color={Colors.cyan} />
                  <Text style={styles.settingsSectionTitle}>{t('offline_ai_model')}</Text>
                </View>
                <Text style={styles.settingsDescription}>
                  {t('model_download_desc')}
                </Text>

                {llmStatus.state === 'ready' && (
                  <View style={styles.apiKeyStatus}>
                    <View style={styles.apiKeyStatusRow}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.cyan} />
                      <Text style={[styles.apiKeyStatusText, { color: Colors.cyan }]}>
                        {t('model_ready')}: {(llmStatus as any).modelName}
                      </Text>
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
                    <Ionicons name="phone-portrait-outline" size={14} color={Colors.textDim} />
                    <Text style={styles.storageInfoText}>
                      Free: {storageInfo.freeSpaceLabel}
                    </Text>
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
                          <Text style={[styles.modelName, !fits && !isDownloaded && { color: Colors.textDim }]}>{model.name}</Text>
                          {isRecommended && (
                            <View style={styles.recommendedBadge}>
                              <Text style={styles.recommendedText}>{t('recommended')}</Text>
                            </View>
                          )}
                          {isDownloaded && (
                            <View style={[styles.recommendedBadge, { backgroundColor: `${Colors.cyan}20` }]}>
                              <Text style={[styles.recommendedText, { color: Colors.cyan }]}>{t('downloaded')}</Text>
                            </View>
                          )}
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
                          <TouchableOpacity
                            style={styles.modelDeleteButton}
                            onPress={() => handleDeleteModel(model)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash-outline" size={14} color={Colors.red} />
                            <Text style={styles.modelDeleteText}>{t('delete_model')}</Text>
                          </TouchableOpacity>
                        ) : isCurrentlyDownloading ? (
                          <View style={styles.modelDownloadingRow}>
                            <View style={styles.modelMiniProgress}>
                              <View style={[styles.modelMiniProgressFill, { width: `${Math.round((downloadStatus as any).progress * 100)}%` }]} />
                            </View>
                            <Text style={styles.modelDownloadingText}>
                              {Math.round((downloadStatus as any).progress * 100)}%
                            </Text>
                            <TouchableOpacity onPress={cancelDownload} activeOpacity={0.7}>
                              <Ionicons name="close-circle" size={18} color={Colors.red} />
                            </TouchableOpacity>
                          </View>
                        ) : fits ? (
                          <TouchableOpacity
                            style={styles.modelDownloadButton}
                            onPress={() => handleDownloadModel(model)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="cloud-download" size={14} color={Colors.cyan} />
                            <Text style={styles.modelDownloadText}>{t('download')}</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.modelNoSpaceRow}>
                            <Ionicons name="alert-circle" size={14} color={Colors.textDim} />
                            <Text style={styles.modelNoSpaceText}>Not enough space</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.settingsSection}>
                <View style={styles.settingsSectionHeader}>
                  <Ionicons name="information-circle" size={20} color={Colors.amber} />
                  <Text style={styles.settingsSectionTitle}>{t('about_modes')}</Text>
                </View>
                <View style={styles.modeInfoList}>
                  <View style={styles.modeInfoItem}>
                    <View style={[styles.modeInfoDot, { backgroundColor: Colors.amber }]} />
                    <View style={styles.modeInfoTextContainer}>
                      <Text style={styles.modeInfoLabel}>{t('mode_knowledge')}</Text>
                      <Text style={styles.modeInfoDesc}>{t('mode_knowledge_desc')}</Text>
                    </View>
                  </View>
                  <View style={styles.modeInfoItem}>
                    <View style={[styles.modeInfoDot, { backgroundColor: Colors.cyan }]} />
                    <View style={styles.modeInfoTextContainer}>
                      <Text style={styles.modeInfoLabel}>{t('mode_offline_llm')}</Text>
                      <Text style={styles.modeInfoDesc}>{t('mode_offline_llm_desc')}</Text>
                    </View>
                  </View>
                  <View style={styles.modeInfoItem}>
                    <View style={[styles.modeInfoDot, { backgroundColor: Colors.green }]} />
                    <View style={styles.modeInfoTextContainer}>
                      <Text style={styles.modeInfoLabel}>{t('mode_online')}</Text>
                      <Text style={styles.modeInfoDesc}>{t('mode_online_desc')}</Text>
                    </View>
                  </View>
                </View>
              </View>

              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  container: {
    flex: 1,
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAccent: {
    width: 3,
    height: 22,
    backgroundColor: Colors.amber,
    borderRadius: 2,
    marginRight: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerButtonActive: {
    borderColor: Colors.amber,
    backgroundColor: `${Colors.amber}15`,
  },

  // ── Mode Selector ───────────────────────────────────────────────────────
  modeSelector: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  modePillActive: {
    backgroundColor: `${Colors.amber}20`,
    borderColor: Colors.amber,
  },
  modePillOnline: {
    borderColor: `${Colors.green}40`,
  },
  modePillText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  modePillTextActive: {
    color: Colors.amber,
  },
  comingSoonBadge: {
    backgroundColor: Colors.bgCardHover,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  comingSoonText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 0.5,
  },
  setupBadge: {
    backgroundColor: `${Colors.green}20`,
    paddingHorizontal: Spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  setupBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.green,
    letterSpacing: 0.5,
  },

  // ── Messages List ─────────────────────────────────────────────────────
  messagesList: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    maxWidth: '85%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
  },
  messageRowAi: {
    alignSelf: 'flex-start',
  },
  aiIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.amber}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: `${Colors.amber}30`,
  },
  messageBubble: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    flex: 1,
  },
  userBubble: {
    backgroundColor: Colors.amber,
    borderBottomRightRadius: BorderRadius.sm,
  },
  aiBubble: {
    backgroundColor: Colors.bgCard,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: FontSize.md,
    lineHeight: 20,
  },
  userMessageText: {
    color: Colors.bg,
  },
  aiMessageText: {
    color: Colors.text,
  },
  messageTimestamp: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  userTimestamp: {
    color: `${Colors.bg}80`,
    textAlign: 'right',
  },
  aiTimestamp: {
    color: Colors.textDim,
  },

  // ── Typing Indicator ──────────────────────────────────────────────────
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  aiIconSmall: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: `${Colors.amber}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: `${Colors.amber}30`,
  },
  typingBubble: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.amber,
  },

  // ── Quick Topics ──────────────────────────────────────────────────────
  quickTopicsContainer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  quickTopicsScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topicChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },

  // ── Input Area ────────────────────────────────────────────────────────
  inputArea: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  listeningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: `${Colors.red}15`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.red}40`,
    gap: Spacing.sm,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.red,
  },
  listeningText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.red,
    fontWeight: '600',
  },
  listeningCancel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 2,
  },
  micButtonActive: {
    backgroundColor: `${Colors.red}20`,
    borderColor: Colors.red,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    maxHeight: 100,
  },
  inputWrapperFocused: {
    borderColor: Colors.amber,
  },
  textInput: {
    fontSize: FontSize.md,
    color: Colors.text,
    maxHeight: 80,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendButtonActive: {
    backgroundColor: Colors.amber,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // ── Settings Modal ─────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  settingsSection: {
    marginBottom: Spacing.xl,
  },
  settingsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  settingsSectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  settingsDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  apiKeyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: `${Colors.green}10`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.green}30`,
    marginBottom: Spacing.md,
  },
  apiKeyStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  apiKeyStatusText: {
    fontSize: FontSize.md,
    color: Colors.green,
    fontWeight: '600',
  },
  removeKeyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.red}15`,
  },
  removeKeyText: {
    fontSize: FontSize.sm,
    color: Colors.red,
    fontWeight: '600',
  },
  apiKeyInput: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  apiKeyTextInput: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  saveKeyButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveKeyButtonActive: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  saveKeyText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textDim,
  },
  saveKeyTextActive: {
    color: Colors.bg,
  },
  securityNote: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  modeInfoList: {
    gap: Spacing.md,
  },
  modeInfoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  modeInfoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  modeInfoTextContainer: {
    flex: 1,
  },
  modeInfoLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  modeInfoDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Model Download ──────────────────────────────────────────────────────
  storageInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  storageInfoText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '600',
  },
  modelCardDisabled: {
    opacity: 0.5,
  },
  modelNoSpaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modelNoSpaceText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '600',
  },
  modelProgressContainer: {
    padding: Spacing.md,
    backgroundColor: `${Colors.cyan}10`,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: `${Colors.cyan}30`,
    marginBottom: Spacing.md,
  },
  modelProgressText: {
    fontSize: FontSize.sm,
    color: Colors.cyan,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  modelProgressBar: {
    height: 6,
    backgroundColor: Colors.bgCardHover,
    borderRadius: 3,
    overflow: 'hidden',
  },
  modelProgressFill: {
    height: '100%',
    backgroundColor: Colors.cyan,
    borderRadius: 3,
  },
  modelCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  modelCardHeader: {
    marginBottom: Spacing.sm,
  },
  modelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  modelName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  recommendedBadge: {
    backgroundColor: `${Colors.amber}20`,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  recommendedText: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 0.5,
  },
  modelDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  modelStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modelStat: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '600',
  },
  modelStatDivider: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },
  modelCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modelDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.cyan}15`,
    borderWidth: 1,
    borderColor: `${Colors.cyan}40`,
  },
  modelDownloadText: {
    fontSize: FontSize.sm,
    color: Colors.cyan,
    fontWeight: '700',
  },
  modelDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.red}15`,
  },
  modelDeleteText: {
    fontSize: FontSize.sm,
    color: Colors.red,
    fontWeight: '600',
  },
  modelDownloadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  modelMiniProgress: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.bgCardHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  modelMiniProgressFill: {
    height: '100%',
    backgroundColor: Colors.cyan,
    borderRadius: 2,
  },
  modelDownloadingText: {
    fontSize: FontSize.xs,
    color: Colors.cyan,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'right',
  },
});
