// ─── Color type ───────────────────────────────────────────────────────────────

export type ColorScheme = {
  bg: string;
  bgSecondary: string;
  bgTertiary: string;
  bgCard: string;
  bgCardHover: string;
  amber: string;
  amberDark: string;
  amberLight: string;
  green: string;
  greenDark: string;
  greenDim: string;
  red: string;
  redDark: string;
  redDim: string;
  blue: string;
  blueDim: string;
  cyan: string;
  text: string;
  textSecondary: string;
  textDim: string;
  textAmber: string;
  border: string;
  borderLight: string;
  online: string;
  offline: string;
  warning: string;
  overlay: string;
  transparent: string;
};

// ─── Light theme (default) ────────────────────────────────────────────────────

export const LightColors: ColorScheme = {
  bg: '#FFFFFF',
  bgSecondary: '#F8F9FA',
  bgTertiary: '#F0F2F5',
  bgCard: '#FFFFFF',
  bgCardHover: '#FFF5F5',

  amber: '#DC2626',
  amberDark: '#B91C1C',
  amberLight: '#FCA5A5',
  green: '#16A34A',
  greenDark: '#15803D',
  greenDim: '#16A34A25',
  red: '#DC2626',
  redDark: '#B91C1C',
  redDim: '#DC262620',
  blue: '#2563EB',
  blueDim: '#2563EB20',
  cyan: '#0891B2',

  text: '#111827',
  textSecondary: '#6B7280',
  textDim: '#9CA3AF',
  textAmber: '#DC2626',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  online: '#16A34A',
  offline: '#DC2626',
  warning: '#D97706',

  overlay: 'rgba(0,0,0,0.4)',
  transparent: 'transparent',
};

// ─── Dark theme (military/tactical) ──────────────────────────────────────────

export const DarkColors: ColorScheme = {
  bg: '#0a0e14',
  bgSecondary: '#161b22',
  bgTertiary: '#1a2233',
  bgCard: '#0d1117',
  bgCardHover: '#1a2233',

  amber: '#d97706',
  amberDark: '#b45309',
  amberLight: '#fbbf24',
  green: '#238636',
  greenDark: '#1a7f37',
  greenDim: '#23863625',
  red: '#da3633',
  redDark: '#b91c1c',
  redDim: '#da363320',
  blue: '#1f6feb',
  blueDim: '#1f6feb20',
  cyan: '#2dd4bf',

  text: '#e6edf3',
  textSecondary: '#8b949e',
  textDim: '#484f58',
  textAmber: '#d97706',

  border: '#21262d',
  borderLight: '#30363d',

  online: '#238636',
  offline: '#da3633',
  warning: '#d97706',

  overlay: 'rgba(0,0,0,0.6)',
  transparent: 'transparent',
};

// ─── Backward-compat default export (light theme) ────────────────────────────

export const Colors = LightColors;

// ─── Spacing, FontSize, BorderRadius ─────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  xxxl: 28,
  title: 34,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  full: 999,
};
