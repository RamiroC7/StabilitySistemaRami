import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // packages/mcp-server corre en Node por stdio: stdout es el canal JSON-RPC.
    // Un console.log rompe el protocolo MCP. Solo se permite console.error (stderr).
    files: ['packages/mcp-server/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': ['error', { allow: ['error'] }],
      // Reglas de React/Fast-Refresh irrelevantes para un paquete de servidor.
      'react-refresh/only-export-components': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
])
