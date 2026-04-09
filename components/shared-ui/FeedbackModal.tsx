import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { BrandColors } from '@/constants/theme';
import { Button } from './Button';
import { Text } from './Text';

export interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Optional async submit handler.
   * If not provided, we simulate a successful submit.
   */
  onSubmit?: (feedback: string) => Promise<void>;
  placeholder?: string;
  title?: string;
}

export function FeedbackModal({
  visible,
  onClose,
  onSubmit,
  placeholder = 'Enter your feedback here',
  title = 'Give Us Feedback',
}: FeedbackModalProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);

  // Force KAV remount on Android when keyboard hides to fix height not resetting.
  // We debounce to avoid reacting to the hide event caused by the remount itself.
  const [kavKey, setKavKey] = useState(0);
  const remountTimer = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'android' || !visible) return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (remountTimer.current) clearTimeout(remountTimer.current);
      remountTimer.current = setTimeout(() => {
        setKavKey((k) => k + 1);
      }, 100);
    });
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      // Cancel any pending remount if the keyboard comes back up
      if (remountTimer.current) {
        clearTimeout(remountTimer.current);
        remountTimer.current = null;
      }
    });
    return () => {
      sub.remove();
      showSub.remove();
      if (remountTimer.current) clearTimeout(remountTimer.current);
    };
  }, [visible]);

  const canSubmit = useMemo(() => feedback.trim().length > 0 && !isSubmitting && !didSucceed, [
    feedback,
    isSubmitting,
    didSucceed,
  ]);

  useEffect(() => {
    if (!visible) {
      setFeedback('');
      setIsSubmitting(false);
      setDidSucceed(false);
      setKavKey(0);
    }
  }, [visible]);

  const handleSubmit = useCallback(async () => {
    const trimmed = feedback.trim();
    if (trimmed.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(trimmed);
      } else {
        // Simulated request
        await new Promise((r) => setTimeout(r, 900));
      }

      setIsSubmitting(false);
      setDidSucceed(true);
      setFeedback('');

      // Show success briefly then close
      setTimeout(() => {
        onClose();
      }, 900);
    } catch {
      setIsSubmitting(false);
    }
  }, [feedback, isSubmitting, onClose, onSubmit]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onShow={() => {
        // Simple command to focus and trigger keyboard after 150ms
        setTimeout(() => {
          inputRef.current?.focus();
        }, 150);
      }}
    >
      {/* Full-screen background layer (independent of KeyboardAvoidingView) */}
      <View style={styles.fullScreenBackdrop} pointerEvents="none" />

      <KeyboardAvoidingView
        key={kavKey}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Backdrop touch target - tap to close */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Modal Card */}
        <View style={[styles.card, { marginBottom: insets.bottom + 8 }]}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
              <X size={20} color="#111827" />
            </Pressable>
            <Text weight="bold" size="lg" color="#111827" style={styles.headerTitle}>
              {title}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text weight="medium" size="sm" color="#374151" style={styles.label}>
              Feedback
            </Text>

            <TextInput
              ref={inputRef}
              value={feedback}
              onChangeText={setFeedback}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              autoFocus={kavKey === 0}
              textAlignVertical="top"
            />

            {didSucceed ? (
              <View style={styles.successRow}>
                <Text weight="medium" size="sm" color="#16A34A">
                  Thanks! Your feedback was sent.
                </Text>
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Button
                variant="ghost"
                fullWidth
                style={[styles.actionButton, styles.cancelButton]}
                textColor="#111827"
                onPress={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Pressable
                style={[styles.submitWrap, !canSubmit && styles.submitWrapDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text weight="semiBold" size="md" color="#FFF">
                    Submit
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  fullScreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    marginHorizontal: 10,
    backgroundColor: '#E8ECF0',
    borderRadius: 28,
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#6B7280',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  label: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 120,
    fontSize: 16,
    color: '#111827',
  },
  successRow: {
    marginTop: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#EEF2F7',
  },
  submitWrap: {
    flex: 2,
    borderRadius: 14,
    backgroundColor: BrandColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  submitWrapDisabled: {
    opacity: 0.5,
  },
});
