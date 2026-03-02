import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '@/constants/theme';
import {
  calculateSupplies,
  CalculatorInput,
  CalculatorResult,
  SupplyCategory,
  Climate,
  ActivityLevel,
} from '@/services/calculator';

type IoniconsName = keyof typeof Ionicons.glyphMap;

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CLIMATE_OPTIONS: { value: Climate; label: string; icon: IoniconsName }[] = [
  { value: 'temperate', label: 'Temperate', icon: 'thermometer-outline' },
  { value: 'hot', label: 'Hot', icon: 'sunny-outline' },
  { value: 'cold', label: 'Cold', icon: 'snow-outline' },
];

const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  color: string;
}[] = [
  { value: 'low', label: 'Low', color: Colors.green },
  { value: 'moderate', label: 'Moderate', color: Colors.amber },
  { value: 'high', label: 'High', color: Colors.red },
];

const DAY_PRESETS = [3, 7, 14, 30];

const CATEGORY_ICONS: Record<string, IoniconsName> = {
  Water: 'water-outline',
  Food: 'fast-food-outline',
  'First Aid': 'medkit-outline',
  Hygiene: 'body-outline',
  Shelter: 'home-outline',
  Tools: 'construct-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  Water: Colors.blue,
  Food: Colors.amber,
  'First Aid': Colors.red,
  Hygiene: Colors.cyan,
  Shelter: Colors.green,
  Tools: Colors.textSecondary,
};

// ─── Stepper Component ──────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  suffix?: string;
}

function Stepper({ label, value, min, max, step = 1, onValueChange, suffix }: StepperProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View style={styles.stepperContainer}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[
            styles.stepperButton,
            !canDecrement && styles.stepperButtonDisabled,
          ]}
          activeOpacity={0.6}
          onPress={() => canDecrement && onValueChange(Math.max(min, value - step))}
          disabled={!canDecrement}
        >
          <Ionicons
            name="remove"
            size={20}
            color={canDecrement ? Colors.text : Colors.textDim}
          />
        </TouchableOpacity>
        <View style={styles.stepperValueContainer}>
          <Text style={styles.stepperValue}>{value}</Text>
          {suffix && <Text style={styles.stepperSuffix}>{suffix}</Text>}
        </View>
        <TouchableOpacity
          style={[
            styles.stepperButton,
            !canIncrement && styles.stepperButtonDisabled,
          ]}
          activeOpacity={0.6}
          onPress={() => canIncrement && onValueChange(Math.min(max, value + step))}
          disabled={!canIncrement}
        >
          <Ionicons
            name="add"
            size={20}
            color={canIncrement ? Colors.text : Colors.textDim}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Category Card Component ────────────────────────────────────────────────

interface CategoryCardProps {
  category: SupplyCategory;
  isExpanded: boolean;
  onToggle: () => void;
  checkedItems: Set<string>;
  onToggleItem: (key: string) => void;
}

