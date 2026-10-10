#!/usr/bin/env tsx
/**
 * Fix Target Size — WCAG 2.5.8 (AA) compliance
 * 
 * Remplace `size-4` (16px) par `size-6` (24px) sur tous les éléments interactifs
 * qui utilisent des icônes Lucide comme cibles de clic/tap.
 * 
 * Usage: npx tsx scripts/fix-target-size.ts [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "glob";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const DRY_RUN = process.argv.includes("--dry-run");

// Fichiers à traiter (composants reboot + app)
const PATTERNS = [
  "src/components/reboot/**/*.tsx",
  "src/app/**/*.tsx",
  "src/components/ui/**/*.tsx",
];

// Icônes qui sont DES CIBLES interactives (boutons, liens, triggers)
// vs icônes décoratives (aria-hidden, status indicators)
const INTERACTIVE_ICONS = new Set([
  // Navigation / Actions
  "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown",
  "ChevronRight", "ChevronLeft", "ChevronUp", "ChevronDown",
  "ArrowUpRight", "ArrowDownLeft", // external links
  
  // Actions principales
  "Send", "Save", "Download", "Upload", "Copy", "Edit", "Edit2", "Edit3",
  "Plus", "PlusCircle", "Minus", "Trash", "Trash2", "Delete",
  "Check", "CheckCircle", "CheckCircle2", "X", "XCircle",
  "RefreshCw", "RotateCcw", "Reload",
  "Search", "Filter", "Funnel", "Settings", "Cog",
  "MoreHorizontal", "MoreVertical", "Menu", "X",
  
  // Auth / User
  "LogIn", "LogOut", "User", "UserPlus", "UserCheck", "UserX", "UserCog",
  
  // Modals / Dialogs
  "AlertCircle", "AlertTriangle", "Info", "HelpCircle", "QuestionMark",
  
  // Media / Files
  "File", "FileText", "FilePlus", "Image", "Video", "Music", "Folder", "FolderPlus",
  
  // Time / Calendar
  "Calendar", "CalendarDays", "Clock", "Timer", "Hourglass",
  
  // Location / Map
  "MapPin", "MapPinPlus", "Navigation", "Compass",
  
  // Social / Share
  "Share", "Share2", "Link", "Link2", "ExternalLink",
  
  // Tags / Labels
  "Tag", "Tags", "Bookmark", "BookmarkPlus",
  
  // Loading / Process
  "Loader", "Loader2", "LoaderCircle", "Spinner", "Activity",
  
  // Email / Communication
  "Mail", "Send", "MessageSquare", "MessageCircle",
  
  // Security
  "Lock", "Unlock", "Key", "Shield", "ShieldCheck", "ShieldAlert",
  
  // Education
  "GraduationCap", "Book", "BookOpen", "BookMarked", "Award", "Trophy",
  
  // Commerce
  "ShoppingCart", "ShoppingBag", "CreditCard", "DollarSign", "Euro",
  
  // Code / Dev
  "Terminal", "Code", "Code2", "GitBranch", "GitCommit", "GitMerge",
  
  // Other common interactive
  "Refresh", "Sync", "RotateCw", "RotateCcw",
  "Expand", "Minimize", "Maximize", "Maximize2",
  "Eye", "EyeOff", "EyeClosed",
  "Download", "Upload", "Cloud", "CloudDownload", "CloudUpload",
]);

// Icônes qui sont SOUVENT décoratives (avec aria-hidden) - on ne touche pas
const DECORATIVE_ICONS = new Set([
  "CheckCircle2", // souvent status indicator
  "AlertCircle",  // souvent status indicator
  "AlertTriangle", // souvent status indicator
  "XCircle",      // souvent status indicator
  "Users",        // souvent label décoratif
  "Clock",        // souvent label décoratif
  "Mail",         // souvent label décoratif
  "Activity",     // souvent label décoratif
  "UserCheck",    // souvent label décoratif
  "FlaskConical", // souvent label décoratif
]);

