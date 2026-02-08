import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: new URL(".", import.meta.url).pathname,
});

export default [
  ...compat.extends("next/core-web-vitals"),
  // Override default ignores of eslint-config-next.
  {
    // Default ignores of eslint-config-next:
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];
