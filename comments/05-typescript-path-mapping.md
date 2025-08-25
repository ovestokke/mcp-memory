# TypeScript Path Mapping Issues

## Issue: Inconsistent Import Paths

### Current State: Mixed Path Styles

The codebase shows **inconsistent import patterns** across different modules:

#### Working Aliases (Some Files)
```typescript
// src/mcp-server/index.ts
import { MemoryStorage } from '@shared/memory/storage'
import { MemoryStorageClient } from '@shared/memory/client'
import { OAuth2Handler } from '@shared/auth/oauth'
```

#### Relative Imports (Other Files)  
```typescript
// src/shared/mcp/server.ts
import { MemoryStorage } from '../memory/storage'
import { logger } from '../utils/logger'

// src/shared/mcp/http-server.ts  
import { logger } from '../utils/logger'
import { MemoryStorageClient } from '../memory/client'
```

#### Incomplete Path Mapping

Current `tsconfig.json` has basic paths but missing many common patterns:
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./src/shared/*"]
      // Missing: @web-ui/*, @components/*, @utils/*, etc.
    }
  }
}
```

### Problems

1. **Inconsistent Developer Experience**
   - Some developers use `@shared/memory/storage`
   - Others use `../memory/storage`  
   - No clear guidance on which to use

2. **Refactoring Brittleness**
   ```typescript
   // Moving files breaks relative imports
   import { logger } from '../utils/logger'  // Breaks if file moves!
   
   // Absolute paths survive moves
   import { logger } from '@shared/utils/logger'  // Always works
   ```

3. **Poor IDE Support**
   - Autocomplete inconsistent
   - Jump-to-definition varies by import style
   - Refactoring tools work differently

4. **Code Review Confusion**
   ```typescript
   // Which is correct?
   import { Memory } from '../memory/types'        // Relative
   import { Memory } from '@shared/memory/types'   // Absolute  
   ```

### Solution: Comprehensive Path Mapping

#### 1. Complete `tsconfig.json` Configuration
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // Shared modules
      "@shared/*": ["./src/shared/*"],
      "@shared/memory/*": ["./src/shared/memory/*"],
      "@shared/auth/*": ["./src/shared/auth/*"],
      "@shared/mcp/*": ["./src/shared/mcp/*"],
      "@shared/utils/*": ["./src/shared/utils/*"],
      "@shared/validation/*": ["./src/shared/validation/*"],
      
      // Web UI modules  
      "@web-ui/*": ["./src/web-ui/*"],
      "@components/*": ["./src/web-ui/components/*"],
      "@lib/*": ["./src/web-ui/lib/*"],
      "@utils/*": ["./src/web-ui/utils/*"],
      "@contexts/*": ["./src/web-ui/contexts/*"],
      "@types/*": ["./src/web-ui/types/*"],
      
      // MCP Server
      "@mcp-server/*": ["./src/mcp-server/*"],
      
      // Root level shortcuts
      "@/*": ["./src/*"],
      "~/*": ["./*"]
    }
  }
}
```

#### 2. Next.js Configuration Update
```javascript
// next.config.js  
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... other config
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/web-ui/components'),
      '@lib': path.resolve(__dirname, 'src/web-ui/lib'),
      '@utils': path.resolve(__dirname, 'src/web-ui/utils'),
      '@contexts': path.resolve(__dirname, 'src/web-ui/contexts'),
    }
    return config
  }
}
```

#### 3. Jest Configuration
```javascript
// jest.config.js
module.exports = {
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@components/(.*)$': '<rootDir>/src/web-ui/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/web-ui/lib/$1',
    '^@utils/(.*)$': '<rootDir>/src/web-ui/utils/$1',
    '^@contexts/(.*)$': '<rootDir>/src/web-ui/contexts/$1',
  }
}
```

#### 4. ESLint Import Rules
```json
// .eslintrc.json
{
  "rules": {
    "import/no-relative-parent-imports": "error",
    "import/order": ["error", {
      "groups": [
        "builtin",
        "external", 
        "internal",
        "parent",
        "sibling"
      ],
      "pathGroups": [
        {
          "pattern": "@shared/**",
          "group": "internal",
          "position": "before"
        },
        {
          "pattern": "@components/**", 
          "group": "internal",
          "position": "before"
        }
      ]
    }]
  }
}
```

### Standardized Import Patterns

#### Before (Inconsistent)
```typescript
// Mixed styles across files
import { MemoryStorage } from '../memory/storage'
import { OAuth2Handler } from '@shared/auth/oauth'  
import { logger } from '../utils/logger'
import { Memory } from '../../shared/memory/types'
```

#### After (Consistent)
```typescript
// Consistent absolute paths everywhere
import { MemoryStorage } from '@shared/memory/storage'
import { OAuth2Handler } from '@shared/auth/oauth'
import { logger } from '@shared/utils/logger'  
import { Memory } from '@shared/memory/types'
```

### Migration Script

Create an automated migration to update all imports:

```typescript
// scripts/migrate-imports.ts
import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const replacements = [
  // Shared imports
  { from: /from ['"]\.\.\/memory\/([^'"]+)['"]/g, to: "from '@shared/memory/$1'" },
  { from: /from ['"]\.\.\/auth\/([^'"]+)['"]/g, to: "from '@shared/auth/$1'" },
  { from: /from ['"]\.\.\/utils\/([^'"]+)['"]/g, to: "from '@shared/utils/$1'" },
  
  // Web UI imports  
  { from: /from ['"]\.\.\/components\/([^'"]+)['"]/g, to: "from '@components/$1'" },
  { from: /from ['"]\.\.\/lib\/([^'"]+)['"]/g, to: "from '@lib/$1'" },
]

const files = glob.sync('src/**/*.{ts,tsx}')
files.forEach(file => {
  let content = readFileSync(file, 'utf8')
  
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to)
  })
  
  writeFileSync(file, content)
})
```

### Benefits

1. **Consistency**: All imports use same pattern
2. **Refactoring Safety**: Moving files doesn't break imports  
3. **Better IDE Support**: Consistent autocomplete and navigation
4. **Cleaner Code**: No `../../../` chains
5. **Team Alignment**: Clear conventions for everyone

### Files Affected

- ✏️ **UPDATE**: `tsconfig.json` (add complete path mapping)
- ✏️ **UPDATE**: `src/web-ui/next.config.js` (webpack aliases)
- ✏️ **UPDATE**: `jest.config.js` (module name mapping)
- ✏️ **UPDATE**: All `.ts/.tsx` files (consistent imports)
- ➕ **ADD**: ESLint rules for import consistency

### Estimated Impact

- **Import Consistency**: 100% standardized
- **Refactoring Safety**: +90% (paths survive moves)
- **Developer Experience**: Significantly improved
- **Code Review**: Easier to focus on logic vs. import styles