import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Animated,
  Platform,
  PanResponder,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { textToMorse, morseToText, textToTimingSequence, generateSOSSequence } from '@/services/morse';
import { playMorseSequence, stopPlayback, isPlaying, subscribeTorchState } from '@/services/flashlight';
import { startDecoder, stopDecoder, updateSensitivity, clearDecoded, type DecoderUpdate } from '@/services/morse-decoder';
import { QUICK_MESSAGES } from '@/constants/morse-code';

type IoniconsName = keyof typeof Ionicons.glyphMap;
type Mode = 'send' | 'read';

// ---------- Signal Log Entry ----------
interface SignalLogEntry {
  id: string;
  time: string;
  morse: string;
  text: string;
}

// ---------- Morse Visual Strip ----------
function MorseVisualStrip({ morse }: { morse: string }) {
  if (!morse) return null;

  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < morse.length; i++) {
    const ch = morse[i];
    if (ch === '.') {
      elements.push(<View key={key++} style={styles.morseDot} />);
    } else if (ch === '-') {
      elements.push(<View key={key++} style={styles.morseDash} />);
    } else if (ch === '/') {
      elements.push(<View key={key++} style={styles.morseWordGap} />);
    } else if (ch === ' ') {
      elements.push(<View key={key++} style={styles.morseCharGap} />);
    }
  }

  return (
    <View style={styles.morseStripContainer}>
      <Text style={styles.morseStripLabel}>SIGNAL PATTERN</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.morseStrip}>{elements}</View>
      </ScrollView>
    </View>
  );
}

