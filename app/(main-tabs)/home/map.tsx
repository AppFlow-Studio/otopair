/**
 * Home Map Route
 *
 * PURPOSE: Route wrapper that wires the `home/map` screen to the shared `MapScreen`
 *          component from the Home flow components folder.
 *
 * USED IN: app/(main-tabs)/home/_layout.tsx
 *
 * PROPS:
 *   - None (route-level file only re-exports the component)
 *
 * EXAMPLE:
 *   // Navigated via:
 *   // router.push('/home/map')
 *
 * OWNER: Ahmad Hamoudeh
 */

import MapScreen from '@/components/home/MapScreen';

export default MapScreen;


