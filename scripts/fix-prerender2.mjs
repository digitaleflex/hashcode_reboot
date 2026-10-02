import fs from 'fs';
import path from 'path';

const appDir = 'C:\\\\Users\\\\PC\\\\Documents\\\\hashcode_reboot\\\\src\\\\app';

// 1. /login/page.tsx - needs dynamic (auth session)
const loginPath = path.join(appDir, 'login', 'page.tsx');
let loginContent = fs.readFileSync(loginPath, 'utf8');
if (!loginContent.includes('export const dynamic')) {
  loginContent = loginContent.replace(
    "export default function Login",
    "export const dynamic = \"force-dynamic\";\n\nexport default function Login"
  );
  fs.writeFileSync(loginPath, loginContent);
  console.log('✅ /login/page.tsx - added dynamic = force-dynamic');
} else {
  console.log('  /login/page.tsx - already has dynamic config');
}

// 2. Legal pages - can be static (no auth needed)
// Check for privacy page
const privacyPath = path.join(appDir, 'privacy', 'page.tsx');
if (fs.existsSync(privacyPath)) {
  let privacyContent = fs.readFileSync(privacyPath, 'utf8');
  if (!privacyContent.includes('export const revalidate')) {
    privacyContent = privacyContent.replace(
      "export default function Privacy",
      "export const revalidate = 0;\n\nexport default function Privacy"
    );
    fs.writeFileSync(privacyPath, privacyContent);
    console.log('✅ /privacy/page.tsx - added revalidate = 0');
  } else {
    console.log('  /privacy/page.tsx - already has revalidate config');
  }
}

// Check for terms page
const termsPath = path.join(appDir, 'terms', 'page.tsx');
if (fs.existsSync(termsPath)) {
  let termsContent = fs.readFileSync(termsPath, 'utf8');
  if (!termsContent.includes('export const revalidate')) {
    termsContent = termsContent.replace(
      "export default function Terms",
      "export const revalidate = 0;\n\nexport default function Terms"
    );
    fs.writeFileSync(termsPath, termsContent);
    console.log('✅ /terms/page.tsx - added revalidate = 0');
  } else {
    console.log('  /terms/page.tsx - already has revalidate config');
  }
}

// 3. / - racine: dynamique s'il y a des appels serveur, statique sinon
const rootPath = path.join(appDir, 'page.tsx');
let rootContent = fs.readFileSync(rootPath, 'utf8');
if (!rootContent.includes('export const') && rootContent.includes('useSearchParams')) {
  rootContent = rootContent.replace(
    "export default function Landing",
    "export const dynamic = \"force-dynamic\";\n\nexport default function Landing"
  );
  fs.writeFileSync(rootPath, rootContent);
  console.log('✅ /page.tsx - added dynamic = force-dynamic (has useSearchParams)');
} else if (!rootContent.includes('export const')) {
  console.log('  /page.tsx - no config change needed');
}

console.log('\\nPartial prerendering config evaluation complete.');