import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Re-export of React Native's `useColorScheme`, narrowed to the literal scheme
 * union so callers can safely index `Colors[scheme]`.
 *
 * The react-native type definitions widen `useColorScheme()`'s return so that
 * `useColorScheme() ?? 'light'` no longer narrows to `'light' | 'dark'` — it
 * resolves to a broad type that can't index the `Colors` object, producing
 * TS7053 ("can't be used to index") at every call site (shared-ui Container /
 * Input / Text, use-theme-color, etc.). Narrowing the return type here fixes
 * all of them at the source without touching each consumer.
 */
export function useColorScheme(): 'light' | 'dark' | null | undefined {
  return useRNColorScheme() as 'light' | 'dark' | null | undefined;
}