function CategoryCard({
  category,
  isExpanded,
  onToggle,
  checkedItems,
  onToggleItem,
}: CategoryCardProps) {
  const icon = CATEGORY_ICONS[category.category] || 'cube-outline';
  const color = CATEGORY_COLORS[category.category] || Colors.textSecondary;
  const checkedCount = category.items.filter((_, i) =>
    checkedItems.has(`${category.category}-${i}`)
  ).length;

  return (
    <View style={[styles.categoryCard, { borderLeftColor: color }]}>
      <TouchableOpacity
        style={styles.categoryHeader}
        activeOpacity={0.7}
        onPress={onToggle}
      >
        <View style={[styles.categoryIconContainer, { backgroundColor: `${color}15` }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={styles.categoryName}>{category.category}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            {checkedCount}/{category.items.length}
          </Text>
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.categoryItems}>
          {category.items.map((item, idx) => {
            const key = `${category.category}-${idx}`;
            const isChecked = checkedItems.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={styles.supplyItem}
                activeOpacity={0.7}
                onPress={() => onToggleItem(key)}
              >
                <View
                  style={[
                    styles.checkbox,
                    isChecked && styles.checkboxChecked,
                  ]}
                >
                  {isChecked && (
                    <Ionicons name="checkmark" size={14} color={Colors.bg} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text
                    style={[
                      styles.itemName,
                      isChecked && styles.itemNameChecked,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.notes ? (
                    <Text style={styles.itemNotes}>{item.notes}</Text>
                  ) : null}
                </View>
                <View style={styles.itemQuantity}>
                  <Text style={styles.quantityNumber}>{item.quantity}</Text>
                  <Text style={styles.quantityUnit}>{item.unit}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function CalculatorScreen() {
  // Input state
  const [people, setPeople] = useState(2);
  const [days, setDays] = useState(3);
  const [climate, setClimate] = useState<Climate>('temperate');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // Result state
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [isCalculatePressed, setIsCalculatePressed] = useState(false);

  // ─── Derived values ────────────────────────────────────────────────

  const totalItems = useMemo(() => {
    if (!result) return 0;
    return result.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }, [result]);

  const checkedCount = checkedItems.size;

  const progressPercent = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  const progressColor = useMemo(() => {
    if (progressPercent < 33) return Colors.red;
    if (progressPercent < 66) return Colors.amber;
    return Colors.green;
  }, [progressPercent]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleCalculate = useCallback(() => {
    const input: CalculatorInput = { people, days, climate, activityLevel };
    const calcResult = calculateSupplies(input);

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setResult(calcResult);
    setCheckedItems(new Set());
    // Expand all categories by default
    setExpandedCategories(new Set(calcResult.categories.map((c) => c.category)));
  }, [people, days, climate, activityLevel]);

  const toggleCategory = useCallback((categoryName: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }, []);

  const toggleItem = useCallback((key: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    Alert.alert(
      'Export Supply List',
      'Export feature coming soon. You will be able to share your calculated supply list as a PDF or text file.',
      [{ text: 'OK', style: 'default' }]
    );
  }, []);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerAccent} />
            <Text style={styles.headerTitle}>SUPPLY CALCULATOR</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            Calculate survival supplies for your group
          </Text>
        </View>

        {/* ── Input Card ─────────────────────────────────────── */}
        <View style={styles.inputCard}>
          <View style={styles.inputCardHeader}>
            <Ionicons name="options-outline" size={16} color={Colors.amber} />
            <Text style={styles.inputCardTitle}>PARAMETERS</Text>
          </View>

          {/* People Stepper */}
          <Stepper
            label="NUMBER OF PEOPLE"
            value={people}
            min={1}
            max={50}
            onValueChange={setPeople}
          />

          <View style={styles.divider} />

          {/* Days Stepper + Presets */}
          <Stepper
            label="NUMBER OF DAYS"
            value={days}
            min={1}
            max={365}
            onValueChange={setDays}
            suffix={days === 1 ? 'day' : 'days'}
          />
          <View style={styles.presetRow}>
            {DAY_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[
                  styles.presetButton,
                  days === preset && styles.presetButtonActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setDays(preset)}
              >
                <Text
                  style={[
                    styles.presetText,
                    days === preset && styles.presetTextActive,
                  ]}
                >
                  {preset}d
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.presetButton,
                days === 3 && styles.presetButtonActive,
                styles.presetButtonWide,
              ]}
              activeOpacity={0.7}
              onPress={() => setDays(3)}
            >
              <Text
                style={[
                  styles.presetText,
                  days === 3 && styles.presetTextActive,
                ]}
              >
                72hrs
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Climate Selection */}
          <Text style={styles.fieldLabel}>CLIMATE</Text>
          <View style={styles.pillRow}>
            {CLIMATE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pillButton,
                  climate === opt.value && styles.pillButtonActive,
                ]}
                activeOpacity={0.7}
                onPress={() => setClimate(opt.value)}
              >
                <Ionicons
                  name={opt.icon}
                  size={16}
                  color={climate === opt.value ? Colors.bg : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.pillText,
                    climate === opt.value && styles.pillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.divider} />

          {/* Activity Level */}
          <Text style={styles.fieldLabel}>ACTIVITY LEVEL</Text>
          <View style={styles.pillRow}>
            {ACTIVITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.pillButton,
                  activityLevel === opt.value && {
                    backgroundColor: opt.color,
                    borderColor: opt.color,
                  },
                ]}
                activeOpacity={0.7}
                onPress={() => setActivityLevel(opt.value)}
              >
                <Text
                  style={[
                    styles.pillText,
                    activityLevel === opt.value && {
                      color: Colors.bg,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Calculate Button ───────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.calculateButton,
            isCalculatePressed && styles.calculateButtonPressed,
          ]}
          activeOpacity={0.8}
          onPressIn={() => setIsCalculatePressed(true)}
          onPressOut={() => setIsCalculatePressed(false)}
          onPress={handleCalculate}
        >
          <Ionicons name="calculator" size={22} color={Colors.bg} />
          <Text style={styles.calculateButtonText}>CALCULATE SUPPLIES</Text>
        </TouchableOpacity>

        {/* ── Results ─────────────────────────────────────────── */}
        {result && (
          <View style={styles.resultsContainer}>
            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryIconRow}>
                <Ionicons name="clipboard-outline" size={20} color={Colors.amber} />
                <Text style={styles.summaryTitle}>SUPPLY SUMMARY</Text>
              </View>
              <Text style={styles.summaryText}>
                {result.input.people}{' '}
                {result.input.people === 1 ? 'person' : 'people'} for{' '}
                {result.input.days} {result.input.days === 1 ? 'day' : 'days'} in{' '}
                {result.input.climate} climate
              </Text>
              <View style={styles.summaryMeta}>
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="fitness-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.summaryMetaText}>
                    {result.input.activityLevel} activity
                  </Text>
                </View>
                <View style={styles.summaryMetaItem}>
                  <Ionicons name="cube-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.summaryMetaText}>
                    {totalItems} items total
                  </Text>
                </View>
              </View>
            </View>

            {/* Progress Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={progressColor}
                />
                <Text style={styles.progressTitle}>PREPARATION PROGRESS</Text>
                <Text style={[styles.progressCount, { color: progressColor }]}>
                  {checkedCount} of {totalItems} items
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${progressPercent}%`,
                      backgroundColor: progressColor,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {Math.round(progressPercent)}% prepared
              </Text>
            </View>

            {/* Category Cards */}
            {result.categories.map((category) => (
              <CategoryCard
                key={category.category}
                category={category}
                isExpanded={expandedCategories.has(category.category)}
                onToggle={() => toggleCategory(category.category)}
                checkedItems={checkedItems}
                onToggleItem={toggleItem}
              />
            ))}

            {/* Notes Section */}
            {result.notes.length > 0 && (
              <View style={styles.notesSection}>
                <View style={styles.notesSectionHeader}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={Colors.cyan}
                  />
                  <Text style={styles.notesSectionTitle}>NOTES</Text>
                </View>
                {result.notes.map((note, idx) => (
                  <View key={idx} style={styles.noteCard}>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={Colors.cyan}
                      style={styles.noteIcon}
                    />
                    <Text style={styles.noteText}>{note}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Export Button */}
            <TouchableOpacity
              style={styles.exportButton}
              activeOpacity={0.7}
              onPress={handleExport}
            >
              <Ionicons name="share-outline" size={18} color={Colors.amber} />
              <Text style={styles.exportButtonText}>EXPORT SUPPLY LIST</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
    paddingBottom: 120,
  },

  // ── Header ──────────────────────────────────────────────
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
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
    fontSize: FontSize.xxxl,
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

  // ── Input Card ──────────────────────────────────────────
  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  inputCardTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },

  // ── Stepper ─────────────────────────────────────────────
  stepperContainer: {
    marginBottom: Spacing.sm,
  },
  stepperLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.bgSecondary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.35,
  },
  stepperValueContainer: {
    minWidth: 80,
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: FontSize.xxxl,
    fontWeight: '800',
    color: Colors.amber,
    letterSpacing: 1,
  },
  stepperSuffix: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },

  // ── Day Presets ─────────────────────────────────────────
  presetRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    justifyContent: 'center',
  },
  presetButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgSecondary,
  },
  presetButtonActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  presetButtonWide: {
    paddingHorizontal: Spacing.lg,
  },
  presetText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  presetTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },

  // ── Field Label ─────────────────────────────────────────
  fieldLabel: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textDim,
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },

  // ── Pill Buttons ────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgSecondary,
  },
  pillButtonActive: {
    backgroundColor: Colors.amber,
    borderColor: Colors.amber,
  },
  pillText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.bg,
    fontWeight: '700',
  },

  // ── Calculate Button ────────────────────────────────────
  calculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.amber,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xxl,
  },
  calculateButtonPressed: {
    opacity: 0.85,
    backgroundColor: Colors.amberDark,
  },
  calculateButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.bg,
    letterSpacing: 2,
  },

  // ── Results Container ───────────────────────────────────
  resultsContainer: {
    gap: Spacing.md,
  },

  // ── Summary Card ────────────────────────────────────────
  summaryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 2,
    borderTopColor: Colors.amber,
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  summaryText: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: 0.5,
    textTransform: 'capitalize',
    marginBottom: Spacing.md,
  },
  summaryMeta: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  summaryMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  summaryMetaText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },

  // ── Progress Card ───────────────────────────────────────
  progressCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progressTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
    flex: 1,
  },
  progressCount: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.bgSecondary,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  progressPercent: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    textAlign: 'right',
    letterSpacing: 0.5,
  },

  // ── Category Card ───────────────────────────────────────
  categoryCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: Colors.bgSecondary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // ── Category Items ──────────────────────────────────────
  categoryItems: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  supplyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  itemNameChecked: {
    color: Colors.textDim,
    textDecorationLine: 'line-through',
  },
  itemNotes: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    marginTop: 2,
    lineHeight: 15,
  },
  itemQuantity: {
    alignItems: 'flex-end',
  },
  quantityNumber: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.amber,
  },
  quantityUnit: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },

  // ── Notes Section ───────────────────────────────────────
  notesSection: {
    marginTop: Spacing.sm,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  notesSectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 2,
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  noteIcon: {
    marginTop: 2,
  },
  noteText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },

  // ── Export Button ───────────────────────────────────────
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.amber,
    backgroundColor: `${Colors.amber}10`,
    marginTop: Spacing.sm,
  },
  exportButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.amber,
    letterSpacing: 1.5,
  },
});
