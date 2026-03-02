import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import { useLocale, t, setLocale, SUPPORTED_LOCALES, type SupportedLocale, type LocaleInfo } from '@/services/i18n';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface QuickAction {
  id: string;
  titleKey: string;
  descKey: string;
  icon: IoniconsName;
  color: string;
  route: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'sos',
    titleKey: 'sos_emergency',
    descKey: 'sos_emergency',
    icon: 'alert-circle',
    color: Colors.red,
    route: '/(tabs)/morse',
  },
  {
    id: 'chat',
    titleKey: 'ai_chat',
    descKey: 'ai_chat',
    icon: 'chatbubbles',
    color: Colors.amber,
    route: '/(tabs)/chat',
  },
  {
    id: 'calculator',
    titleKey: 'supply_calc',
    descKey: 'supply_calc',
    icon: 'calculator',
    color: Colors.green,
    route: '/(tabs)/calculator',
  },
  {
    id: 'seeking',
    titleKey: 'seeking_mode',
    descKey: 'seeking_mode',
    icon: 'radio',
    color: Colors.cyan,
    route: '/(tabs)/seeking',
  },
];

interface StatusIndicatorProps {
  label: string;
  value: string;
  color: string;
  icon: IoniconsName;
}

function StatusIndicator({ label, value, color, icon }: StatusIndicatorProps) {
  return (
    <View style={styles.statusItem}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color }]}>{value}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const locale = useLocale();
  const [isOnline, setIsOnline] = useState(true);
  const [batteryLevel] = useState(87);
  const [gpsActive] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const getBatteryColor = (level: number): string => {
    if (level > 60) return Colors.green;
    if (level > 25) return Colors.amber;
    return Colors.red;
  };

  const currentLocaleInfo = SUPPORTED_LOCALES.find((l) => l.code === locale);

  const handleLanguageSelect = (code: SupportedLocale) => {
    setLocale(code);
    setShowLanguagePicker(false);
  };

  const renderLanguageItem = ({ item }: { item: LocaleInfo }) => (
    <TouchableOpacity
      style={[
        styles.languageItem,
        item.code === locale && styles.languageItemActive,
      ]}
      onPress={() => handleLanguageSelect(item.code)}
      activeOpacity={0.7}
    >
      <Text style={styles.languageFlag}>{item.flag}</Text>
      <View style={styles.languageTextContainer}>
        <Text style={[
          styles.languageName,
          item.code === locale && styles.languageNameActive,
        ]}>
          {item.nativeName}
        </Text>
        <Text style={styles.languageNameEn}>{item.name}</Text>
      </View>
      {item.code === locale && (
        <Ionicons name="checkmark-circle" size={20} color={Colors.amber} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAccent} />
                <Text style={styles.headerTitle}>{t('home_title')}</Text>
              </View>
              <Text style={styles.headerSubtitle}>Tactical Survival Assistant</Text>
            </View>
            {/* Language Selector */}
            <TouchableOpacity
              style={styles.languageButton}
              onPress={() => setShowLanguagePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.languageButtonFlag}>{currentLocaleInfo?.flag}</Text>
              <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusBarTitle}>SYSTEM STATUS</Text>
          <View style={styles.statusRow}>
            <StatusIndicator
              label="NET"
              value={isOnline ? t('status_online').toUpperCase() : t('status_offline').toUpperCase()}
              color={isOnline ? Colors.online : Colors.offline}
              icon={isOnline ? 'wifi' : 'wifi-outline'}
            />
            <View style={styles.statusDivider} />
            <StatusIndicator
              label="BAT"
              value={`${batteryLevel}%`}
              color={getBatteryColor(batteryLevel)}
              icon="battery-charging"
            />
            <View style={styles.statusDivider} />
            <StatusIndicator
              label="GPS"
              value={gpsActive ? 'ACTIVE' : 'INACTIVE'}
              color={gpsActive ? Colors.green : Colors.red}
              icon="location"
            />
          </View>
        </View>

        {/* Quick Actions Header */}
        <View style={styles.sectionHeader}>
          <Ionicons name="grid" size={16} color={Colors.amber} />
          <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.grid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.card, { borderLeftColor: action.color }]}
              activeOpacity={0.7}
              onPress={() => router.push(action.route as any)}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: `${action.color}15` }]}>
                <Ionicons name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.cardTitle}>{t(action.titleKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Emergency Info Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning" size={20} color={Colors.red} />
            <Text style={styles.emergencyTitle}>{t('emergency_info')}</Text>
          </View>

          {/* Rule of 3s */}
          <View style={styles.ruleOf3}>
            <Text style={styles.ruleOf3Title}>{t('rule_of_threes')}</Text>
            <View style={styles.ruleItems}>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3</Text>
                <Text style={styles.ruleText}>{t('rule_air')}</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3</Text>
                <Text style={styles.ruleText}>{t('rule_shelter')}</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3</Text>
                <Text style={styles.ruleText}>{t('rule_water')}</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleNumber}>3</Text>
                <Text style={styles.ruleText}>{t('rule_food')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.emergencyActions}>
            <TouchableOpacity
              style={[styles.emergencyButton, { backgroundColor: `${Colors.red}20` }]}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/morse' as any)}
            >
              <Ionicons name="alert-circle" size={16} color={Colors.red} />
              <Text style={[styles.emergencyButtonText, { color: Colors.red }]}>
                SOS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emergencyButton, { backgroundColor: `${Colors.cyan}20` }]}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/seeking' as any)}
            >
              <Ionicons name="radio" size={16} color={Colors.cyan} />
              <Text style={[styles.emergencyButtonText, { color: Colors.cyan }]}>
                {t('seeking_mode').toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('language')}</Text>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SUPPORTED_LOCALES}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.languageList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  // Header
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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

  // Language Button
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.xs,
  },
  languageButtonFlag: {
    fontSize: 18,
  },

  // Status Bar
  statusBar: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBarTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statusLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textDim,
    letterSpacing: 1,
  },
  statusValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
  },

  // Emergency Card
  emergencyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 2,
    borderTopColor: Colors.red,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emergencyTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.red,
    letterSpacing: 2,
  },
  ruleOf3: {
    marginBottom: Spacing.lg,
  },
  ruleOf3Title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  ruleItems: {
    gap: Spacing.sm,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  ruleNumber: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.amber,
    width: 24,
    textAlign: 'center',
  },
  ruleText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  emergencyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  emergencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emergencyButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Language Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 2,
  },
  languageList: {
    paddingHorizontal: Spacing.xl,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  languageItemActive: {
    backgroundColor: `${Colors.amber}15`,
    borderWidth: 1,
    borderColor: `${Colors.amber}30`,
  },
  languageFlag: {
    fontSize: 24,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  languageNameActive: {
    color: Colors.amber,
  },
  languageNameEn: {
    fontSize: FontSize.sm,
    color: Colors.textDim,
  },
});
