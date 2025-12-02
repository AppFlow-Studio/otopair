import { useFonts } from 'expo-font';

/**
 * Load Urbanist font family for the app.
 * 
 * @example
 * ```tsx
 * const [fontsLoaded, fontError] = useAppFonts();
 * 
 * if (!fontsLoaded && !fontError) {
 *   return null; // Or a loading component
 * }
 * ```
 */
export function useAppFonts() {
    return useFonts({
        'Urbanist-Light': require('../assets/fonts/Urbanist-Light.ttf'),
        'Urbanist-Regular': require('../assets/fonts/Urbanist-Regular.ttf'),
        'Urbanist-Medium': require('../assets/fonts/Urbanist-Medium.ttf'),
        'Urbanist-SemiBold': require('../assets/fonts/Urbanist-SemiBold.ttf'),
        'Urbanist-Bold': require('../assets/fonts/Urbanist-Bold.ttf'),
        'Urbanist-ExtraBold': require('../assets/fonts/Urbanist-ExtraBold.ttf'),
        'Urbanist-Italic': require('../assets/fonts/Urbanist-Italic.ttf'),
    });
}
