import fs from 'fs';

const path = 'C:\\Users\\PC\\Documents\\hashcode_reboot\\src\\components\\reboot\\admin\\MemberTable.tsx';
let content = fs.readFileSync(path, 'utf8');

// Use \r\n for Windows line endings
const oldText = `            )}\r\n          </div>\r\n        )}\r\n        <div className="rounded-md border border-border/60 overflow-x-auto bg-card/30">\r\n          <Table>`;

const newText = `            )}\r\n          </div>\r\n        )}\r\n        {/* Mobile: Card grid — shows ALL fields including Objectif, Mentorat, Budget */}\r\n        <div className="md:hidden space-y-3">\r\n          {loading && displayed.length === 0 && (\r\n            <div aria-hidden className="space-y-3">\r\n              {Array.from({ length: 6 }).map((_, i) => (\r\n                <div key={i} className="admin-skeleton admin-skeleton-row" />\r\n              ))}\r\n              <span className="sr-only">Chargement des membres\u2026</span>\r\n            </div>\r\n          )}\r\n          {displayed.length === 0 && !loading && (\r\n            <div className="rounded-lg border border-border/60 bg-card/40 p-8 text-center">\r\n              <UserX className="mx-auto mb-3 size-10 text-muted-foreground/30" />\r\n              <p className="text-sm text-muted-foreground">Aucun membre pour ces filtres.</p>\r\n            </div>\r\n          )}\r\n          {displayed.map((m) => (\r\n            <MemberCard\r\n              key={m.id}\r\n              m={m}\r\n              selected={selectedIds.has(m.id)}\r\n              onToggleSelect={onToggleSelect}\r\n              onSelectMember={onSelectMember}\r\n            />\r\n          ))}\r\n        </div>\r\n\r\n        {/* Desktop: Table — columns progressively revealed */}\r\n        <div className="hidden md:block">\r\n          <div className="rounded-md border border-border/60 overflow-x-auto bg-card/30 scroll-slim">\r\n            <Table>`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(path, content);
  console.log('SUCCESS: Replacement done');
} else {
  console.log('FAIL: Could not find oldText');
  console.log('Looking for:', JSON.stringify(oldText.substring(0, 50)) + '...');
}