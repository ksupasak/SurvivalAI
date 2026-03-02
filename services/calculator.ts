/**
 * Survival Supply Calculator Service
 *
 * Calculates recommended emergency supplies based on group size,
 * duration, climate conditions, and activity level. Uses established
 * emergency preparedness guidelines (FEMA, Red Cross) as baselines.
 */

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
  /** Recommended quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Additional notes or context */
  notes: string;
};

export type SupplyCategory = {
  /** Category name */
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
  const baseGallonsPerPersonPerDay = 1; // FEMA standard
  const climateMultiplier = getClimateWaterMultiplier(input.climate);
  const activityMultiplier = getActivityWaterMultiplier(input.activityLevel);

  const dailyPerPerson = baseGallonsPerPersonPerDay * climateMultiplier * activityMultiplier;
  const totalGallons = dailyPerPerson * input.people * input.days;

  const items: SupplyItem[] = [
    {
      name: 'Drinking water',
      quantity: Math.ceil(totalGallons * 0.75),
      unit: 'gallons',
      notes: `${(dailyPerPerson * 0.75).toFixed(1)} gal/person/day for drinking`,
    },
    {
      name: 'Sanitation/cooking water',
      quantity: Math.ceil(totalGallons * 0.25),
      unit: 'gallons',
      notes: 'For hygiene, cooking, and cleaning',
    },
    {
      name: 'Water purification tablets',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: 'tablets',
      notes: 'Backup purification, 2 per person per day',
    },
    {
      name: 'Portable water filter',
      quantity: Math.max(1, Math.ceil(input.people / 4)),
      unit: 'filters',
      notes: 'Gravity or pump filter for natural water sources',
    },
  ];

  return { category: 'Water', items };
}

function calculateFood(input: CalculatorInput): SupplyCategory {
  const baseCalories = 2000;
  const calorieMultiplier = getActivityCalorieMultiplier(input.activityLevel);
  const dailyCalories = baseCalories * calorieMultiplier;
  const totalCalories = dailyCalories * input.people * input.days;

  // Calculate specific food items scaled to needs
  const items: SupplyItem[] = [
    {
      name: 'Freeze-dried meals',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: 'pouches',
      notes: `~250 cal each, for main meals (${dailyCalories.toFixed(0)} cal/person/day target)`,
    },
    {
      name: 'Energy/granola bars',
      quantity: Math.ceil(input.people * input.days * 3),
      unit: 'bars',
      notes: '~200 cal each, for snacks and quick energy',
    },
    {
      name: 'Canned goods (meat, beans, vegetables)',
      quantity: Math.ceil(input.people * input.days * 1.5),
      unit: 'cans',
      notes: '~300 cal each, shelf-stable protein and nutrients',
    },
    {
      name: 'Peanut butter',
      quantity: Math.ceil((input.people * input.days) / 7),
      unit: 'jars (16oz)',
      notes: 'High calorie density, ~190 cal per serving',
    },
    {
      name: 'Dried fruit and nuts',
      quantity: Math.ceil((input.people * input.days) / 3),
      unit: 'bags (1lb)',
      notes: 'Calorie-dense, no preparation needed',
    },
    {
      name: 'Crackers or hardtack',
      quantity: Math.ceil((input.people * input.days) / 5),
      unit: 'boxes',
      notes: 'Long shelf life, carbohydrate source',
    },
    {
      name: 'Electrolyte drink mix',
      quantity: Math.ceil(input.people * input.days),
      unit: 'packets',
      notes: 'Replace salts lost through perspiration',
    },
  ];

  return { category: 'Food', items };
}

