---
name: ui-auditor
description: Validates UI components follow OtoPair design system. Checks theme usage, shared-ui imports, TypeScript types, accessibility, and component patterns.
context: fork
agent: Explore
allowed-tools: Read Grep Glob
---

# Skill: UI Auditor

## When To Use
After creating or modifying any component or screen. Checks design system compliance.

## Process

### Step 1: Theme Compliance
- No hardcoded colors — must use `constants/theme.ts`
- No hardcoded fonts — must use Urbanist from theme
- Spacing uses theme spacing values

### Step 2: shared-ui Usage
- Buttons use `@/components/shared-ui/Button`, not raw `<TouchableOpacity>`
- Text uses `@/components/shared-ui/Text`, not raw `<Text>`
- Check imports: `import { X } from '@/components/shared-ui'`

### Step 3: TypeScript Types
- Props have interfaces defined
- No `any` types
- No `as any` escapes
- Convex data properly typed

### Step 4: Component Patterns
- No business logic in components (should be in hooks)
- No direct Convex imports (should use hooks/useXFromConvex)
- Bottom sheets use `@gorhom/bottom-sheet`
- Animations use Reanimated, not JS-driven

### Step 5: Accessibility
- Interactive elements have proper touch targets (min 44px)
- Images have alt text / accessible labels
- No color-only indicators

## Output
```
## UI Audit: [Component/Screen Name]
- [ ] Theme compliance (colors, fonts, spacing)
- [ ] shared-ui imports
- [ ] TypeScript types complete
- [ ] No business logic in component
- [ ] Accessibility basics
**Issues:** [list or "None"]
```
