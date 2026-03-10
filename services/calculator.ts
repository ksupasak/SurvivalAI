/**
 * Survival Supply Calculator Service
 *
 * Calculates recommended emergency supplies based on group size,
 * duration, climate conditions, and activity level. Uses established
 * emergency preparedness guidelines (FEMA, Red Cross) as baselines.
 * All water quantities are in liters (~4 L/person/day base).
 */

import { t, tFormat } from '@/services/i18n';

export type Climate = 'temperate' | 'hot' | 'cold';
export type ActivityLevel = 'low' | 'moderate' | 'high';

export type CalculatorInput = {
  /** Number of people to prepare for */
  people: number;
  /** Number of days to prepare for */
  days: number;
  /** Expected climate conditions */
  climate: Climate;
  /** Expected physical activity level */
  activityLevel: ActivityLevel;
};

export type SupplyItem = {
  /** Name of the supply item */
  name: string;
  /** Emoji icon for visual recognition */
  icon: string;
  /** Recommended quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Additional notes or context */
  notes: string;
};

export type SupplyCategory = {
  /** Category key (untranslated identifier for lookups) */
  key: string;
  /** Category name (translated for display) */
  category: string;
  /** List of items in this category */
  items: SupplyItem[];
};

export type CalculatorResult = {
  /** The input parameters used for this calculation */
  input: CalculatorInput;
  /** Calculated supply categories with items */
  categories: SupplyCategory[];
  /** Summary notes about the calculation */
  notes: string[];
};

// ─── Multiplier Helpers ─────────────────────────────────────────────────────

function getClimateWaterMultiplier(climate: Climate): number {
  switch (climate) {
    case 'hot':
      return 1.5; // +50% water in hot climates
    case 'cold':
      return 1.0; // Standard in cold (less sweat, but hydration still critical)
    case 'temperate':
    default:
      return 1.0;
  }
}

function getActivityWaterMultiplier(activityLevel: ActivityLevel): number {
  switch (activityLevel) {
    case 'high':
      return 1.25; // +25% water for high activity
    case 'moderate':
      return 1.1; // +10% for moderate
    case 'low':
    default:
      return 1.0;
  }
}

function getActivityCalorieMultiplier(activityLevel: ActivityLevel): number {
  switch (activityLevel) {
    case 'high':
      return 1.5; // 3000 cal/day
    case 'moderate':
      return 1.25; // 2500 cal/day
    case 'low':
    default:
      return 1.0; // 2000 cal/day base
  }
}

// ─── Category Calculators ───────────────────────────────────────────────────

function calculateWater(input: CalculatorInput): SupplyCategory {
  const baseLitersPerPersonPerDay = 4; // ~1 gallon ≈ 3.785L, rounded up
  const climateMultiplier = getClimateWaterMultiplier(input.climate);
  const activityMultiplier = getActivityWaterMultiplier(input.activityLevel);

  const dailyPerPerson = baseLitersPerPersonPerDay * climateMultiplier * activityMultiplier;
  const totalLiters = dailyPerPerson * input.people * input.days;

  const items: SupplyItem[] = [
    {
      name: t('item_water_drinking'),
      icon: '💧',
      quantity: Math.ceil(totalLiters * 0.75),
      unit: t('unit_liters'),
      notes: tFormat('note_water_drinking', { liters: (dailyPerPerson * 0.75).toFixed(1) }),
    },
    {
      name: t('item_water_sanitation'),
      icon: '🚿',
      quantity: Math.ceil(totalLiters * 0.25),
      unit: t('unit_liters'),
      notes: t('note_water_sanitation'),
    },
    {
      name: t('item_water_purif_tabs'),
      icon: '💊',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: t('unit_tablets'),
      notes: t('note_water_purif_tabs'),
    },
    {
      name: t('item_water_filter'),
      icon: '🔍',
      quantity: Math.max(1, Math.ceil(input.people / 4)),
      unit: t('unit_filters'),
      notes: t('note_water_filter'),
    },
  ];

  return { key: 'water', category: t('cat_water'), items };
}

