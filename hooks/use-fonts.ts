import { useFonts } from 'expo-font';
import {
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';

/**
 * Load Urbanist + Source Serif 4 font families for the app.
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
        'SourceSerif4-Regular': SourceSerif4_400Regular,
        'SourceSerif4-SemiBold': SourceSerif4_600SemiBold,
        'SourceSerif4-Bold': SourceSerif4_700Bold,
    });
}
