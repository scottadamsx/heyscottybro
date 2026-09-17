import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

/* Three execution environments live in this repo and they do not share globals:
 *   - the browser bundle (src/**, the static games in public/)
 *   - Node: Vercel serverless handlers in api/**, the Vite config, and the
 *     plain `node x.test.js` suites in package.json's test script
 *   - the service worker (public/sw.js), which has its own global scope
 * One flat block with globals.browser used to cover all three, which is why
 * `process` and `Buffer` read as undefined in server files (65 of the 176
 * reported errors). Flat config MERGES matching blocks rather than replacing
 * them, so the browser block has to ignore the others explicitly instead of
 * relying on a later block to override it. */

const sharedRules = {
  'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
}

const reactRules = {
  ...sharedRules,
  'react-refresh/only-export-components': 'off',
  'react-hooks/set-state-in-effect': 'off',
  'react-hooks/immutability': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  'react-hooks/exhaustive-deps': 'off',
}

const NODE_FILES = ['api/**/*.js', 'vite.config.js', '**/*.test.js']
const SW_FILES = ['public/sw.js']

export default defineConfig([
  globalIgnores(['dist', 'orbit']), // orbit/ is a copy of the Orbit repo (scripts/sync-orbit.mjs)

  // Browser: the React app and the static arcade games.
  {
    files: ['**/*.{js,jsx}'],
    ignores: [...NODE_FILES, ...SW_FILES],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: reactRules,
  },

  // Node: serverless handlers, build config, and the node-run test suites.
  // No React plugins here — these files never render.
  {
    files: NODE_FILES,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: sharedRules,
  },

  // Service worker: self/caches/clients, no window or document.
  {
    files: SW_FILES,
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.serviceworker,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: sharedRules,
  },
])
