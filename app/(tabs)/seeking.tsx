import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Animated,
} from 'react-native';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Brightness from 'expo-brightness';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import {
  startBeacon,
  stopBeacon,
  isBeaconActive,
  getBeaconStatus,
} from '@/services/ble-beacon';
import { startAudioBeacon, stopAudioBeacon } from '@/services/audio-beacon';
import { getBatteryLevel, estimateTimeRemaining } from '@/services/battery';

function generateDeviceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function SeekingScreen() {
  const router = useRouter();

  // Beacon state
  const [beaconActive, setBeaconActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(-1);
  const [batteryTimeEstimate, setBatteryTimeEstimate] = useState('Calculating...');

  // Configuration
  const [deviceName, setDeviceName] = useState(`SURVIVOR-${generateDeviceId()}`);
  const [emergencyMessage, setEmergencyMessage] = useState('Need rescue. Please help.');
  const [includeGPS, setIncludeGPS] = useState(true);
  const [audioBeacon, setAudioBeacon] = useState(false);

  // Mock GPS
  const [gpsCoords] = useState({ lat: '34.0522', lon: '-118.2437' });
  const [gpsAcquired, setGpsAcquired] = useState(false);

  // Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedBrightness = useRef<number | null>(null);

  // Fetch battery level
  const fetchBattery = useCallback(async () => {
    const level = await getBatteryLevel();
    setBatteryLevel(level);
    const estimate = estimateTimeRemaining(level, beaconActive);
    setBatteryTimeEstimate(estimate);
  }, [beaconActive]);

  useEffect(() => {
    fetchBattery();
    const interval = setInterval(fetchBattery, 30000);
    return () => clearInterval(interval);
  }, [fetchBattery]);

  // Pulse animation when active
  useEffect(() => {
    if (beaconActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      glow.start();
      return () => {
        pulse.stop();
        glow.stop();
      };
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.4);
    }
  }, [beaconActive, pulseAnim, glowAnim]);

  // Elapsed time counter
  useEffect(() => {
    if (beaconActive) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedSeconds(0);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [beaconActive]);

  // Dim brightness when beacon is active, restore when off
  useEffect(() => {
    if (Platform.OS === 'web') return;

    if (beaconActive) {
      (async () => {
        try {
          const current = await Brightness.getBrightnessAsync();
          savedBrightness.current = current;
          await Brightness.setBrightnessAsync(0.05);
        } catch (_) {}
      })();
    } else if (savedBrightness.current !== null) {
      Brightness.setBrightnessAsync(savedBrightness.current).catch(() => {});
      savedBrightness.current = null;
    }
  }, [beaconActive]);

  // Restore brightness + stop audio beacon on unmount
  useEffect(() => {
    return () => {
      stopAudioBeacon();
      if (Platform.OS !== 'web' && savedBrightness.current !== null) {
        Brightness.setBrightnessAsync(savedBrightness.current).catch(() => {});
      }
    };
  }, []);

  // Simulate GPS acquisition
  useEffect(() => {
    if (beaconActive && includeGPS) {
      const timeout = setTimeout(() => setGpsAcquired(true), 2500);
      return () => clearTimeout(timeout);
    } else {
      setGpsAcquired(false);
    }
  }, [beaconActive, includeGPS]);

  const handleToggleBeacon = async () => {
    if (beaconActive) {
      await stopBeacon();
      await stopAudioBeacon();
      setBeaconActive(false);
    } else {
      await startBeacon({
        deviceName,
        message: emergencyMessage,
        latitude: includeGPS ? parseFloat(gpsCoords.lat) : undefined,
        longitude: includeGPS ? parseFloat(gpsCoords.lon) : undefined,
      });
      if (audioBeacon) {
        await startAudioBeacon();
      }
      setBeaconActive(true);
      fetchBattery();
    }
  };

  const getBatteryColor = () => {
    if (batteryLevel < 0) return Colors.textDim;
    const pct = batteryLevel * 100;
    if (pct > 50) return Colors.green;
    if (pct >= 20) return Colors.amber;
    return Colors.red;
  };

  const batteryPct = batteryLevel >= 0 ? `${Math.round(batteryLevel * 100)}%` : 'N/A';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Ionicons name="radio" size={24} color={Colors.green} />
            <Text style={styles.headerTitle}>SEEKING MODE</Text>
          </View>
          <Text style={styles.headerSubtitle}>Emergency Rescue Beacon</Text>
        </View>

        {/* Main Activation Button */}
        <View style={styles.activationContainer}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleToggleBeacon}>
            <Animated.View
              style={[
                styles.activationCircle,
                beaconActive
                  ? {
                      borderColor: Colors.green,
                      backgroundColor: Colors.greenDim,
                      transform: [{ scale: pulseAnim }],
                    }
                  : {
                      borderColor: Colors.green,
                      backgroundColor: 'transparent',
                    },
              ]}
            >
              {beaconActive ? (
                <Animated.View style={{ opacity: glowAnim, alignItems: 'center' }}>
                  <Ionicons name="radio" size={56} color={Colors.green} />
                  <Text style={styles.activationTextActive}>BEACON ACTIVE</Text>
                </Animated.View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Ionicons name="scan-outline" size={56} color={Colors.green} />
                  <Text style={styles.activationText}>ACTIVATE{'\n'}SEEKING MODE</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.activationDescription}>
            Broadcasts your location and info via BLE & WiFi for rescue teams to detect
          </Text>
        </View>

        {/* Status Dashboard */}
        {beaconActive && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>STATUS DASHBOARD</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Beacon Status</Text>
                <View style={styles.statusValueRow}>
                  <View style={[styles.statusDot, { backgroundColor: Colors.green }]} />
                  <Text style={[styles.statusValue, { color: Colors.green }]}>Active</Text>
                </View>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Time Active</Text>
                <Text style={[styles.statusValue, { color: Colors.cyan }]}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Battery Level</Text>
                <Text style={[styles.statusValue, { color: getBatteryColor() }]}>
                  {batteryPct}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Est. Battery Time</Text>
                <Text style={[styles.statusValue, { color: Colors.amber }]}>
                  {batteryTimeEstimate}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>GPS Coordinates</Text>
                <Text
                  style={[
                    styles.statusValue,
                    { color: gpsAcquired ? Colors.cyan : Colors.textDim },
                  ]}
                >
                  {includeGPS
                    ? gpsAcquired
                      ? `${gpsCoords.lat}, ${gpsCoords.lon}`
                      : 'Acquiring...'
                    : 'Disabled'}
                </Text>
              </View>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>Signal Range</Text>
                <Text style={[styles.statusValue, { color: Colors.textSecondary }]}>
                  ~50m BLE / ~100m WiFi
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Beacon Configuration */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BEACON CONFIGURATION</Text>

          <Text style={styles.inputLabel}>Device Name</Text>
          <TextInput
            style={styles.textInput}
            value={deviceName}
            onChangeText={setDeviceName}
            placeholderTextColor={Colors.textDim}
            editable={!beaconActive}
          />

          <Text style={styles.inputLabel}>Emergency Message</Text>
          <TextInput
            style={[styles.textInput, styles.textInputMultiline]}
            value={emergencyMessage}
            onChangeText={setEmergencyMessage}
            multiline
            numberOfLines={3}
            placeholderTextColor={Colors.textDim}
            editable={!beaconActive}
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="location" size={18} color={Colors.cyan} />
              <Text style={styles.toggleLabel}>Include GPS</Text>
            </View>
            <Switch
              value={includeGPS}
              onValueChange={setIncludeGPS}
              trackColor={{ false: Colors.bgSecondary, true: Colors.greenDim }}
              thumbColor={includeGPS ? Colors.green : Colors.textDim}
              disabled={beaconActive}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="volume-high" size={18} color={Colors.amber} />
              <Text style={styles.toggleLabel}>Audio Beacon (SOS Tone)</Text>
            </View>
            <Switch
              value={audioBeacon}
              onValueChange={setAudioBeacon}
              trackColor={{ false: Colors.bgSecondary, true: Colors.amberDark }}
              thumbColor={audioBeacon ? Colors.amber : Colors.textDim}
              disabled={beaconActive}
            />
          </View>

          <Text style={styles.configNote}>
            When active, nearby rescue teams with compatible devices can detect your signal and
            read your emergency message.
          </Text>
        </View>

        {/* Personal Info Broadcast */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PERSONAL INFO BROADCAST</Text>
          <Text style={styles.cardDescription}>
            Personal info will be included in beacon signal
          </Text>
          <View style={styles.profilePlaceholder}>
            <Ionicons name="person-circle-outline" size={36} color={Colors.textDim} />
            <Text style={styles.profilePlaceholderText}>
              No personal info set. Tap to add your medical profile.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="create-outline" size={18} color={Colors.amber} />
            <Text style={styles.profileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Battery Preservation Info */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="battery-charging" size={20} color={Colors.green} />
            <Text style={[styles.cardTitle, { marginBottom: 0 }]}>BATTERY PRESERVATION</Text>
          </View>
          <Text style={styles.cardDescription}>
            Seeking mode minimizes battery usage by:
          </Text>
          <View style={styles.bulletList}>
            {[
              'Reducing screen brightness',
              'Disabling non-essential services',
              'Using low-power BLE advertising',
              'Optimizing signal intervals',
            ].map((item, i) => (
              <View key={i} style={styles.bulletItem}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Emergency Actions */}
        <View style={styles.emergencyActions}>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => router.push('/(tabs)/morse')}
          >
            <Ionicons name="flashlight" size={22} color={Colors.amber} />
            <Text style={styles.emergencyButtonText}>Send SOS via Morse</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emergencyButton, styles.emergencyButtonRed]}
            onPress={() =>
              Alert.alert(
                'Emergency Call',
                'This feature would initiate an emergency call to local services. Not available in demo mode.',
                [{ text: 'OK' }]
              )
            }
          >
            <Ionicons name="call" size={22} color={Colors.red} />
            <Text style={[styles.emergencyButtonText, { color: Colors.red }]}>
              Emergency Call
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Header
  header: {
    marginBottom: Spacing.xxl,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Activation
  activationContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  activationCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  activationText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.green,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  activationTextActive: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.green,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  activationDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
  },

  // Cards
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  cardDescription: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },

  // Status Dashboard
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  statusItem: {
    width: '47%',
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  statusValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Inputs
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  textInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggleLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  configNote: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
    marginTop: Spacing.md,
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // Personal Info
  profilePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profilePlaceholderText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textDim,
    lineHeight: 18,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.amberDark,
  },
  profileButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.amber,
    letterSpacing: 0.5,
  },

  // Bullet list
  bulletList: {
    gap: Spacing.sm,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bulletText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },

  // Emergency actions
  emergencyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  emergencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.amberDark,
  },
  emergencyButtonRed: {
    borderColor: Colors.redDark,
  },
  emergencyButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 0.5,
  },
});
