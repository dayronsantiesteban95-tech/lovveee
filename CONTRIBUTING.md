# Contributing to Anika Dispatcher App

## Encoding Rules (CRITICAL)

The app previously suffered UTF-8 encoding corruption across 18 files due to Windows agents saving files with BOM or Latin-1 encoding. Follow these rules strictly to prevent recurrence.

### File Encoding
- **Always save files as UTF-8 WITHOUT BOM**
- In VS Code: bottom-right corner → click encoding → "Save with Encoding" → `UTF-8`
- In any editor: ensure no BOM (Byte Order Mark) is added

### Emoji in Source Code
- **Never paste emoji directly into source code**
- Use Unicode escapes instead: `\u{1F4CB}` (JS template literals / JSX expressions)
- Or use HTML entities: `&#128203;`
- Or use a React icon library (lucide-react is already installed)

**BAD:**
```tsx
<span>📋 Task</span>
```

**GOOD:**
```tsx
<span>{'\u{1F4CB}'} Task</span>
// or just use lucide-react:
import { ClipboardList } from 'lucide-react';
<ClipboardList /> Task
```

### Pre-Commit Check
Run before every commit:
```bash
npm run check:encoding
```

This script detects:
- BOM markers (0xEF 0xBB 0xBF at file start)
- Corrupted emoji byte sequences (Latin-1 double-encoding artifacts)

### Line Endings
- The `.gitattributes` file enforces LF line endings for all text files
- Do not commit files with CRLF endings
- If on Windows, ensure your editor/git is not converting to CRLF

### Git Config (Windows)
```bash
git config core.autocrlf false
git config core.eol lf
```

## Development Setup
```bash
npm install
npm run dev
```

## Before Committing
```bash
npm run check:encoding   # encoding check
npm run lint             # ESLint
npx tsc --noEmit         # TypeScript type check
```
