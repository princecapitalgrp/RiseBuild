// ESLint v8 flat config
// Architecture enforcement: Firestore import isolation (see domain/storage-classification.md)
module.exports = {
  root: true,
  extends: ['expo', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['node_modules/', '.expo/', 'dist/'],
  rules: {
    // Firestore import isolation — enforced from Phase 1 day one.
    // @react-native-firebase imports are ONLY permitted in FirestoreRepository.ts.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@react-native-firebase/*'],
            message:
              'Firebase imports are only permitted in src/repositories/FirestoreRepository.ts. See domain/storage-classification.md Enforcement Protocol rule 2.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // FirestoreRepository is the sole permitted Firebase importer
      files: ['src/repositories/FirestoreRepository.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
};
