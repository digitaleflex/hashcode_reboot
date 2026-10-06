import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "warn",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    // D38 : mesure sur tout le depot.
    //   `no-unused-vars` = 186 occurrences / 87 fichiers -> laisse off (dette).
    //   Redondant de toute facon : `eslint-config-next/typescript` (tseslint
    //   recommended) desactive DEJA la regle de base, la variante `@typescript-eslint/`
    //   la remplace. Ce `off` est donc un doublon sans effet.
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    // D38 : 8 occurrences, toutes des faux positifs (100 %) :
    //   7 x `'React' is not defined` (runtime JSX automatique, React 19 n'a
    //       plus besoin d'etre dans le scope) + 1 x `'RequestInit' is not defined`
    //       (un TYPE TS, que `no-undef` ne peut pas voir : elle n'a pas de
    //       visibilite sur les types).
    // Non reactivable telle quelle en projet TypeScript. Le vrai controle des
    // symboles non definis est assure par `tsc --noEmit` (`npm run typecheck`).
    // Debt : si un jour elle est reactivee, passer par `languageOptions.globals`
    // (React en lecture) et la desactiver sur les fichiers `.ts`/`.tsx`.
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "tests/**/*.cjs", ".kilo/**"]
}];

export default eslintConfig;
