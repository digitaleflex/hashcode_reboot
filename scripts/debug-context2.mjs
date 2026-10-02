import fs from 'fs';

const path = 'C:\\Users\\PC\\Documents\\hashcode_reboot\\src\\components\\reboot\\admin\\MemberTable.tsx';
let content = fs.readFileSync(path, 'utf8');

const idx = content.indexOf('<div className="rounded-md border border-border/60 overflow-x-auto bg-card/30">');
console.log('BEFORE (exact 200 chars with visible spaces):');
const before = content.substring(idx - 200, idx);
console.log(JSON.stringify(before));
console.log('---');
console.log(before);