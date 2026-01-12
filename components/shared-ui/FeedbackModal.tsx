import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSucceed, setDidSucceed] = useState(false);

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
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      {/* Overlay (tap outside does NOT dismiss) */}
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kb}
        >
          <View style={styles.card}>
            <Text weight="semiBold" size="xl" color="#111827" style={styles.title}>
              {title}
            </Text>

            <Text weight="medium" size="sm" color="#374151" style={styles.label}>
              Feedback
            </Text>

            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder={placeholder}
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              autoFocus
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
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  kb: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: 14,
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

