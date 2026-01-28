/**
 * ContactUsScreen
 *
 * PURPOSE: Contact support screen with topic selection, subject, and description.
 *          Includes a success state and a topic selection bottom sheet.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Paperclip,
  Check,
  User,
  Calendar,
  Car,
  CreditCard,
  Award,
  BadgeCheck,
  MoreHorizontal,
} from 'lucide-react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';

import { BrandColors, Spacing, Text, AppBottomSheetModal, BlurHeaderOverlay } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

type TopicKey = 'getting-started' | 'bookings' | 'vehicles' | 'payments' | 'loyalty' | 'pass' | 'other';

interface Topic {
  id: TopicKey;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const TOPICS: Topic[] = [
  { id: 'getting-started', label: 'Account and getting started', icon: User, color: '#2463eb', bgColor: 'rgba(36, 99, 235, 0.1)' },
  { id: 'bookings', label: 'Bookings & services', icon: Calendar, color: '#9333ea', bgColor: 'rgba(147, 51, 234, 0.1)' },
  { id: 'vehicles', label: 'Vehicles', icon: Car, color: '#16a34a', bgColor: 'rgba(22, 163, 74, 0.1)' },
  { id: 'payments', label: 'Payments & billing', icon: CreditCard, color: '#ea580c', bgColor: 'rgba(234, 88, 12, 0.1)' },
  { id: 'loyalty', label: 'Loyalty & rewards', icon: Award, color: '#db2777', bgColor: 'rgba(219, 39, 119, 0.1)' },
  { id: 'pass', label: 'Otopair Pass', icon: BadgeCheck, color: '#4f46e5', bgColor: 'rgba(79, 70, 229, 0.1)' },
  { id: 'other', label: 'Other', icon: MoreHorizontal, color: '#4b5563', bgColor: 'rgba(75, 85, 99, 0.1)' },
];

export default function ContactUsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topicSheetRef = useRef<BottomSheetModal>(null);

  const [selectedTopicId, setSelectedTopicId] = useState<TopicKey | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const selectedTopic = useMemo(() => 
    TOPICS.find(t => t.id === selectedTopicId), 
  [selectedTopicId]);

  const canSubmit = selectedTopicId && subject.trim() && description.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsSubmitting(false);
    setIsSuccess(true);
  };

  const handleTopicSelect = (id: TopicKey) => {
    setSelectedTopicId(id);
  };

  if (isSuccess) {
    return (
      <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <Check size={48} color={BrandColors.secondary} strokeWidth={3} />
          </View>
          <Text weight="bold" size="2xl" color="#111318" style={styles.successTitle}>
            Message sent
          </Text>
          <Text size="md" color="#616e89" center style={styles.successSubtitle}>
            We'll reply to your email shortly.
          </Text>
          <View style={styles.ticketIdBadge}>
            <Text weight="medium" size="sm" color="#616e89">
              Ticket ID: #48291
            </Text>
          </View>
        </View>
        <View style={[styles.footer, { paddingBottom: getSheetContentPadding(true, insets.bottom) }]}>
          <Pressable 
            style={styles.submitButton} 
            onPress={() => router.back()}
          >
            <Text weight="semiBold" size="md" color="#FFF">Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Contact Support" />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent, 
            { 
              paddingTop: insets.top + 80, 
              paddingBottom: getSheetContentPadding(true, insets.bottom) 
            }
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroArea}>
            <Text weight="bold" style={styles.heroTitle}>Send us a message</Text>
            <Text size="md" color="#6B7280">We'll reply to the email on your profile.</Text>
          </View>

          {/* Form Card */}
          <View style={styles.glassCard}>
            {/* Topic Row */}
            <Pressable 
              style={styles.formRow} 
              onPress={() => topicSheetRef.current?.present()}
            >
              <Text weight="medium" size="md" color="#111318" style={styles.rowLabel}>
                Topics<Text color={BrandColors.secondary}>*</Text>
              </Text>
              <View style={styles.rowValue}>
                <Text size="md" color={selectedTopic ? "#111318" : "#6B7280"}>
                  {selectedTopic ? selectedTopic.label : 'Select a topic'}
                </Text>
                <ChevronRight size={20} color="#C7C7CC" style={{ marginLeft: 8 }} />
              </View>
            </Pressable>

            <View style={styles.separator} />

            {/* Subject Row */}
            <View style={styles.formRow}>
              <Text weight="medium" size="md" color="#111318" style={styles.rowLabel}>
                Subject<Text color={BrandColors.secondary}>*</Text>
              </Text>
              <TextInput
                style={styles.rowInput}
                value={subject}
                onChangeText={setSubject}
              />
            </View>

            <View style={styles.separator} />

            {/* Description Area */}
            <View style={styles.descriptionArea}>
              <Text weight="medium" size="md" color="#111318" style={{ marginBottom: 8 }}>
                Description of issue<Text color={BrandColors.secondary}>*</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Please describe what happened..."
                placeholderTextColor="#C7C7CC"
                multiline
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Attachment Card */}
          <Pressable style={styles.glassCard}>
            <View style={styles.attachmentRow}>
              <View style={styles.attachmentIconBox}>
                <Paperclip size={20} color={BrandColors.secondary} style={{ transform: [{ rotate: '135deg' }] }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="medium" size="md" color={BrandColors.secondary}>
                  Attach screenshot or video
                </Text>
                <Text size="xs" color="#8E8E93">Up to 10 • Max 32MB</Text>
              </View>
            </View>
          </Pressable>

          <View style={{ flex: 1 }} />

          {/* Submit Area */}
          <View style={styles.submitArea}>
            <Pressable 
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <Text weight="semiBold" size="md" color="#FFF">
                {isSubmitting ? 'Sending...' : 'Submit ticket'}
              </Text>
            </Pressable>
            <Text size="xs" color="#8E8E93" center style={{ marginTop: 16 }}>
              You can expect a response typically within 24 hours.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Topic Selection Sheet */}
      <AppBottomSheetModal
        ref={topicSheetRef}
        title="Select a topic"
        snapPoints={['65%']}
        footer={
          <Pressable 
            style={styles.submitButton} 
            onPress={() => topicSheetRef.current?.dismiss()}
          >
            <Text weight="semiBold" size="md" color="#FFF">Done</Text>
          </Pressable>
        }
      >
        <View style={styles.topicList}>
          {TOPICS.map((topic, index) => (
            <React.Fragment key={topic.id}>
              <Pressable 
                style={styles.topicItem} 
                onPress={() => handleTopicSelect(topic.id)}
              >
                <View style={styles.topicItemLeft}>
                  <View style={[styles.topicIconCircle, { backgroundColor: topic.bgColor }]}>
                    <topic.icon size={20} color={topic.color} />
                  </View>
                  <Text weight="medium" size="md" color="#111318">{topic.label}</Text>
                </View>
                <View style={[
                  styles.radioOuter, 
                  selectedTopicId === topic.id && styles.radioOuterActive
                ]}>
                  {selectedTopicId === topic.id && <View style={styles.radioInner} />}
                </View>
              </Pressable>
              {index < TOPICS.length - 1 && <View style={styles.listSeparator} />}
            </React.Fragment>
          ))}
        </View>
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  heroArea: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: '#111318',
    marginBottom: 8,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  rowLabel: {
    width: '30%',
  },
  rowValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rowInput: {
    flex: 1,
    fontSize: 16,
    color: '#111318',
    padding: 0,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 16,
  },
  descriptionArea: {
    padding: 16,
  },
  textArea: {
    fontSize: 16,
    color: '#111318',
    minHeight: 100,
    lineHeight: 22,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  attachmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(36, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  submitArea: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(36, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    marginBottom: 8,
  },
  successSubtitle: {
    marginBottom: 24,
    maxWidth: 280,
  },
  ticketIdBadge: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(60, 60, 67, 0.12)',
  },
  topicList: {
    paddingTop: 8,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  topicItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topicIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#dbdee6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: BrandColors.secondary,
    backgroundColor: BrandColors.secondary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
  listSeparator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.08)',
    marginLeft: 56,
  },
  footer: {
    paddingHorizontal: 20,
  },
});