function isLikelyInteractive(context: string, iconName: string): boolean {
  // Chercher des patterns indiquant une cible interactive
  const interactivePatterns = [
    /onClick/,
    /onMouseDown/,
    /onKeyDown/,
    /role=["']button["']/,
    /role=["']link["']/,
    /role=["']menuitem["']/,
    /role=["']tab["']/,
    /tabIndex/,
    /href=/,
    /<Link/,
    /<button/,
    /<a\s/,
    /<Button/,
    /<IconButton/,
    /<TabTrigger/,
    /<MenuItem/,
    /<Command/,
    /<SelectTrigger/,
    /<DropdownMenuTrigger/,
    /<ContextMenuTrigger/,
    /<SheetTrigger/,
    /<HoverCardTrigger/,
    /<PopoverTrigger/,
    /<TooltipTrigger/,
    /<MenubarTrigger/,
    /<Pagination/,
    /<AccordionTrigger/,
    /<CollapsibleTrigger/,
  ];
  
  // Si l'icône a aria-hidden, c'est décorative
  if (context.includes("aria-hidden")) return false;
  
  // Si l'icône est dans un pattern interactif
  for (const pattern of interactivePatterns) {
    if (pattern.test(context)) return true;
  }
  
  // Par défaut : si l'icône est dans la liste interactive ET pas dans décorative
  if (INTERACTIVE_ICONS.has(iconName) && !DECORATIVE_ICONS.has(iconName)) {
    return true;
  }
  
  return false;
}

function fixFile(filePath: string): { changed: boolean; changes: number } {
  const content = readFileSync(filePath, "utf-8");
  let newContent = content;
  let changes = 0;
  
  // Pattern pour trouver <IconName className="...size-4..." />
  // ou <IconName className={cn("...", "size-4", ...)} />
  const iconRegex = /<([A-Z][a-zA-Z]+)\s+([^>]*className=(?:"[^"]*size-4[^"]*"|`[^`]*size-4[^`]*`|\{[^}]*size-4[^}]*\})[^>]*?)(\s*\/?>)/g;
  
  newContent = newContent.replace(iconRegex, (match, iconName, attrs, closing) => {
    if (!INTERACTIVE_ICONS.has(iconName) || DECORATIVE_ICONS.has(iconName)) {
      return match; // Pas dans notre liste ou décoratif
    }
    
    // Vérifier le contexte (100 chars avant/après)
    const matchIndex = content.indexOf(match);
    const contextStart = Math.max(0, matchIndex - 200);
    const contextEnd = Math.min(content.length, matchIndex + match.length + 200);
    const context = content.slice(contextStart, contextEnd);
    
    if (!isLikelyInteractive(context, iconName)) {
      return match;
    }
    
    // Remplacer size-4 par size-6
    let newAttrs = attrs
      .replace(/size-4/g, "size-6")
      .replace(/className=(?:"([^"]*)size-4([^"]*)")/g, (m, before, after) => 
        `className="${before}size-6${after}"`
      )
      .replace(/className=(\{[^}]*)size-4([^}]*\})/g, (m, before, after) => 
        `className=${before}size-6${after}`
      )
      .replace(/`([^`]*)size-4([^`]*)`/g, (m, before, after) => 
        `\`${before}size-6${after}\``
      );
    
    if (newAttrs !== attrs) {
      changes++;
      return `<${iconName} ${newAttrs}${closing}`;
    }
    return match;
  });
  
  // Aussi traiter les className simples sans composant Icon
  // className="size-4" sur éléments interactifs
  const simpleSize4Regex = /(className=(?:"[^"]*)|`[^`]*`|\{[^}]*\})/g;
  
  return { changed: newContent !== content, changes };
}

function main() {
  let totalFiles = 0;
  let totalChanges = 0;
  const modifiedFiles: string[] = [];
  
  for (const pattern of PATTERNS) {
    const files = globSync(pattern, { cwd: ROOT, absolute: true });
    
    for (const file of files) {
      const { changed, changes } = fixFile(file);
      if (changed) {
        totalFiles++;
        totalChanges += changes;
        modifiedFiles.push(file.replace(ROOT + "/", ""));
        
        if (!DRY_RUN) {
          const content = readFileSync(file, "utf-8");
          let newContent = content;
          
          // Apply the same replacement logic
          newContent = newContent.replace(/<([A-Z][a-zA-Z]+)\s+([^>]*className=(?:"[^"]*size-4[^"]*"|`[^`]*size-4[^`]*`|\{[^}]*size-4[^}]*\})[^>]*?)(\s*\/?>)/g, (match, iconName, attrs, closing) => {
            if (!INTERACTIVE_ICONS.has(iconName) || DECORATIVE_ICONS.has(iconName)) {
              return match;
            }
            const matchIndex = content.indexOf(match);
            const contextStart = Math.max(0, matchIndex - 200);
            const contextEnd = Math.min(content.length, matchIndex + match.length + 200);
            const context = content.slice(contextStart, contextEnd);
            if (!isLikelyInteractive(context, iconName)) return match;
            
            let newAttrs = attrs
              .replace(/size-4/g, "size-6")
              .replace(/className=(?:"([^"]*)size-4([^"]*)")/g, (m, before, after) => `className="${before}size-6${after}"`)
              .replace(/className=(\{[^}]*)size-4([^}]*\})/g, (m, before, after) => `className=${before}size-6${after}`)
              .replace(/`([^`]*)size-4([^`]*)`/g, (m, before, after) => `\`${before}size-6${after}\``);
            
            return newAttrs !== attrs ? `<${iconName} ${newAttrs}${closing}` : match;
          });
          
          writeFileSync(file, newContent);
        }
      }
    }
  }
  
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Résultat:`);
  console.log(`  Fichiers modifiés: ${totalFiles}`);
  console.log(`  Remplacements size-4 → size-6: ${totalChanges}`);
  if (modifiedFiles.length > 0) {
    console.log(`\nFichiers:`);
    for (const f of modifiedFiles) console.log(`  - ${f}`);
  }
}

main();