function calculateFood(input: CalculatorInput): SupplyCategory {
  const baseCalories = 2000;
  const calorieMultiplier = getActivityCalorieMultiplier(input.activityLevel);
  const dailyCalories = baseCalories * calorieMultiplier;

  const items: SupplyItem[] = [
    {
      name: t('item_food_freeze_dried'),
      icon: '🍱',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: t('unit_pouches'),
      notes: tFormat('note_food_freeze_dried', { cal: dailyCalories.toFixed(0) }),
    },
    {
      name: t('item_food_energy_bars'),
      icon: '🍫',
      quantity: Math.ceil(input.people * input.days * 3),
      unit: t('unit_bars'),
      notes: t('note_food_energy_bars'),
    },
    {
      name: t('item_food_canned'),
      icon: '🥫',
      quantity: Math.ceil(input.people * input.days * 1.5),
      unit: t('unit_cans'),
      notes: t('note_food_canned'),
    },
    {
      name: t('item_food_peanut_butter'),
      icon: '🥜',
      quantity: Math.ceil((input.people * input.days) / 7),
      unit: t('unit_jars_16oz'),
      notes: t('note_food_peanut_butter'),
    },
    {
      name: t('item_food_dried_fruit'),
      icon: '🍇',
      quantity: Math.ceil((input.people * input.days) / 3),
      unit: t('unit_bags_1lb'),
      notes: t('note_food_dried_fruit'),
    },
    {
      name: t('item_food_crackers'),
      icon: '🍘',
      quantity: Math.ceil((input.people * input.days) / 5),
      unit: t('unit_boxes'),
      notes: t('note_food_crackers'),
    },
    {
      name: t('item_food_electrolyte'),
      icon: '🥤',
      quantity: Math.ceil(input.people * input.days),
      unit: t('unit_packets'),
      notes: t('note_food_electrolyte'),
    },
  ];

  return { key: 'food', category: t('cat_food'), items };
}

function calculateFirstAid(input: CalculatorInput): SupplyCategory {
  const scaleFactor = Math.max(1, Math.ceil(input.people / 4));

  const items: SupplyItem[] = [
    {
      name: t('item_fa_bandages'),
      icon: '🩹',
      quantity: 25 * scaleFactor,
      unit: t('unit_pieces'),
      notes: t('note_fa_bandages'),
    },
    {
      name: t('item_fa_gauze_pads'),
      icon: '⬜',
      quantity: 12 * scaleFactor,
      unit: t('unit_pads'),
      notes: t('note_fa_gauze_pads'),
    },
    {
      name: t('item_fa_gauze_roll'),
      icon: '🩹',
      quantity: 2 * scaleFactor,
      unit: t('unit_rolls'),
      notes: t('note_fa_gauze_roll'),
    },
    {
      name: t('item_fa_medical_tape'),
      icon: '📎',
      quantity: 2 * scaleFactor,
      unit: t('unit_rolls'),
      notes: t('note_fa_medical_tape'),
    },
    {
      name: t('item_fa_antiseptic'),
      icon: '🧴',
      quantity: 20 * scaleFactor,
      unit: t('unit_wipes'),
      notes: t('note_fa_antiseptic'),
    },
    {
      name: t('item_fa_antibiotic'),
      icon: '🧴',
      quantity: 2 * scaleFactor,
      unit: t('unit_tubes'),
      notes: t('note_fa_antibiotic'),
    },
    {
      name: t('item_fa_pain_relief'),
      icon: '💊',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: t('unit_tablets'),
      notes: t('note_fa_pain_relief'),
    },
    {
      name: t('item_fa_scissors'),
      icon: '✂️',
      quantity: scaleFactor,
      unit: t('unit_pair'),
      notes: t('note_fa_scissors'),
    },
    {
      name: t('item_fa_tweezers'),
      icon: '🪡',
      quantity: scaleFactor,
      unit: t('unit_pair'),
      notes: t('note_fa_tweezers'),
    },
    {
      name: t('item_fa_elastic_band'),
      icon: '🩹',
      quantity: 2 * scaleFactor,
      unit: t('unit_rolls'),
      notes: t('note_fa_elastic_band'),
    },
    {
      name: t('item_fa_triangular'),
      icon: '📐',
      quantity: 2 * scaleFactor,
      unit: t('unit_pieces'),
      notes: t('note_fa_triangular'),
    },
    {
      name: t('item_fa_gloves'),
      icon: '🧤',
      quantity: 10 * scaleFactor,
      unit: t('unit_pairs'),
      notes: t('note_fa_gloves'),
    },
    {
      name: t('item_fa_cpr_barrier'),
      icon: '❤️',
      quantity: scaleFactor,
      unit: t('unit_pieces'),
      notes: t('note_fa_cpr_barrier'),
    },
  ];

  return { key: 'first_aid', category: t('cat_first_aid'), items };
}

