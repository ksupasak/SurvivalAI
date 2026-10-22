module.exports = {
  root: true,
  extends: [
    'expo',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-require-imports': 'warn',

    // React
    'react/react-in-jsx-scope': 'off',       // Not needed in React 17+
    'react/prop-types': 'off',               // We use TypeScript for types
    'react/display-name': 'off',

    // React Hooks
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // React Compiler rules, which arrived at error level with
    // eslint-plugin-react-hooks v7. This codebase does not run the compiler,
    // and the patterns flagged here (resetting derived state when a mode
    // toggles, seeding state from an async device read) are deliberate. Kept
    // visible as warnings rather than silenced, so they can be addressed if
    // the compiler is ever adopted.
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',

    // React Native
    'react-native/no-unused-styles': 'off', // false positives with style factory functions
    'react-native/split-platform-components': 'off',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-color-literals': 'off',  // We use a theme system
    'react-native/no-raw-text': 'off',        // Too strict for this project
    'react-native/sort-styles': 'off',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  env: {
    browser: false,
    node: true,
    es2021: true,
  },
  ignorePatterns: [
    'node_modules/',
    'server/',
    'plugins/',
    '.expo/',
    'dist/',
    'android/',
    'ios/',
    '*.config.js',
    'babel.config.js',
  ],
};