// ---------- Main Screen ----------
export default function MorseScreen() {
  const [mode, setMode] = useState<Mode>('send');

  // SEND mode state
  const [inputText, setInputText] = useState('');
  const [morseOutput, setMorseOutput] = useState('');
  const [wpm, setWpm] = useState(15);
  const [transmitting, setTransmitting] = useState(false);
  const [transmitProgress, setTransmitProgress] = useState(0);
  const [sosActive, setSosActive] = useState(false);

  // READ mode state
  const [detecting, setDetecting] = useState(false);
  const [decodedText, setDecodedText] = useState('');
  const [decodedMorse, setDecodedMorse] = useState('');
  const [currentLux, setCurrentLux] = useState(0);
  const [lightDetected, setLightDetected] = useState(false);
  const [sensitivity, setSensitivity] = useState(50);
  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>([]);
  const [demoAnimating, setDemoAnimating] = useState(false);

  // Reticle targeting – position as fraction (0–1) within camera view
  const [reticleX, setReticleX] = useState(0.5);
  const [reticleY, setReticleY] = useState(0.5);
  const cameraLayoutRef = useRef({ width: 0, height: 0 });

  // Custom slider state
  const sliderWidthRef = useRef(0);

  // Camera permission for torch control
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const hasCameraPermission = cameraPermission?.granted ?? false;

  // Torch state (drives the hidden CameraView's enableTorch prop)
  const [torchOn, setTorchOn] = useState(false);
  const isNative = Platform.OS !== 'web';

  useEffect(() => {
    if (!isNative) return;
    const unsub = subscribeTorchState(setTorchOn);
    return unsub;
  }, []);

  // SOS pulse animation
  const sosPulseAnim = useRef(new Animated.Value(1)).current;
  const sosPulseRef = useRef<Animated.CompositeAnimation | null>(null);

  // Update morse output when text changes
  useEffect(() => {
    if (inputText.trim()) {
      setMorseOutput(textToMorse(inputText));
    } else {
      setMorseOutput('');
    }
  }, [inputText]);

  // SOS pulse animation
  useEffect(() => {
    if (sosActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(sosPulseAnim, {
            toValue: 0.4,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(sosPulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      sosPulseRef.current = pulse;
      pulse.start();
    } else {
      if (sosPulseRef.current) {
        sosPulseRef.current.stop();
        sosPulseRef.current = null;
      }
      sosPulseAnim.setValue(1);
    }
    return () => {
      if (sosPulseRef.current) {
        sosPulseRef.current.stop();
      }
    };
  }, [sosActive]);

  // Cleanup decoder on unmount
  useEffect(() => {
    return () => {
      stopDecoder();
    };
  }, []);

  // ---------- SEND Handlers ----------
  const ensureCameraPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;
    if (hasCameraPermission) return true;
    const result = await requestCameraPermission();
    return result.granted;
  }, [isNative, hasCameraPermission, requestCameraPermission]);

  const handleSOS = useCallback(async () => {
    if (sosActive) {
      stopPlayback();
      setSosActive(false);
      return;
    }

    if (!(await ensureCameraPermission())) {
      Alert.alert('Camera Permission', 'Camera permission is needed to control the flashlight.');
      return;
    }

    setSosActive(true);

    // Brief delay to let CameraView mount and initialize torch
    await new Promise((r) => setTimeout(r, 500));

    const sequence = generateSOSSequence(wpm);

    // Loop SOS 3 times
    const fullSequence = [...sequence, { type: 'off' as const, duration: 1400 }, ...sequence, { type: 'off' as const, duration: 1400 }, ...sequence];

    try {
      await playMorseSequence(fullSequence, (index, total) => {
        setTransmitProgress(index / total);
      });
    } catch {
      // playback stopped or errored
    } finally {
      setSosActive(false);
    }
  }, [sosActive, wpm, ensureCameraPermission]);

  const handleQuickMessage = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const handleTransmit = useCallback(async () => {
    if (transmitting) {
      stopPlayback();
      setTransmitting(false);
      setTransmitProgress(0);
      return;
    }

    if (!inputText.trim()) {
      Alert.alert('No Message', 'Enter a message to transmit.');
      return;
    }

    if (!(await ensureCameraPermission())) {
      Alert.alert('Camera Permission', 'Camera permission is needed to control the flashlight.');
      return;
    }

    setTransmitting(true);
    setTransmitProgress(0);

    // Brief delay to let CameraView mount and initialize torch
    await new Promise((r) => setTimeout(r, 500));

    const sequence = textToTimingSequence(inputText, wpm);

    try {
      await playMorseSequence(sequence, (index, total) => {
        setTransmitProgress(index / total);
      });
      setTransmitProgress(1);
    } catch {
      // stopped
    } finally {
      setTransmitting(false);
      setTimeout(() => setTransmitProgress(0), 1000);
    }
  }, [transmitting, inputText, wpm, ensureCameraPermission]);

  const handlePersonalInfo = useCallback(() => {
    Alert.alert(
      'Personal Info',
      'Set up your profile in the Profile tab first. Your name, blood type, and medical conditions will be encoded as Morse code for emergency transmission.',
      [{ text: 'OK', style: 'default' }]
    );
  }, []);

  // ---------- READ Handlers ----------
  const handleToggleDetection = useCallback(async () => {
    if (detecting) {
      // Stop detection
      stopDecoder();
      setDetecting(false);
      // Save to log if we decoded something
      if (decodedText.trim()) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSignalLog((prev) => [
          { id: Date.now().toString(), time: timeStr, morse: decodedMorse, text: decodedText.trim() },
          ...prev,
        ]);
      }
      return;
    }

    // Request camera permission (needed to show camera preview)
    if (isNative && !hasCameraPermission) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera permission is needed for the Morse code reader.');
        return;
      }
    }

    // Clear previous and start
    setDecodedText('');
    setDecodedMorse('');
    setCurrentLux(0);
    setLightDetected(false);

    if (isNative) {
      startDecoder((update: DecoderUpdate) => {
        setDecodedText(update.decodedText);
        setDecodedMorse(update.decodedMorse);
        setCurrentLux(Math.round(update.lux));
        setLightDetected(update.isLight);
      }, sensitivity);
    }

    setDetecting(true);
  }, [detecting, decodedText, decodedMorse, sensitivity, isNative, hasCameraPermission, requestCameraPermission]);

  const handleDemo = useCallback((signal: string) => {
    if (demoAnimating) return;
    setDemoAnimating(true);
    setDecodedText('');

    const morse = textToMorse(signal);
    const chars = morse.split('');
    let idx = 0;

    const interval = setInterval(() => {
      if (idx < chars.length) {
        setDecodedText((prev) => prev + chars[idx]);
        idx++;
      } else {
        clearInterval(interval);
        // Add to log
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSignalLog((prev) => [
          {
            id: Date.now().toString(),
            time: timeStr,
            morse,
            text: signal,
          },
          ...prev,
        ]);
        setDemoAnimating(false);
      }
    }, 120);
  }, [demoAnimating]);

  // ---------- WPM Controls ----------
  const decrementWpm = useCallback(() => {
    setWpm((prev) => Math.max(5, prev - 1));
  }, []);

  const incrementWpm = useCallback(() => {
    setWpm((prev) => Math.min(25, prev + 1));
  }, []);

  // ---------- Sensitivity Controls (slider) ----------
  // Use refs for callbacks so PanResponder always sees latest state
  const detectingRef = useRef(detecting);
  detectingRef.current = detecting;

  const handleSliderGesture = useCallback((evt: GestureResponderEvent) => {
    const x = evt.nativeEvent.locationX;
    const frac = Math.max(0, Math.min(1, x / (sliderWidthRef.current || 1)));
    const val = Math.max(5, Math.min(100, Math.round(5 + frac * 95)));
    setSensitivity(val);
    if (detectingRef.current) updateSensitivity(val);
  }, []);

  const sensitivityPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => handleSliderGesture(evt),
      onPanResponderMove: (evt: GestureResponderEvent) => handleSliderGesture(evt),
    })
  ).current;

  // Reticle PanResponder — drag the crosshair around the camera view
  const reticlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const { width, height } = cameraLayoutRef.current;
        if (width > 0 && height > 0) {
          setReticleX(Math.max(0, Math.min(1, locationX / width)));
          setReticleY(Math.max(0, Math.min(1, locationY / height)));
        }
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        const { width, height } = cameraLayoutRef.current;
        if (width > 0 && height > 0) {
          setReticleX(Math.max(0, Math.min(1, locationX / width)));
          setReticleY(Math.max(0, Math.min(1, locationY / height)));
        }
      },
    })
  ).current;

  const getSensitivityLabel = (val: number): string => {
    if (val <= 25) return 'VERY LOW';
    if (val <= 45) return 'LOW';
    if (val <= 65) return 'MEDIUM';
    if (val <= 85) return 'HIGH';
    return 'VERY HIGH';
  };

  // Compute the lux threshold for display
  const getThresholdLux = (val: number): number => {
    return Math.max(10, Math.round(510 - (val / 100) * 500));
  };

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hidden CameraView for torch control on native */}
      {isNative && hasCameraPermission && (transmitting || sosActive) && (
        <CameraView
          style={styles.hiddenCamera}
          facing="back"
          enableTorch={torchOn}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerAccent} />
          <Text style={styles.headerTitle}>MORSE CODE</Text>
        </View>
        <Text style={styles.headerSubtitle}>Signal Transmission & Decoding</Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentedContainer}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segmentButton, mode === 'send' && styles.segmentButtonActive]}
            onPress={() => setMode('send')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flashlight"
              size={16}
              color={mode === 'send' ? Colors.bg : Colors.textSecondary}
            />
            <Text style={[styles.segmentText, mode === 'send' && styles.segmentTextActive]}>
              SEND
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, mode === 'read' && styles.segmentButtonActive]}
            onPress={() => setMode('read')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="eye"
              size={16}
              color={mode === 'read' ? Colors.bg : Colors.textSecondary}
            />
            <Text style={[styles.segmentText, mode === 'read' && styles.segmentTextActive]}>
              READ
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'send' ? (
          // ===================== SEND MODE =====================
          <View>
            {/* SOS Emergency Button */}
            <View style={styles.sosSection}>
              <TouchableOpacity onPress={handleSOS} activeOpacity={0.8}>
                <Animated.View
                  style={[
                    styles.sosButton,
                    sosActive && styles.sosButtonActive,
                    { opacity: sosActive ? sosPulseAnim : 1 },
                  ]}
                >
                  <Ionicons name="alert-circle" size={36} color="#FFFFFF" />
                  <Text style={styles.sosButtonText}>SOS</Text>
                </Animated.View>
              </TouchableOpacity>
              <Text style={styles.sosLabel}>
                {sosActive ? 'Transmitting SOS... Tap to stop' : 'Tap to transmit SOS signal'}
              </Text>
              {sosActive && (
                <View style={styles.sosIndicator}>
                  <View style={styles.sosIndicatorDot} />
                  <Text style={styles.sosIndicatorText}>SIGNAL ACTIVE</Text>
                </View>
              )}
            </View>

            {/* Quick Messages */}
            <View style={styles.sectionHeader}>
              <Ionicons name="flash" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>QUICK MESSAGES</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickMessagesScroll}
              contentContainerStyle={styles.quickMessagesContent}
            >
              {QUICK_MESSAGES.map((msg) => (
                <TouchableOpacity
                  key={msg.label}
                  style={[
                    styles.quickPill,
                    inputText === msg.text && styles.quickPillActive,
                  ]}
                  onPress={() => handleQuickMessage(msg.text)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={msg.icon as IoniconsName}
                    size={14}
                    color={inputText === msg.text ? Colors.bg : Colors.amber}
                  />
                  <Text
                    style={[
                      styles.quickPillText,
                      inputText === msg.text && styles.quickPillTextActive,
                    ]}
                  >
                    {msg.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Text Input */}
            <View style={styles.sectionHeader}>
              <Ionicons name="create" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>MESSAGE INPUT</Text>
            </View>
            <View style={styles.inputCard}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Enter message to encode..."
                placeholderTextColor={Colors.textDim}
                multiline
                maxLength={120}
                autoCapitalize="characters"
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>{inputText.length}/120</Text>
              </View>
            </View>

            {/* Morse Code Preview */}
            {morseOutput ? (
              <View style={styles.morsePreviewCard}>
                <View style={styles.morsePreviewHeader}>
                  <Ionicons name="code-working" size={14} color={Colors.amber} />
                  <Text style={styles.morsePreviewLabel}>ENCODED OUTPUT</Text>
                </View>
                <Text style={styles.morsePreviewText}>{morseOutput}</Text>
              </View>
            ) : null}

            {/* Morse Visual Strip */}
            <MorseVisualStrip morse={morseOutput} />

            {/* Speed Control */}
            <View style={styles.sectionHeader}>
              <Ionicons name="speedometer" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>TRANSMISSION SPEED</Text>
            </View>
            <View style={styles.speedCard}>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={decrementWpm}
                  activeOpacity={0.6}
                >
                  <Ionicons name="remove" size={20} color={Colors.amber} />
                </TouchableOpacity>
                <View style={styles.stepperValueContainer}>
                  <Text style={styles.stepperValue}>{wpm}</Text>
                  <Text style={styles.stepperUnit}>WPM</Text>
                </View>
                <TouchableOpacity
                  style={styles.stepperButton}
                  onPress={incrementWpm}
                  activeOpacity={0.6}
                >
                  <Ionicons name="add" size={20} color={Colors.amber} />
                </TouchableOpacity>
              </View>
              <View style={styles.speedBarTrack}>
                <View
                  style={[
                    styles.speedBarFill,
                    { width: `${((wpm - 5) / 20) * 100}%` },
                  ]}
                />
              </View>
              <View style={styles.speedLabels}>
                <Text style={styles.speedLabelText}>SLOW (5)</Text>
                <Text style={styles.speedLabelText}>FAST (25)</Text>
              </View>
            </View>

            {/* Transmit Button */}
            <TouchableOpacity
              style={[
                styles.transmitButton,
                transmitting && styles.transmitButtonActive,
              ]}
              onPress={handleTransmit}
              activeOpacity={0.8}
            >
              <Ionicons
                name={transmitting ? 'stop-circle' : 'radio'}
                size={22}
                color={transmitting ? '#FFFFFF' : Colors.bg}
              />
              <Text
                style={[
                  styles.transmitButtonText,
                  transmitting && styles.transmitButtonTextActive,
                ]}
              >
                {transmitting ? 'STOP' : 'TRANSMIT'}
              </Text>
            </TouchableOpacity>

            {/* Progress Bar */}
            {(transmitting || transmitProgress > 0) && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${transmitProgress * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {transmitting
                    ? `TRANSMITTING... ${Math.round(transmitProgress * 100)}%`
                    : 'COMPLETE'}
                </Text>
              </View>
            )}

            {/* Personal Info Quick Send */}
            <View style={styles.personalInfoCard}>
              <View style={styles.personalInfoHeader}>
                <Ionicons name="person-circle" size={18} color={Colors.cyan} />
                <Text style={styles.personalInfoTitle}>PERSONAL INFO BEACON</Text>
              </View>
              <Text style={styles.personalInfoDesc}>
                Transmit your identity, blood type, and medical conditions via Morse for rescue teams.
              </Text>
              <TouchableOpacity
                style={styles.personalInfoButton}
                onPress={handlePersonalInfo}
                activeOpacity={0.7}
              >
                <Ionicons name="id-card" size={16} color={Colors.cyan} />
                <Text style={styles.personalInfoButtonText}>SEND PERSONAL INFO</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // ===================== READ MODE =====================
          <View>
            {/* Camera Preview + Light Indicator */}
            <View style={styles.sectionHeader}>
              <Ionicons name="camera" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>LIGHT SOURCE DETECTION</Text>
            </View>
            <View
              style={styles.cameraContainer}
              onLayout={(e: LayoutChangeEvent) => {
                cameraLayoutRef.current = {
                  width: e.nativeEvent.layout.width,
                  height: e.nativeEvent.layout.height,
                };
              }}
            >
              {isNative && detecting && hasCameraPermission ? (
                <CameraView style={styles.cameraPreview} facing="back" />
              ) : (
                <View style={styles.cameraPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color={Colors.textDim} />
                  <Text style={styles.cameraPlaceholderText}>
                    {isNative ? 'Tap Start Detection to open camera' : 'Camera not available on web'}
                  </Text>
                </View>
              )}

              {/* Draggable targeting reticle overlay */}
              {detecting && (
                <View
                  style={StyleSheet.absoluteFill}
                  {...reticlePanResponder.panHandlers}
                >
                  {/* Crosshair */}
                  <View
                    style={[
                      styles.reticleContainer,
                      {
                        left: `${reticleX * 100}%`,
                        top: `${reticleY * 100}%`,
                      },
                    ]}
                    pointerEvents="none"
                  >
                    {/* Outer ring */}
                    <View style={[styles.reticleRing, lightDetected && styles.reticleRingActive]} />
                    {/* Cross lines */}
                    <View style={[styles.reticleLineH, lightDetected && styles.reticleLineActive]} />
                    <View style={[styles.reticleLineV, lightDetected && styles.reticleLineActive]} />
                    {/* Center dot */}
                    <View style={[styles.reticleDot, lightDetected && styles.reticleDotActive]} />
                  </View>

                  {/* Instruction hint (only before first move) */}
                  <View style={styles.reticleHint} pointerEvents="none">
                    <Text style={styles.reticleHintText}>Drag to aim at light source</Text>
                  </View>
                </View>
              )}

              {/* Light indicator overlay (top badges) */}
              {detecting && (
                <View style={styles.cameraOverlay} pointerEvents="none">
                  <View style={styles.detectingBadge}>
                    <View style={[styles.detectingDot, lightDetected && { backgroundColor: Colors.green }]} />
                    <Text style={styles.detectingText}>
                      {lightDetected ? 'LIGHT ON' : 'SCANNING'}
                    </Text>
                  </View>
                  <View style={styles.luxBadge}>
                    <Ionicons name="sunny" size={12} color={Colors.amber} />
                    <Text style={styles.luxText}>{currentLux} lux</Text>
                  </View>
                </View>
              )}
              {/* Light flash border */}
              {detecting && lightDetected && (
                <View style={styles.lightFlash} pointerEvents="none" />
              )}
            </View>

            {/* Detection Controls */}
            <View style={styles.sectionHeader}>
              <Ionicons name="options" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>DETECTION CONTROLS</Text>
            </View>
            <View style={styles.controlsCard}>
              {/* Sensitivity Slider */}
              <View>
                <View style={styles.sensitivityHeaderRow}>
                  <Text style={styles.controlLabel}>SENSITIVITY</Text>
                  <View style={styles.sensitivityBadge}>
                    <Text style={styles.sensitivityBadgeText}>{sensitivity}%</Text>
                  </View>
                </View>

                {/* Custom Slider */}
                <View
                  style={styles.sliderContainer}
                  onLayout={(e: LayoutChangeEvent) => {
                    sliderWidthRef.current = e.nativeEvent.layout.width;
                  }}
                  {...sensitivityPanResponder.panHandlers}
                >
                  <View style={styles.sliderTrack}>
                    <View
                      style={[
                        styles.sliderFill,
                        { width: `${((sensitivity - 5) / 95) * 100}%` },
                      ]}
                    />
                  </View>
                  {/* Thumb */}
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${((sensitivity - 5) / 95) * 100}%` },
                    ]}
                    pointerEvents="none"
                  />
                </View>

                {/* Labels & Threshold info */}
                <View style={styles.sliderLabelsRow}>
                  <Text style={styles.sliderLabelText}>5 LOW</Text>
                  <Text style={styles.sliderLabelCenter}>{getSensitivityLabel(sensitivity)}</Text>
                  <Text style={styles.sliderLabelText}>100 HIGH</Text>
                </View>
                <View style={styles.thresholdRow}>
                  <Ionicons name="sunny-outline" size={12} color={Colors.textDim} />
                  <Text style={styles.thresholdText}>
                    Trigger threshold: {getThresholdLux(sensitivity)} lux
                  </Text>
                </View>
              </View>

              {/* Detection Toggle */}
              <TouchableOpacity
                style={[
                  styles.detectionButton,
                  detecting && styles.detectionButtonActive,
                ]}
                onPress={handleToggleDetection}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={detecting ? 'stop-circle' : 'play-circle'}
                  size={20}
                  color={detecting ? '#FFFFFF' : Colors.bg}
                />
                <Text
                  style={[
                    styles.detectionButtonText,
                    detecting && styles.detectionButtonTextActive,
                  ]}
                >
                  {detecting ? 'STOP DETECTION' : 'START DETECTION'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Decoded Output */}
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>DECODED OUTPUT</Text>
            </View>
            <View style={styles.decodedCard}>
              {decodedText || decodedMorse ? (
                <>
                  {decodedMorse ? <Text style={styles.decodedMorseText}>{decodedMorse}</Text> : null}
                  <View style={styles.decodedDivider} />
                  <Text style={styles.decodedTextLarge}>{decodedText || '...'}</Text>
                  {detecting && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => { clearDecoded(); setDecodedText(''); setDecodedMorse(''); }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={14} color={Colors.textDim} />
                      <Text style={styles.clearButtonText}>CLEAR</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <View style={styles.decodedPlaceholder}>
                  <Ionicons name="radio-outline" size={24} color={Colors.textDim} />
                  <Text style={styles.decodedPlaceholderText}>
                    Decoded signals will appear here...
                  </Text>
                </View>
              )}
            </View>

            {/* Demo Buttons */}
            <View style={styles.sectionHeader}>
              <Ionicons name="flask" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>SIMULATION</Text>
            </View>
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoButton, demoAnimating && styles.demoButtonDisabled]}
                onPress={() => handleDemo('SOS')}
                activeOpacity={0.7}
                disabled={demoAnimating}
              >
                <Ionicons name="alert-circle" size={16} color={Colors.red} />
                <Text style={styles.demoButtonText}>DEMO SOS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoButton, demoAnimating && styles.demoButtonDisabled]}
                onPress={() => handleDemo('HELP')}
                activeOpacity={0.7}
                disabled={demoAnimating}
              >
                <Ionicons name="hand-left" size={16} color={Colors.amber} />
                <Text style={styles.demoButtonText}>DEMO HELP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoButton, demoAnimating && styles.demoButtonDisabled]}
                onPress={() => handleDemo('WATER')}
                activeOpacity={0.7}
                disabled={demoAnimating}
              >
                <Ionicons name="water" size={16} color={Colors.cyan} />
                <Text style={styles.demoButtonText}>DEMO WATER</Text>
              </TouchableOpacity>
            </View>

            {/* Signal Log */}
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={14} color={Colors.amber} />
              <Text style={styles.sectionTitle}>SIGNAL LOG</Text>
              {signalLog.length > 0 && (
                <Text style={styles.logCount}>{signalLog.length}</Text>
              )}
            </View>
            {signalLog.length > 0 ? (
              <View style={styles.logContainer}>
                {signalLog.map((entry) => (
                  <View key={entry.id} style={styles.logEntry}>
                    <View style={styles.logTimeContainer}>
                      <Ionicons name="time" size={12} color={Colors.textDim} />
                      <Text style={styles.logTime}>{entry.time}</Text>
                    </View>
                    <Text style={styles.logMorse}>{entry.morse}</Text>
                    <View style={styles.logDecodedRow}>
                      <Ionicons name="arrow-forward" size={12} color={Colors.green} />
                      <Text style={styles.logDecoded}>{entry.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyLog}>
                <Ionicons name="document-outline" size={20} color={Colors.textDim} />
                <Text style={styles.emptyLogText}>
                  No signals decoded yet. Use Demo buttons to simulate.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ==================== STYLES ====================
const styles = StyleSheet.create({
  hiddenCamera: {
    width: 1,
    height: 1,
    position: 'absolute',
    opacity: 0,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },

  // ---------- Header ----------
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  headerAccent: {
    width: 4,
    height: 28,
    backgroundColor: Colors.amber,
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: FontSize.title,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 3,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginLeft: Spacing.lg + Spacing.xs,
  },

  // ---------- Segmented Control ----------
  segmentedContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  segmentButtonActive: {
    backgroundColor: Colors.amber,
  },
  segmentText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  segmentTextActive: {
    color: Colors.bg,
  },

  // ---------- Section Header ----------
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    flex: 1,
  },

  // ---------- SOS Button ----------
  sosSection: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sosButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.red + '60',
    shadowColor: Colors.red,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  sosButtonActive: {
    backgroundColor: '#FF1A1A',
    borderColor: '#FF6666',
    shadowOpacity: 0.8,
    shadowRadius: 30,
  },
  sosButtonText: {
    fontSize: FontSize.xl,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginTop: 2,
  },
  sosLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    letterSpacing: 0.5,
  },
  sosIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.redDim,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  sosIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  sosIndicatorText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.red,
    letterSpacing: 1,
  },

  // ---------- Quick Messages ----------
  quickMessagesScroll: {
    marginBottom: Spacing.sm,
  },
  quickMessagesContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickPillActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  quickPillText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 1,
  },
  quickPillTextActive: {
    color: Colors.bg,
  },

  // ---------- Text Input ----------
  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  textInput: {
    fontSize: FontSize.lg,
    color: Colors.text,
    padding: Spacing.lg,
    minHeight: 80,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  charCount: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    letterSpacing: 0.5,
  },

  // ---------- Morse Preview ----------
  morsePreviewCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.amber,
  },
  morsePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  morsePreviewLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  morsePreviewText: {
    fontSize: FontSize.lg,
    color: Colors.amber,
    fontFamily: 'monospace',
    letterSpacing: 2,
    lineHeight: 26,
  },

  // ---------- Morse Visual Strip ----------
  morseStripContainer: {
    marginTop: Spacing.lg,
  },
  morseStripLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  morseStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 44,
  },
  morseDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.amber,
    marginHorizontal: 2,
  },
  morseDash: {
    width: 28,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.amber,
    marginHorizontal: 2,
  },
  morseCharGap: {
    width: 12,
    height: 10,
  },
  morseWordGap: {
    width: 6,
    height: 10,
    borderLeftWidth: 1,
    borderLeftColor: Colors.textDim + '50',
    marginHorizontal: 8,
  },

  // ---------- Speed Control ----------
  speedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepperValueContainer: {
    alignItems: 'center',
    minWidth: 60,
  },
  stepperValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.amber,
    letterSpacing: 1,
  },
  stepperUnit: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: 2,
  },
  speedBarTrack: {
    height: 4,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 2,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  speedBarFill: {
    height: '100%',
    backgroundColor: Colors.amber,
    borderRadius: 2,
  },
  speedLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  speedLabelText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    letterSpacing: 1,
  },

  // ---------- Transmit Button ----------
  transmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.amber,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xl,
  },
  transmitButtonActive: {
    backgroundColor: Colors.red,
  },
  transmitButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.bg,
    letterSpacing: 3,
  },
  transmitButtonTextActive: {
    color: '#FFFFFF',
  },

  // ---------- Progress ----------
  progressContainer: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.bgCard,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.amber,
    borderRadius: 3,
  },
  progressText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },

  // ---------- Personal Info ----------
  personalInfoCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 2,
    borderTopColor: Colors.cyan,
  },
  personalInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  personalInfoTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.cyan,
    letterSpacing: 1.5,
  },
  personalInfoDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  personalInfoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cyan + '15',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  personalInfoButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.cyan,
    letterSpacing: 1,
  },

  // ---------- Camera & Light Detection ----------
  cameraContainer: {
    height: 260,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgSecondary,
    gap: Spacing.md,
  },
  cameraPlaceholderText: {
    fontSize: FontSize.md,
    color: Colors.textDim,
    textAlign: 'center',
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  detectingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  detectingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  detectingText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  luxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  luxText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 0.5,
  },
  lightFlash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.green + '15',
    borderWidth: 2,
    borderColor: Colors.green,
    borderRadius: BorderRadius.lg,
  },

  // ---------- Detection Controls ----------
  controlsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.lg,
  },
  controlLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  sensitivityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  sensitivityBadge: {
    backgroundColor: Colors.amber + '20',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.amber + '40',
  },
  sensitivityBadgeText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: Colors.amber,
    letterSpacing: 1,
  },

  // Custom slider
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: Colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.amber,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.amber,
    borderWidth: 3,
    borderColor: Colors.bg,
    marginLeft: -12,
    shadowColor: Colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  sliderLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  sliderLabelText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    letterSpacing: 1,
  },
  sliderLabelCenter: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 1,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
  thresholdText: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    letterSpacing: 0.5,
  },

  // ---------- Targeting Reticle ----------
  reticleContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reticleRing: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.amber + 'AA',
  },
  reticleRingActive: {
    borderColor: Colors.green,
    borderWidth: 3,
  },
  reticleLineH: {
    position: 'absolute',
    width: 80,
    height: 1,
    backgroundColor: Colors.amber + '88',
  },
  reticleLineV: {
    position: 'absolute',
    width: 1,
    height: 80,
    backgroundColor: Colors.amber + '88',
  },
  reticleLineActive: {
    backgroundColor: Colors.green + '88',
  },
  reticleDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.amber,
  },
  reticleDotActive: {
    backgroundColor: Colors.green,
    shadowColor: Colors.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  reticleHint: {
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  reticleHintText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    letterSpacing: 0.5,
    overflow: 'hidden',
  },
  detectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.green,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  detectionButtonActive: {
    backgroundColor: Colors.red,
  },
  detectionButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.bg,
    letterSpacing: 1.5,
  },
  detectionButtonTextActive: {
    color: '#FFFFFF',
  },

  // ---------- Decoded Output ----------
  decodedCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 100,
  },
  decodedMorseText: {
    fontSize: FontSize.lg,
    color: Colors.amber,
    fontFamily: 'monospace',
    letterSpacing: 2,
    lineHeight: 26,
  },
  decodedDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  decodedTextLarge: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.green,
    letterSpacing: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgSecondary,
  },
  clearButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textDim,
    letterSpacing: 1,
  },
  decodedPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
  },
  decodedPlaceholderText: {
    fontSize: FontSize.md,
    color: Colors.textDim,
    letterSpacing: 0.5,
  },

  // ---------- Demo Buttons ----------
  demoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.bgCard,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoButtonDisabled: {
    opacity: 0.4,
  },
  demoButtonText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 1,
  },

  // ---------- Signal Log ----------
  logCount: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.bg,
    backgroundColor: Colors.amber,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    minWidth: 20,
    textAlign: 'center',
  },
  logContainer: {
    gap: Spacing.sm,
  },
  logEntry: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.green,
  },
  logTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  logTime: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  logMorse: {
    fontSize: FontSize.md,
    color: Colors.amber,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },
  logDecodedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logDecoded: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.green,
    letterSpacing: 1,
  },
  emptyLog: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyLogText: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
