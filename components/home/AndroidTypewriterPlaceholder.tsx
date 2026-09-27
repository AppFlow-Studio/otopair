/**
 * AndroidTypewriterPlaceholder
 *
 * PURPOSE: Android-only, UI-thread copy of the Home search bar's rotating
 * placeholder. Renders the same glyphs as the <Text> it replaces, but the
 * string is held in a Reanimated shared value and stepped by a UI-thread
 * frame callback, so typing a phrase costs the JS thread nothing.
 *
 * WHY: hooks/useTypewriterText.ts is a setTimeout state machine that calls
 * setState once per character (typeMs 60 / deleteMs 30). On Home that is
 * 16-33 React renders a second, every second the tab is open, and Home
 * mounts TWO MechanicSearchBars at once when an upcoming-booking hero is
 * showing (app/(main-tabs)/home/index.tsx lines 1428 and 1704), so the
 * cost is doubled there. Those renders land on the same JS thread as the
 * user's taps.
 *
 * iOS is untouched: this component is never rendered there, so none of its
 * hooks run. MechanicSearchBar keeps the original <Text> + useTypewriterText
 * path for every non-Android case.
 *
 * TIMING: the phase machine below is a transcription of the one in
 * hooks/useTypewriterText.ts, same four phases and the same four durations,
 * including that hook's quirk of waiting one extra deleteMs between the end
 * of the hold and the first character being removed. The one unavoidable
 * difference is quantisation: setTimeout fires at an arbitrary millisecond,
 * a frame callback fires on the vsync boundary, so each step lands within
 * one frame (~16 ms) of where the JS version put it. Durations are measured
 * from the frame that ran the step, exactly as the hook measures them from
 * the callback that ran it, so nothing accumulates drift.
 *
 * USED IN: components/home/MechanicSearchBar.tsx (Android branch only)
 */

import React, { useEffect } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
    useAnimatedProps,
    useFrameCallback,
    useSharedValue,
} from 'react-native-reanimated';

// The ReText pattern: a TextInput is the only RN text view whose content is
// a *prop*, so it is the only one a worklet can drive. Reanimated ships the
// same shape in src/component/PerformanceMonitor.tsx (text + defaultValue on
// an animated, non-editable TextInput).
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Defaults of TypewriterOptions in hooks/useTypewriterText.ts. Kept as
// literals rather than imported so the two machines can be diffed by eye.
const TYPE_MS = 60;
const DELETE_MS = 30;
const HOLD_MS = 1500;
const PAUSE_MS = 250;

const PHASE_TYPING = 0;
const PHASE_HOLDING = 1;
const PHASE_DELETING = 2;
const PHASE_PAUSING = 3;

interface AndroidTypewriterPlaceholderProps {
    /** Phrases to cycle through, in order. */
    phrases: readonly string[];
    /** False stands the animation down (screen not focused). Matches the
     *  `paused` option on the JS hook, including its behaviour of blanking
     *  the line and restarting from the first phrase on resume. */
    active: boolean;
    /** Must be the computed style of the <Text> this stands in for. */
    style?: StyleProp<TextStyle>;
}

export function AndroidTypewriterPlaceholder({
    phrases,
    active,
    style,
}: AndroidTypewriterPlaceholderProps) {
    const text = useSharedValue('');
    const phraseIndex = useSharedValue(0);
    const charCount = useSharedValue(0);
    const phase = useSharedValue(PHASE_TYPING);
    // Absolute frame timestamp the next step is due at. 0 means "not started
    // yet" — the first active frame seeds it. Using an absolute timestamp
    // rather than timeSinceFirstFrame keeps the phase correct across the
    // re-registration useFrameCallback does whenever this component
    // re-renders (its effect deps include the callback identity).
    const nextDueMs = useSharedValue(0);

    const frame = useFrameCallback((info) => {
        'worklet';
        const total = phrases.length;
        if (total === 0) {
            return;
        }

        if (nextDueMs.value === 0) {
            // The hook's opening `setTimeout(tick, typeMs)`: the line stays
            // empty for one type interval before the first character.
            nextDueMs.value = info.timestamp + TYPE_MS;
            return;
        }
        if (info.timestamp < nextDueMs.value) {
            return;
        }

        const phrase = phrases[phraseIndex.value % total];

        if (phase.value === PHASE_TYPING) {
            if (charCount.value < phrase.length) {
                charCount.value += 1;
                text.value = phrase.slice(0, charCount.value);
                nextDueMs.value = info.timestamp + TYPE_MS;
            } else {
                phase.value = PHASE_HOLDING;
                nextDueMs.value = info.timestamp + HOLD_MS;
            }
            return;
        }

        if (phase.value === PHASE_HOLDING) {
            // Transitions only — the hook waits a further deleteMs before it
            // removes the first character, so the full phrase is on screen
            // for typeMs + holdMs + deleteMs.
            phase.value = PHASE_DELETING;
            nextDueMs.value = info.timestamp + DELETE_MS;
            return;
        }

        if (phase.value === PHASE_DELETING) {
            if (charCount.value > 0) {
                charCount.value -= 1;
                text.value = phrase.slice(0, charCount.value);
                nextDueMs.value = info.timestamp + DELETE_MS;
            } else {
                phase.value = PHASE_PAUSING;
                nextDueMs.value = info.timestamp + PAUSE_MS;
            }
            return;
        }

        // PHASE_PAUSING
        phraseIndex.value = (phraseIndex.value + 1) % total;
        phase.value = PHASE_TYPING;
        charCount.value = 0;
        nextDueMs.value = info.timestamp + TYPE_MS;
    }, false);

    useEffect(() => {
        if (active && phrases.length > 0) {
            // The JS hook's effect re-runs on unpause and resets to the first
            // phrase from empty; match that so the two platforms resume the
            // same way.
            phraseIndex.value = 0;
            charCount.value = 0;
            phase.value = PHASE_TYPING;
            text.value = '';
            nextDueMs.value = 0;
            frame.setActive(true);
        } else {
            frame.setActive(false);
            // The hook blanks the line while paused (setText("")).
            text.value = '';
        }
    }, [active, phrases, frame, phraseIndex, charCount, phase, text, nextDueMs]);

    const animatedProps = useAnimatedProps(() => {
        const value = text.value;
        return { text: value, defaultValue: value };
    });

    return (
        <AnimatedTextInput
            style={style}
            animatedProps={animatedProps}
            editable={false}
            focusable={false}
            caretHidden
            // The whole search row is a Pressable that opens the map flow.
            // A TextInput would swallow the touch even when not editable.
            pointerEvents="none"
            // Android draws an EditText underline unless this is cleared.
            underlineColorAndroid="transparent"
            autoCorrect={false}
            spellCheck={false}
            // Keep the EditText out of the accessibility tree; the Pressable
            // carries the label instead, so TalkBack announces the control
            // rather than a half-typed fragment.
            accessible={false}
            importantForAccessibility="no"
        />
    );
}

export default AndroidTypewriterPlaceholder;
