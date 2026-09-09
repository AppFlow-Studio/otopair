# Components

## What This Space Is For
All React Native UI components, organized by feature. 200+ components across 14 directories.

## Directory Map
| Directory | Count | Purpose |
|---|---|---|
| ai-chat/ | 17 | AI chat UI (greeting, messages, input, reasoning, sources) |
| booking/ | 76 | Full booking flow (mechanic cards, search, filters, time picker, payment) |
| bookings/ | 2 | Booking display (card, live tracker) |
| cars/ | 9 | Vehicle management (carousel, stats, maintenance, history) |
| home/ | 15 | Home screen (action cards, search, upcoming appointments) |
| icons/ | 5 | Custom SVG icons |
| navigation/ | 2 | TabBar |
| onboarding/ | 22 | Auth + vehicle onboarding steps |
| payments/ | 2 | Payment UI |
| rewards/ | 3 | Loyalty/rewards |
| shared-ui/ | 23 | Foundation: Button, Text, Container, Modal, Input, etc. |
| tell-us-about/ | 15 | Vehicle info collection |
| ui/ | 9 | Theme wrappers (collapsible, parallax, icon symbols) |

## Conventions
- **PascalCase** file names: `MechanicCard.tsx`, `AIMessageBubble.tsx`
- **Import shared-ui:** `import { Button, Text, Container } from '@/components/shared-ui'`
- **Import theme:** `import { colors, typography, spacing } from '@/constants/theme'`
- **Props interfaces:** Define `interface XProps {}` for every component
- **Bottom sheets:** Use `@gorhom/bottom-sheet` for modals
- **No hardcoded styles:** Use theme constants for colors, fonts, spacing

## What Good Looks Like
- Component does ONE thing well
- Props are typed with TypeScript interface
- Uses shared-ui primitives, not raw `<View>` / `<Text>` with inline styles
- Animations use Reanimated, not JS-driven
- Accessible: proper labels, touch targets

## What NOT To Do
- Don't create one-off colors — add to theme.ts if needed
- Don't put business logic in components — use hooks
- Don't import from convex directly — use hooks/useXFromConvex
