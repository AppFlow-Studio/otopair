/**
 * useVoiceRecording
 *
 * PURPOSE: Custom hook for voice recording (mock implementation for UI testing)
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (voice input feature)
 *
 * NOTE: This is a mock implementation. Real speech recognition will be added
 *       when expo-speech-recognition is properly configured.
 *
 * RETURNS:
 *   - isRecording (boolean): Whether recording is in progress
 *   - isTranscribing (boolean): Whether transcription is being processed
 *   - transcript (string): Current transcript
 *   - meteringValue (number): Audio level for visualization
 *   - startRecording (() => Promise<void>): Start recording
 *   - stopRecording (() => Promise<string | null>): Stop and get transcript
 *   - cancelRecording (() => Promise<void>): Cancel without result
 *
 * OWNER: Waleed Mansour
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

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

// ============================================================================
// HOOK (Mock Implementation)
// ============================================================================

export function useVoiceRecording(): UseVoiceRecordingReturn {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isTranscribing: false,
    transcript: '',
    meteringValue: -160,
  });

  // Ref to track the metering interval
  const meteringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
      }
    };
  }, []);

  // Simulate metering values for waveform animation
  const startMeteringSimulation = useCallback(() => {
    meteringIntervalRef.current = setInterval(() => {
      // Generate random metering value between -60 and -10 for visual effect
      const randomMetering = -60 + Math.random() * 50;
      setState((prev) => ({
        ...prev,
        meteringValue: randomMetering,
      }));
    }, 100);
  }, []);

  const stopMeteringSimulation = useCallback(() => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
  }, []);

  // Start recording (mock)
  const startRecording = useCallback(async () => {
    setState({
      isRecording: true,
      isTranscribing: false,
      transcript: '',
      meteringValue: -40,
    });
    
    startMeteringSimulation();
  }, [startMeteringSimulation]);

  // Stop recording (mock)
  const stopRecording = useCallback(async (): Promise<string | null> => {
    stopMeteringSimulation();
    
    setState((prev) => ({
      ...prev,
      isRecording: false,
      isTranscribing: true,
      meteringValue: -160,
    }));

    // Simulate transcription delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setState((prev) => ({
      ...prev,
      isTranscribing: false,
    }));

    // Show a message that speech recognition is not available yet
    Alert.alert(
      'Coming Soon',
      'Voice transcription is not yet available. This feature will be enabled in a future update.',
      [{ text: 'OK' }]
    );

    return null;
  }, [stopMeteringSimulation]);

  // Cancel recording (mock)
  const cancelRecording = useCallback(async () => {
    stopMeteringSimulation();
    
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
