import fs from 'fs';

const path = 'C:\\\\Users\\\\PC\\\\Documents\\\\hashcode_reboot\\\\src\\\\app\\\\layout.tsx';
let content = fs.readFileSync(path, 'utf8');

// Check if already has prerender config
if (content.includes('prerender') || content.includes('export const')) {
  console.log('Layout already has prerender config');
} else {
  console.log('No prerender config found in layout');
}

// Check app directory for page.tsx files that might need dynamic opt-out
const appDir = 'C:\\\\Users\\\\PC\\\\Documents\\\\hashcode_reboot\\\\src\\\\app';
const entries = fs.readdirSync(appDir, { withFileTypes: true });

console.log('\\nPages dans /app :');
for (const entry of entries) {
  if (entry.isDirectory()) {
    const pagePath = path.join(appDir, entry.name, 'page.tsx');
    if (fs.existsSync(pagePath)) {
      console.log('  - /' + entry.name);
    }
  }
}

// Check for legal pages
const legalDirs = ['legal', 'privacy', 'terms'];
for (const dir of legalDirs) {
  const dirPath = path.join(appDir, dir);
  if (fs.existsSync(dirPath)) {
    console.log('  - /' + dir);
  }
}

console.log('\\nPartial Prerendering would involve:');
console.log('1. dynamic = "force-dynamic" on routes that need auth/session');
console.log('2. export const dynamic = "force-dynamic" in route handlers');
console.log('3._opt-out via export const revalidate = 0');
console.log('4. Next config: output: "standalone" with experimental appRoot');