function calculateHygiene(input: CalculatorInput): SupplyCategory {
  const items: SupplyItem[] = [
    {
      name: t('item_hyg_soap'),
      icon: '🧼',
      quantity: Math.ceil((input.people * input.days) / 7),
      unit: t('unit_bars_bottles'),
      notes: t('note_hyg_soap'),
    },
    {
      name: t('item_hyg_toilet_paper'),
      icon: '🧻',
      quantity: Math.ceil((input.people * input.days) / 5),
      unit: t('unit_rolls'),
      notes: t('note_hyg_toilet_paper'),
    },
    {
      name: t('item_hyg_hand_sanitizer'),
      icon: '🤲',
      quantity: Math.max(1, Math.ceil(input.people / 2)),
      unit: t('unit_bottles_8oz'),
      notes: t('note_hyg_hand_sanitizer'),
    },
    {
      name: t('item_hyg_trash_bags'),
      icon: '🗑️',
      quantity: Math.ceil(input.people * input.days * 0.5),
      unit: t('unit_bags'),
      notes: t('note_hyg_trash_bags'),
    },
    {
      name: t('item_hyg_bleach'),
      icon: '🧪',
      quantity: Math.max(1, Math.ceil(input.days / 14)),
      unit: t('unit_bottles_1qt'),
      notes: t('note_hyg_bleach'),
    },
    {
      name: t('item_hyg_toothbrush'),
      icon: '🪥',
      quantity: input.people,
      unit: t('unit_sets'),
      notes: t('note_hyg_toothbrush'),
    },
    {
      name: t('item_hyg_wet_wipes'),
      icon: '💧',
      quantity: Math.ceil(input.people * input.days),
      unit: t('unit_packs_10ct'),
      notes: t('note_hyg_wet_wipes'),
    },
  ];

  return { key: 'hygiene', category: t('cat_hygiene'), items };
}

function calculateShelter(input: CalculatorInput): SupplyCategory {
  const isCold = input.climate === 'cold';

  const items: SupplyItem[] = [
    {
      name: t('item_shlt_tarp'),
      icon: '⛺',
      quantity: Math.max(1, Math.ceil(input.people / 3)),
      unit: t('unit_tarps'),
      notes: t('note_shlt_tarp'),
    },
    {
      name: isCold ? t('item_shlt_sleeping_bag_cold') : t('item_shlt_sleeping_bag'),
      icon: isCold ? '❄️' : '🛏️',
      quantity: input.people,
      unit: t('unit_pieces'),
      notes: isCold ? t('note_shlt_sleeping_bag_cold') : t('note_shlt_sleeping_bag'),
    },
    {
      name: t('item_shlt_paracord'),
      icon: '🪢',
      quantity: Math.max(1, Math.ceil(input.people / 2)) * 100,
      unit: t('unit_feet'),
      notes: t('note_shlt_paracord'),
    },
    {
      name: t('item_shlt_duct_tape'),
      icon: '🖇️',
      quantity: Math.max(1, Math.ceil(input.people / 3)),
      unit: t('unit_rolls'),
      notes: t('note_shlt_duct_tape'),
    },
    {
      name: t('item_shlt_mylar'),
      icon: '🏅',
      quantity: input.people * 2,
      unit: t('unit_blankets'),
      notes: t('note_shlt_mylar'),
    },
  ];

  if (isCold) {
    items.push({
      name: t('item_shlt_sleeping_pad'),
      icon: '🛏️',
      quantity: input.people,
      unit: t('unit_pads'),
      notes: t('note_shlt_sleeping_pad'),
    });
  }

  return { key: 'shelter', category: t('cat_shelter'), items };
}

