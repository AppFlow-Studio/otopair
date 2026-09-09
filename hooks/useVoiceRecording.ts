/**
 * useVoiceRecording
 *
 * PURPOSE: Hold-to-talk voice input backed by real on-device speech
 *          recognition (expo-speech-recognition). Press-in starts listening,
 *          press-out stops and resolves with the final transcript.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (voice input feature)
 *
 * RETURNS:
 *   - isRecording (boolean): Whether recording is in progress
 *   - isTranscribing (boolean): Whether the final transcript is being resolved
 *   - transcript (string): Live (interim) transcript
 *   - meteringValue (number): Audio level for the waveform visualization
 *   - startRecording (() => Promise<void>): Start listening
 *   - stopRecording (() => Promise<string | null>): Stop and get transcript
 *   - cancelRecording (() => Promise<void>): Cancel without result
 *
 * OWNER: Waleed Mansour
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// ============================================================================
// TYPES
// ============================================================================

interface VoiceRecordingState {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  meteringValue: number;
}

interface UseVoiceRecordingReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  meteringValue: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  cancelRecording: () => Promise<void>;
}

// After stop() we wait for the recognizer's final `result`/`end` event before
// resolving. This caps that wait so the mic never hangs if no event arrives.
const FINALIZE_TIMEOUT_MS = 4000;

// ============================================================================
// HOOK
// ============================================================================

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isTranscribing: false,
    transcript: '',
    meteringValue: -160,
  });

  // Latest transcript seen from result events — returned on stop.
  const transcriptRef = useRef('');
  // Resolver for the promise stopRecording() returns; fulfilled by the
  // `end`/`error` event (or the safety timeout).
  const finalizeResolverRef = useRef<((t: string | null) => void) | null>(null);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Simulated metering just drives the waveform bars while listening.
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // True once we've asked the recognizer to stop, so `end` finalizes.
  const stoppingRef = useRef(false);

  const stopMeteringSimulation = useCallback(() => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
  }, []);

  const startMeteringSimulation = useCallback(() => {
    stopMeteringSimulation();
    meteringIntervalRef.current = setInterval(() => {
      const randomMetering = -60 + Math.random() * 50;
      setState((prev) => ({ ...prev, meteringValue: randomMetering }));
    }, 100);
  }, [stopMeteringSimulation]);

  const finalize = useCallback(
    (result: string | null) => {
      stopMeteringSimulation();
      stoppingRef.current = false;
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isRecording: false,
        isTranscribing: false,
        meteringValue: -160,
      }));
      if (finalizeResolverRef.current) {
        finalizeResolverRef.current(result);
        finalizeResolverRef.current = null;
      }
    },
    [stopMeteringSimulation],
  );

  // ── Recognizer events ────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript ?? '';
    if (text) transcriptRef.current = text;
    setState((prev) => ({ ...prev, transcript: text }));
  });

  useSpeechRecognitionEvent('end', () => {
    // Fires after stop() (or auto-stop on silence). Resolve with whatever we
    // captured. If the user is still holding (not stopping), ignore.
    if (stoppingRef.current) {
      finalize(transcriptRef.current.trim() || null);
    } else {
      setState((prev) => ({ ...prev, isRecording: false }));
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    // "no-speech" just means silence — don't surface it as an error.
    if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
      console.warn('[voice] recognition error:', event.error, event.message);
    }
    finalize(transcriptRef.current.trim() || null);
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMeteringSimulation();
      if (finalizeTimerRef.current) clearTimeout(finalizeTimerRef.current);
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore — nothing to abort
      }
    };
  }, [stopMeteringSimulation]);

  // ── Public API ───────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    transcriptRef.current = '';
    stoppingRef.current = false;

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Microphone access needed',
        'Enable microphone and speech recognition access in Settings to talk to Oto.',
        [{ text: 'OK' }],
      );
      return;
    }

    setState({
      isRecording: true,
      isTranscribing: false,
      transcript: '',
      meteringValue: -40,
    });
    startMeteringSimulation();

    try {
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        // Keep listening while the button is held (don't auto-stop on a pause).
        continuous: true,
      });
    } catch (err) {
      console.warn('[voice] failed to start recognition:', err);
      finalize(null);
    }
  }, [startMeteringSimulation, finalize]);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    // Not recording (e.g. permission was denied) — nothing to finalize.
    if (!stoppingRef.current && !meteringIntervalRef.current) {
      // Fall through only if we actually started; otherwise resolve empty.
    }
    stoppingRef.current = true;
    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: true,
      meteringValue: -160,
    }));

    return new Promise<string | null>((resolve) => {
      finalizeResolverRef.current = resolve;
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        finalize(transcriptRef.current.trim() || null);
        return;
      }
      // Safety net: if no end/error event arrives, resolve with what we have.
      finalizeTimerRef.current = setTimeout(() => {
        finalize(transcriptRef.current.trim() || null);
      }, FINALIZE_TIMEOUT_MS);
    });
  }, [finalize]);

  const cancelRecording = useCallback(async () => {
    stoppingRef.current = false;
    stopMeteringSimulation();
    if (finalizeTimerRef.current) {
      clearTimeout(finalizeTimerRef.current);
      finalizeTimerRef.current = null;
    }
    finalizeResolverRef.current = null;
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
    setState({
      isRecording: false,
      isTranscribing: false,
      transcript: '',
      meteringValue: -160,
    });
  }, [stopMeteringSimulation]);

  return {
    isRecording: state.isRecording,
    isTranscribing: state.isTranscribing,
    transcript: state.transcript,
    meteringValue: state.meteringValue,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