function calculateFirstAid(input: CalculatorInput): SupplyCategory {
  const scaleFactor = Math.max(1, Math.ceil(input.people / 4));

  const items: SupplyItem[] = [
    {
      name: 'Adhesive bandages (assorted)',
      quantity: 25 * scaleFactor,
      unit: 'pieces',
      notes: 'Various sizes for cuts and blisters',
    },
    {
      name: 'Sterile gauze pads (4x4)',
      quantity: 12 * scaleFactor,
      unit: 'pads',
      notes: 'For wound dressing',
    },
    {
      name: 'Gauze roll',
      quantity: 2 * scaleFactor,
      unit: 'rolls',
      notes: 'For wrapping wounds and sprains',
    },
    {
      name: 'Medical tape',
      quantity: 2 * scaleFactor,
      unit: 'rolls',
      notes: 'Hypoallergenic, for securing bandages',
    },
    {
      name: 'Antiseptic wipes',
      quantity: 20 * scaleFactor,
      unit: 'wipes',
      notes: 'Wound cleaning, infection prevention',
    },
    {
      name: 'Antibiotic ointment',
      quantity: 2 * scaleFactor,
      unit: 'tubes',
      notes: 'Apply to wounds to prevent infection',
    },
    {
      name: 'Pain relievers (ibuprofen/acetaminophen)',
      quantity: Math.ceil(input.people * input.days * 2),
      unit: 'tablets',
      notes: 'Up to 2 doses per person per day if needed',
    },
    {
      name: 'Scissors (medical)',
      quantity: scaleFactor,
      unit: 'pair',
      notes: 'For cutting tape, gauze, and clothing',
    },
    {
      name: 'Tweezers',
      quantity: scaleFactor,
      unit: 'pair',
      notes: 'Splinter and tick removal',
    },
    {
      name: 'Elastic bandage (ACE wrap)',
      quantity: 2 * scaleFactor,
      unit: 'rolls',
      notes: 'For sprains and compression',
    },
    {
      name: 'Triangular bandage',
      quantity: 2 * scaleFactor,
      unit: 'pieces',
      notes: 'Sling, tourniquet, or bandage',
    },
    {
      name: 'Disposable gloves',
      quantity: 10 * scaleFactor,
      unit: 'pairs',
      notes: 'Nitrile, for wound care hygiene',
    },
    {
      name: 'CPR breathing barrier',
      quantity: scaleFactor,
      unit: 'pieces',
      notes: 'For safe rescue breathing',
    },
  ];

  return { category: 'First Aid', items };
}

function calculateHygiene(input: CalculatorInput): SupplyCategory {
  const items: SupplyItem[] = [
    {
      name: 'Bar soap or body wash',
      quantity: Math.ceil((input.people * input.days) / 7),
      unit: 'bars/bottles',
      notes: 'One bar per person per week',
    },
    {
      name: 'Toilet paper',
      quantity: Math.ceil((input.people * input.days) / 5),
      unit: 'rolls',
      notes: 'Approximately 1 roll per person per 5 days',
    },
    {
      name: 'Hand sanitizer',
      quantity: Math.max(1, Math.ceil(input.people / 2)),
      unit: 'bottles (8oz)',
      notes: 'At least 60% alcohol, when water unavailable',
    },
    {
      name: 'Trash bags (heavy duty)',
      quantity: Math.ceil(input.people * input.days * 0.5),
      unit: 'bags',
      notes: 'Waste disposal, rain protection, ground cover',
    },
    {
      name: 'Bleach (unscented)',
      quantity: Math.max(1, Math.ceil(input.days / 14)),
      unit: 'bottles (1qt)',
      notes: 'Water purification (8 drops/gal) and sanitation',
    },
    {
      name: 'Toothbrush and toothpaste',
      quantity: input.people,
      unit: 'sets',
      notes: 'One per person',
    },
    {
      name: 'Wet wipes',
      quantity: Math.ceil(input.people * input.days),
      unit: 'packs (10ct)',
      notes: 'Personal hygiene when bathing is unavailable',
    },
  ];

  return { category: 'Hygiene', items };
}

function calculateShelter(input: CalculatorInput): SupplyCategory {
  const isCold = input.climate === 'cold';

  const items: SupplyItem[] = [
    {
      name: 'Tarp (10x12 ft)',
      quantity: Math.max(1, Math.ceil(input.people / 3)),
      unit: 'tarps',
      notes: 'Rain shelter, ground cover, windbreak',
    },
    {
      name: isCold ? 'Cold-weather sleeping bag' : 'Blanket/sleeping bag',
      quantity: input.people,
      unit: 'pieces',
      notes: isCold
        ? 'Rated to 0F or below for cold climate'
        : 'Standard weight, one per person',
    },
    {
      name: 'Paracord (550)',
      quantity: Math.max(1, Math.ceil(input.people / 2)) * 100,
      unit: 'feet',
      notes: 'Shelter building, gear repair, general utility',
    },
    {
      name: 'Duct tape',
      quantity: Math.max(1, Math.ceil(input.people / 3)),
      unit: 'rolls',
      notes: 'Repairs, sealing, improvised tools',
    },
    {
      name: 'Emergency mylar blankets',
      quantity: input.people * 2,
      unit: 'blankets',
      notes: 'Lightweight backup warmth, signaling',
    },
  ];

  if (isCold) {
    items.push({
      name: 'Insulated sleeping pad',
      quantity: input.people,
      unit: 'pads',
      notes: 'Ground insulation critical in cold weather',
    });
  }

  return { category: 'Shelter', items };
}