function calculateTools(input: CalculatorInput): SupplyCategory {
  const scaleFactor = Math.max(1, Math.ceil(input.people / 4));

  const items: SupplyItem[] = [
    {
      name: t('item_tools_flashlight'),
      icon: '🔦',
      quantity: Math.max(1, Math.ceil(input.people / 2)),
      unit: t('unit_flashlights'),
      notes: t('note_tools_flashlight'),
    },
    {
      name: t('item_tools_batteries'),
      icon: '🔋',
      quantity: Math.max(1, Math.ceil(input.people / 2)) * input.days * 2,
      unit: t('unit_batteries'),
      notes: t('note_tools_batteries'),
    },
    {
      name: t('item_tools_knife'),
      icon: '🔪',
      quantity: scaleFactor,
      unit: t('unit_knives'),
      notes: t('note_tools_knife'),
    },
    {
      name: t('item_tools_multitool'),
      icon: '🔧',
      quantity: scaleFactor,
      unit: t('unit_tools_item'),
      notes: t('note_tools_multitool'),
    },
    {
      name: t('item_tools_radio'),
      icon: '📻',
      quantity: 1,
      unit: t('unit_radio'),
      notes: t('note_tools_radio'),
    },
    {
      name: t('item_tools_whistle'),
      icon: '🎵',
      quantity: input.people,
      unit: t('unit_whistles'),
      notes: t('note_tools_whistle'),
    },
    {
      name: t('item_tools_matches'),
      icon: '🔥',
      quantity: Math.max(2, scaleFactor) * 50,
      unit: t('unit_matches'),
      notes: t('note_tools_matches'),
    },
    {
      name: t('item_tools_lighter'),
      icon: '🔥',
      quantity: Math.max(2, scaleFactor),
      unit: t('unit_lighters'),
      notes: t('note_tools_lighter'),
    },
    {
      name: t('item_tools_firestarter'),
      icon: '✨',
      quantity: scaleFactor,
      unit: t('unit_rods'),
      notes: t('note_tools_firestarter'),
    },
    {
      name: t('item_tools_can_opener'),
      icon: '🥄',
      quantity: scaleFactor,
      unit: t('unit_openers'),
      notes: t('note_tools_can_opener'),
    },
    {
      name: t('item_tools_wrench'),
      icon: '🔧',
      quantity: 1,
      unit: t('unit_wrench'),
      notes: t('note_tools_wrench'),
    },
    {
      name: t('item_tools_pliers'),
      icon: '🔩',
      quantity: 1,
      unit: t('unit_pair'),
      notes: t('note_tools_pliers'),
    },
    {
      name: t('item_tools_compass'),
      icon: '🧭',
      quantity: scaleFactor,
      unit: t('unit_compasses'),
      notes: t('note_tools_compass'),
    },
  ];

  return { key: 'tools', category: t('cat_tools'), items };
}

// ─── Main Calculator ────────────────────────────────────────────────────────

/**
 * Calculate recommended survival supplies based on the given parameters.
 *
 * Uses established emergency preparedness guidelines with adjustments for:
 * - Climate: Hot climates increase water needs by 50%
 * - Activity level: High activity increases water by 25% and calories by 50%
 * - Group size: Supplies and tools scale with the number of people
 * - Duration: Consumables scale linearly with days
 *
 * @param input - Calculator parameters (people, days, climate, activity level)
 * @returns Organized supply list with categories, items, quantities, and notes
 */
export function calculateSupplies(input: CalculatorInput): CalculatorResult {
  // Validate input
  const sanitizedInput: CalculatorInput = {
    people: Math.max(1, Math.round(input.people)),
    days: Math.max(1, Math.round(input.days)),
    climate: input.climate,
    activityLevel: input.activityLevel,
  };

  const categories: SupplyCategory[] = [
    calculateWater(sanitizedInput),
    calculateFood(sanitizedInput),
    calculateFirstAid(sanitizedInput),
    calculateHygiene(sanitizedInput),
    calculateShelter(sanitizedInput),
    calculateTools(sanitizedInput),
  ];

  // Translate climate and activity labels
  const climateLabel =
    sanitizedInput.climate === 'hot'
      ? t('climate_hot')
      : sanitizedInput.climate === 'cold'
        ? t('climate_cold')
        : t('climate_temperate');

  const activityLabel =
    sanitizedInput.activityLevel === 'high'
      ? t('activity_high')
      : sanitizedInput.activityLevel === 'moderate'
        ? t('activity_moderate')
        : t('activity_low');

  const peopleWord =
    sanitizedInput.people === 1 ? t('word_person') : t('word_people');
  const daysWord =
    sanitizedInput.days === 1 ? t('word_day') : t('word_days');

  const notes: string[] = [
    tFormat('calc_note_calculated', {
      people: String(sanitizedInput.people),
      people_word: peopleWord,
      days: String(sanitizedInput.days),
      days_word: daysWord,
    }),
    tFormat('calc_note_climate_activity', {
      climate: climateLabel,
      activity: activityLabel,
    }),
  ];

  if (sanitizedInput.climate === 'hot') {
    notes.push(t('calc_note_hot_climate'));
  }

  if (sanitizedInput.activityLevel === 'high') {
    notes.push(t('calc_note_high_activity'));
  }

  if (sanitizedInput.days > 14) {
    notes.push(t('calc_note_extended'));
  }

  return {
    input: sanitizedInput,
    categories,
    notes,
  };
}
