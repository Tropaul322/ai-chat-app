import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import prettier from 'eslint-config-prettier/flat'
 
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/db/**"],
              message:
                "Do not import DB layer from UI code. Fetch through API routes instead.",
            },
            {
              group: ["@/lib/supabase/admin", "@/lib/supabase/admin/**"],
              message:
                "Do not import admin Supabase client from UI code. Use API routes.",
            },
            {
              group: ["@/lib/supabase/server", "@/lib/supabase/server/**"],
              message:
                "Do not import Supabase server client from UI code. Use API routes.",
            },
          ],
        },
      ],
    },
  },
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])
 
export default eslintConfig