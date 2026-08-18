import { useFonts } from 'expo-font';
import {
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import {
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
    GeistMono_400Regular,
    GeistMono_500Medium,
} from '@expo-google-fonts/geist-mono';

/**
 * Load Urbanist + Source Serif 4 + IBM Plex Mono font families for the app.
 *
 * IBM Plex Mono backs the "service record" typographic language on
 * Settings → Past Services — a fixed column is what lets the dot leaders
 * and the amount column line up without a tabular-numeral feature.
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
        'IBMPlexMono-Regular': IBMPlexMono_400Regular,
        'IBMPlexMono-Medium': IBMPlexMono_500Medium,
        'IBMPlexMono-SemiBold': IBMPlexMono_600SemiBold,
        'IBMPlexMono-Bold': IBMPlexMono_700Bold,
        'Inter-Regular': Inter_400Regular,
        'Inter-Medium': Inter_500Medium,
        'Inter-SemiBold': Inter_600SemiBold,
        'Inter-Bold': Inter_700Bold,
        'GeistMono-Regular': GeistMono_400Regular,
        'GeistMono-Medium': GeistMono_500Medium,
    });
}
