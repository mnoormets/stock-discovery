import { defineConfig } from 'vitest/config';
import path from 'path';

// Testide konfiguratsioon. Tootmiskoodi see ei puutu: kogu andmebaasi isolatsioon
// elab tests/setup kihis (test-DB loomine globalSetup'is + runtime-kontroll enne
// iga testifaili).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup/global-setup.ts'],
    setupFiles: ['tests/setup/guard.ts'],
    // Üks jagatud test-andmebaas. Paralleelsed TRUNCATE'id teeksid testid
    // flaky'ks, seega failid jooksevad järjest. Puhtad testid on nii kiired,
    // et jada ei maksa midagi.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
