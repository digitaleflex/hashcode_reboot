import fs from 'fs';

const path = 'C:\\Users\\PC\\Documents\\hashcode_reboot\\src\\components\\reboot\\admin\\MemberTable.tsx';
let content = fs.readFileSync(path, 'utf8');

const idx = content.indexOf('<div className="rounded-md border border-border/60 overflow-x-auto bg-card/30">');
console.log('Found at index:', idx);
console.log('Context before (300 chars):');
console.log(content.substring(idx - 300, idx + 100));