function calculateTools(input: CalculatorInput): SupplyCategory {
  const scaleFactor = Math.max(1, Math.ceil(input.people / 4));

  const items: SupplyItem[] = [
    {
      name: 'Flashlight (LED)',
      quantity: Math.max(1, Math.ceil(input.people / 2)),
      unit: 'flashlights',
      notes: 'Waterproof preferred, for signaling and navigation',
    },
    {
      name: 'Batteries (assorted AA/AAA)',
      quantity: Math.max(1, Math.ceil(input.people / 2)) * input.days * 2,
      unit: 'batteries',
      notes: 'Spares for flashlights and radio',
    },
    {
      name: 'Fixed-blade knife',
      quantity: scaleFactor,
      unit: 'knives',
      notes: 'Full tang, 4-6 inch blade for wood processing and food prep',
    },
    {
      name: 'Multi-tool',
      quantity: scaleFactor,
      unit: 'tools',
      notes: 'Pliers, knife, screwdriver, can opener combo',
    },
    {
      name: 'AM/FM emergency radio',
      quantity: 1,
      unit: 'radio',
      notes: 'Hand-crank or solar-powered preferred',
    },
    {
      name: 'Whistle (safety)',
      quantity: input.people,
      unit: 'whistles',
      notes: 'Pealess design, audible up to 1 mile, one per person',
    },
    {
      name: 'Waterproof matches',
      quantity: Math.max(2, scaleFactor) * 50,
      unit: 'matches',
      notes: 'In waterproof container',
    },
    {
      name: 'Lighter (butane)',
      quantity: Math.max(2, scaleFactor),
      unit: 'lighters',
      notes: 'Backup fire starting',
    },
    {
      name: 'Ferrocerium rod (fire starter)',
      quantity: scaleFactor,
      unit: 'rods',
      notes: 'Works when wet, unlimited shelf life',
    },
    {
      name: 'Can opener (manual)',
      quantity: scaleFactor,
      unit: 'openers',
      notes: 'P-38 military style or standard',
    },
    {
      name: 'Adjustable wrench',
      quantity: 1,
      unit: 'wrench',
      notes: 'For turning off utilities if needed',
    },
    {
      name: 'Pliers',
      quantity: 1,
      unit: 'pair',
      notes: 'Needle-nose preferred, multi-purpose',
    },
    {
      name: 'Compass',
      quantity: scaleFactor,
      unit: 'compasses',
      notes: 'Baseplate style with declination adjustment',
    },
  ];

  return { category: 'Tools', items };
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

  const notes: string[] = [
    `Calculated for ${sanitizedInput.people} ${sanitizedInput.people === 1 ? 'person' : 'people'} over ${sanitizedInput.days} ${sanitizedInput.days === 1 ? 'day' : 'days'}.`,
    `Climate: ${sanitizedInput.climate} | Activity level: ${sanitizedInput.activityLevel}.`,
  ];

  if (sanitizedInput.climate === 'hot') {
    notes.push('Hot climate: Water quantities increased by 50% to account for higher perspiration.');
  }

  if (sanitizedInput.activityLevel === 'high') {
    notes.push(
      'High activity: Water increased by 25% and calorie targets raised to 3000 cal/person/day.'
    );
  }

  if (sanitizedInput.days > 14) {
    notes.push(
      'Extended duration: Consider rotating perishable supplies and supplementing with foraging/hunting if trained.'
    );
  }

  return {
    input: sanitizedInput,
    categories,
    notes,
  };
}
