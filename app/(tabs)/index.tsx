import React, { useState, useMemo } from 'react';
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
import { Spacing, FontSize, BorderRadius, type ColorScheme } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocale, t, setLocale, SUPPORTED_LOCALES, type SupportedLocale, type LocaleInfo } from '@/services/i18n';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface QuickAction {
  id: string;
  titleKey: string;
  icon: IoniconsName;
  colorKey: keyof ColorScheme;
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'sos',        titleKey: 'sos_emergency', icon: 'alert-circle',  colorKey: 'red',   route: '/(tabs)/morse' },
  { id: 'chat',       titleKey: 'ai_chat',       icon: 'chatbubbles',   colorKey: 'amber', route: '/(tabs)/chat' },
  { id: 'calculator', titleKey: 'supply_calc',   icon: 'calculator',    colorKey: 'green', route: '/(tabs)/calculator' },
  { id: 'seeking',    titleKey: 'seeking_mode',  icon: 'radio',         colorKey: 'cyan',  route: '/(tabs)/seeking' },
];

export default function HomeScreen() {
  const router = useRouter();
  const locale = useLocale();
  const { colors, isDark, toggleTheme } = useTheme();
  const [isOnline] = useState(true);
  const [batteryLevel] = useState(87);
  const [gpsActive] = useState(true);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const getBatteryColor = (level: number): string => {
    if (level > 60) return colors.green;
    if (level > 25) return colors.amber;
    return colors.red;
  };

  const currentLocaleInfo = SUPPORTED_LOCALES.find((l) => l.code === locale);

  const handleLanguageSelect = (code: SupportedLocale) => {
    setLocale(code);
    setShowLanguagePicker(false);
  };

  const renderLanguageItem = ({ item }: { item: LocaleInfo }) => (
    <TouchableOpacity
      style={[styles.languageItem, item.code === locale && styles.languageItemActive]}
      onPress={() => handleLanguageSelect(item.code)}
      activeOpacity={0.7}
    >
      <Text style={styles.languageFlag}>{item.flag}</Text>
      <View style={styles.languageTextContainer}>
        <Text style={[styles.languageName, item.code === locale && styles.languageNameActive]}>{item.nativeName}</Text>
        <Text style={styles.languageNameEn}>{item.name}</Text>
      </View>
      {item.code === locale && <Ionicons name="checkmark-circle" size={20} color={colors.amber} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAccent} />
                <Text style={styles.headerTitle}>{t('home_title')}</Text>
              </View>
              <Text style={styles.headerSubtitle}>Tactical Survival Assistant</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs }}>
              {/* Theme toggle */}
              <TouchableOpacity style={styles.iconButton} onPress={toggleTheme} activeOpacity={0.7}>
                <Ionicons name={isDark ? 'sunny' : 'moon'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              {/* Language selector */}
              <TouchableOpacity style={styles.languageButton} onPress={() => setShowLanguagePicker(true)} activeOpacity={0.7}>
                <Text style={styles.languageButtonFlag}>{currentLocaleInfo?.flag}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusBarTitle}>SYSTEM STATUS</Text>
          <View style={styles.statusRow}>
            {[
              { label: 'NET', value: isOnline ? t('status_online').toUpperCase() : t('status_offline').toUpperCase(), color: isOnline ? colors.online : colors.offline, icon: isOnline ? 'wifi' : 'wifi-outline' as IoniconsName },
              { label: 'BAT', value: `${batteryLevel}%`, color: getBatteryColor(batteryLevel), icon: 'battery-charging' as IoniconsName },
              { label: 'GPS', value: gpsActive ? 'ACTIVE' : 'INACTIVE', color: gpsActive ? colors.green : colors.red, icon: 'location' as IoniconsName },
            ].map((item, i) => (
              <React.Fragment key={item.label}>
                {i > 0 && <View style={styles.statusDivider} />}
                <View style={styles.statusItem}>
                  <Ionicons name={item.icon} size={14} color={item.color} />
                  <Text style={styles.statusLabel}>{item.label}</Text>
                  <Text style={[styles.statusValue, { color: item.color }]}>{item.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Ionicons name="grid" size={16} color={colors.amber} />
          <Text style={styles.sectionTitle}>{t('quick_actions')}</Text>
        </View>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => {
            const color = colors[action.colorKey] as string;
            return (
              <TouchableOpacity
                key={action.id}
                style={[styles.card, { borderLeftColor: color }]}
                activeOpacity={0.7}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.cardIconContainer, { backgroundColor: `${color}15` }]}>
                  <Ionicons name={action.icon} size={24} color={color} />
                </View>
                <Text style={styles.cardTitle}>{t(action.titleKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Emergency Card */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyHeader}>
            <Ionicons name="warning" size={20} color={colors.red} />
            <Text style={styles.emergencyTitle}>{t('emergency_info')}</Text>
          </View>
          <View style={styles.ruleOf3}>
            <Text style={styles.ruleOf3Title}>{t('rule_of_threes')}</Text>
            <View style={styles.ruleItems}>
              {[t('rule_air'), t('rule_shelter'), t('rule_water'), t('rule_food')].map((rule) => (
                <View key={rule} style={styles.ruleItem}>
                  <Text style={styles.ruleNumber}>3</Text>
                  <Text style={styles.ruleText}>{rule}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.emergencyActions}>
            <TouchableOpacity style={[styles.emergencyButton, { backgroundColor: `${colors.red}20` }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/morse' as any)}>
              <Ionicons name="alert-circle" size={16} color={colors.red} />
              <Text style={[styles.emergencyButtonText, { color: colors.red }]}>SOS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.emergencyButton, { backgroundColor: `${colors.cyan}20` }]} activeOpacity={0.7} onPress={() => router.push('/(tabs)/seeking' as any)}>
              <Ionicons name="radio" size={16} color={colors.cyan} />
              <Text style={[styles.emergencyButtonText, { color: colors.cyan }]}>{t('seeking_mode').toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal visible={showLanguagePicker} transparent animationType="slide" onRequestClose={() => setShowLanguagePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('language')}</Text>
              <TouchableOpacity onPress={() => setShowLanguagePicker(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
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

function createStyles(c: ColorScheme) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: c.bg },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxxl },

    header: { paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
    headerAccent: { width: 4, height: 28, backgroundColor: c.amber, borderRadius: 2, marginRight: Spacing.md },
    headerTitle: { fontSize: FontSize.title, fontWeight: '800', color: c.text, letterSpacing: 3 },
    headerSubtitle: { fontSize: FontSize.md, color: c.textSecondary, letterSpacing: 1, marginLeft: Spacing.lg + Spacing.xs },

    iconButton: { width: 36, height: 36, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    languageButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.border },
    languageButtonFlag: { fontSize: 18 },

    statusBar: { backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.xxl, borderWidth: 1, borderColor: c.border },
    statusBarTitle: { fontSize: FontSize.xs, fontWeight: '700', color: c.textSecondary, letterSpacing: 2, marginBottom: Spacing.md },
    statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statusItem: { flex: 1, alignItems: 'center', gap: Spacing.xs },
    statusLabel: { fontSize: FontSize.xs, fontWeight: '600', color: c.textDim, letterSpacing: 1 },
    statusValue: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 0.5 },
    statusDivider: { width: 1, height: 32, backgroundColor: c.border },

    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: c.textSecondary, letterSpacing: 2 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xxl },
    card: { width: '48%', flexGrow: 1, flexBasis: '45%', backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: c.border, borderLeftWidth: 3 },
    cardIconContainer: { width: 44, height: 44, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
    cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: c.text, letterSpacing: 0.5 },

    emergencyCard: { backgroundColor: c.bgCard, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: c.border, borderTopWidth: 2, borderTopColor: c.red },
    emergencyHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    emergencyTitle: { fontSize: FontSize.sm, fontWeight: '700', color: c.red, letterSpacing: 2 },
    ruleOf3: { marginBottom: Spacing.lg },
    ruleOf3Title: { fontSize: FontSize.sm, fontWeight: '700', color: c.amber, letterSpacing: 1, marginBottom: Spacing.md },
    ruleItems: { gap: Spacing.sm },
    ruleItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    ruleNumber: { fontSize: FontSize.xl, fontWeight: '800', color: c.amber, width: 24, textAlign: 'center' },
    ruleText: { fontSize: FontSize.sm, color: c.textSecondary, flex: 1 },
    emergencyActions: { flexDirection: 'row', gap: Spacing.md },
    emergencyButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
    emergencyButtonText: { fontSize: FontSize.sm, fontWeight: '700', letterSpacing: 1 },

    modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: Spacing.lg, paddingBottom: Spacing.xl + 20, maxHeight: '70%', borderTopWidth: 1, borderTopColor: c.border },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl, marginBottom: Spacing.lg },
    modalTitle: { fontSize: FontSize.xl, fontWeight: '800', color: c.text, letterSpacing: 2 },
    languageList: { paddingHorizontal: Spacing.xl },
    languageItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.xs, gap: Spacing.md },
    languageItemActive: { backgroundColor: `${c.amber}15`, borderWidth: 1, borderColor: `${c.amber}30` },
    languageFlag: { fontSize: 24 },
    languageTextContainer: { flex: 1 },
    languageName: { fontSize: FontSize.md, fontWeight: '600', color: c.text },
    languageNameActive: { color: c.amber },
    languageNameEn: { fontSize: FontSize.sm, color: c.textDim },
  });
}
