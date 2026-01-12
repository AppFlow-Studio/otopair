/**
 * AIReasoning Component
 * Collapsible "Thinking..." section with animated step-by-step reveal
 * Inspired by prompt-kit's Reasoning component
 * Features: Typing effect, markdown support, auto-close
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';
import { ChevronDown, Check } from 'lucide-react-native';

// ============================================================================
// TYPES
// ============================================================================

export interface ReasoningStep {
  id: string;
  text: string;
  completed?: boolean;
}

interface AIReasoningProps {
  steps: ReasoningStep[];
  isStreaming?: boolean;
  defaultExpanded?: boolean;
  onToggle?: (isExpanded: boolean) => void;
}

// ============================================================================
// ANIMATED DOT COMPONENT
// ============================================================================

function AnimatedDot({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 300, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View 
      style={[styles.dot, animatedStyle]} 
      entering={FadeIn.delay(delay)}
    />
  );
}

// ============================================================================
// TYPEWRITER TEXT COMPONENT - Typing effect for reasoning text
// ============================================================================

function TypewriterText({ 
  text, 
  isComplete,
  delay = 0,
  speed = 25, // ms per character
}: { 
  text: string; 
  isComplete?: boolean;
  delay?: number;
  speed?: number;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // If already complete, show full text immediately
    if (isComplete) {
      setDisplayedText(text);
      setIsTypingDone(true);
      return;
    }

    // Start typing after delay
    timeoutRef.current = setTimeout(() => {
      let currentIndex = 0;
      
      intervalRef.current = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          setIsTypingDone(true);
        }
      }, speed);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, isComplete, delay, speed]);

  // Simple markdown rendering for reasoning text
  const renderMarkdown = useCallback((content: string) => {
    // Split by bold markers **text**
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      // Check if this part is bold
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <Text key={index} style={styles.boldText}>
            {boldText}
          </Text>
        );
      }
      
      // Check for inline code `text`
      const codeParts = part.split(/(`[^`]+`)/g);
      if (codeParts.length > 1) {
        return codeParts.map((codePart, codeIndex) => {
          if (codePart.startsWith('`') && codePart.endsWith('`')) {
            return (
              <Text key={`${index}-${codeIndex}`} style={styles.codeText}>
                {codePart.slice(1, -1)}
              </Text>
            );
          }
          return <Text key={`${index}-${codeIndex}`} style={styles.normalText}>{codePart}</Text>;
        });
      }
      
      return <Text key={index} style={styles.normalText}>{part}</Text>;
    });
  }, []);

  return (
    <Text style={styles.stepText} size="sm">
      {renderMarkdown(displayedText)}
      {!isTypingDone && <Text style={styles.cursor}>▌</Text>}
    </Text>
  );
}

// ============================================================================
// THINKING INDICATOR
// ============================================================================

function ThinkingIndicator() {
  return (
    <View style={styles.thinkingContainer}>
      <Text style={styles.thinkingText} size="sm" weight="medium">
        Thinking
      </Text>
      <View style={styles.dotsContainer}>
        <AnimatedDot delay={0} />
        <AnimatedDot delay={100} />
        <AnimatedDot delay={200} />
      </View>
    </View>
  );
}

// ============================================================================
// STEP ITEM COMPONENT
// ============================================================================

function StepItem({ 
  step, 
  index, 
  isLast,
  isStreaming,
  cumulativeDelay = 0,
}: { 
  step: ReasoningStep; 
  index: number;
  isLast: boolean;
  isStreaming?: boolean;
  cumulativeDelay?: number;
}) {
  const opacity = useSharedValue(0);
  const checkScale = useSharedValue(0);

  useEffect(() => {
    // Show step after cumulative delay from previous steps
    const timeout = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      if (step.completed) {
        // Delay check animation until typing is done
        const typingDuration = step.text.length * 25;
        setTimeout(() => {
          checkScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }, typingDuration);
      }
    }, cumulativeDelay);

    return () => clearTimeout(timeout);
  }, [step.completed, cumulativeDelay]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <Animated.View style={[styles.stepContainer, containerStyle]}>
      <View style={styles.stepIndicator}>
        {step.completed ? (
          <Animated.View style={[styles.checkContainer, checkStyle]}>
            <Check size={12} color={BrandColors.secondary} strokeWidth={3} />
          </Animated.View>
        ) : (
          <View style={styles.stepDot} />
        )}
        {!isLast && <View style={styles.stepLine} />}
      </View>
      <TypewriterText 
        text={step.text}
        isComplete={!isStreaming && step.completed}
        delay={cumulativeDelay}
        speed={25}
      />
    </Animated.View>
  );
}

// ============================================================================
// CURRENT STEP SUMMARY - Shows live status of current step (fades in)
// ============================================================================

function CurrentStepSummary({ 
  step, 
  stepIndex,
  totalSteps,
}: { 
  step: ReasoningStep;
  stepIndex: number;
  totalSteps: number;
}) {
  return (
    <Animated.View 
      key={`step-${stepIndex}`} // Key ensures fade animation on step change
      style={styles.currentStepContainer}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
    >
      {step.completed ? (
        <View style={styles.currentStepCheck}>
          <Check size={10} color={BrandColors.secondary} strokeWidth={3} />
        </View>
      ) : (
        <View style={styles.currentStepDots}>
          <AnimatedDot delay={0} />
          <AnimatedDot delay={100} />
          <AnimatedDot delay={200} />
        </View>
      )}
      <Text style={styles.currentStepText} size="xs" numberOfLines={1}>
        {step.text}
      </Text>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIReasoning({
  steps,
  isStreaming = false,
  defaultExpanded = false,
  onToggle,
}: AIReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const rotation = useSharedValue(defaultExpanded ? 180 : 0);
  const contentHeight = useSharedValue(defaultExpanded ? 1 : 0);

  // Track current step based on timing
  // Each step gets: typing time + reading buffer
  useEffect(() => {
    if (!isStreaming || steps.length === 0) {
      setCurrentStepIndex(steps.length - 1);
      return;
    }

    setCurrentStepIndex(0);

    // Calculate cumulative time for each step transition
    // Each step needs: typing time (20ms/char) + 1500ms reading buffer
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulativeTime = 0;
    
    for (let i = 0; i < steps.length - 1; i++) {
      const typingTime = steps[i].text.length * 20; // Typing time for current step
      const readingBuffer = 1500; // Time to read after typing completes
      cumulativeTime += typingTime + readingBuffer;
      
      timers.push(setTimeout(() => {
        setCurrentStepIndex(i + 1);
      }, cumulativeTime));
    }

    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, [isStreaming, steps.length, steps]);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (!isStreaming && isExpanded && steps.length > 0) {
      // Small delay before auto-collapse
      const timeout = setTimeout(() => {
        handleToggle();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    rotation.value = withSpring(newExpanded ? 180 : 0, { damping: 15 });
    contentHeight.value = withTiming(newExpanded ? 1 : 0, { duration: 250 });
    onToggle?.(newExpanded);
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentHeight.value,
    maxHeight: interpolate(contentHeight.value, [0, 1], [0, 500]),
  }));

  // Show thinking indicator when streaming with no steps yet
  if (isStreaming && steps.length === 0) {
    return (
      <View style={styles.container}>
        <ThinkingIndicator />
      </View>
    );
  }

  // Don't render if no steps
  if (steps.length === 0) {
    return null;
  }

  const currentStep = steps[currentStepIndex] || steps[steps.length - 1];
  const completedCount = steps.filter(s => s.completed).length;

  return (
    <View style={styles.container}>
      {/* Header with current step summary */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed,
        ]}
      >
        <Animated.View style={chevronStyle}>
          <ChevronDown size={16} color={BrandColors.secondary} />
        </Animated.View>
        <Text style={styles.headerText} size="sm" weight="medium">
          {isStreaming ? 'Thinking' : 'Reasoning'}
        </Text>
        {isStreaming && (
          <View style={styles.headerDots}>
            <AnimatedDot delay={0} />
            <AnimatedDot delay={100} />
            <AnimatedDot delay={200} />
          </View>
        )}
        {!isStreaming && (
          <Text style={styles.stepCounter} size="xs">
            ({completedCount}/{steps.length})
          </Text>
        )}
      </Pressable>

      {/* Current Step Summary - Always visible when streaming */}
      {isStreaming && currentStep && (
        <CurrentStepSummary 
          step={currentStep} 
          stepIndex={currentStepIndex}
          totalSteps={steps.length}
        />
      )}

      {/* Collapsible Content - Full reasoning steps */}
      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => {
            // Calculate cumulative delay for this step
            let cumulativeDelay = 0;
            for (let i = 0; i < index; i++) {
              cumulativeDelay += steps[i].text.length * 20 + 1500;
            }
            
            return (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                isLast={index === steps.length - 1}
                isStreaming={isStreaming}
                cumulativeDelay={cumulativeDelay}
              />
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  // Thinking indicator
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
  },
  thinkingText: {
    color: '#6B7280',
    fontFamily: FontFamily.medium,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginLeft: Spacing.xs,
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
    gap: Spacing.xs,
  },
  headerPressed: {
    backgroundColor: '#F3F4F6',
  },
  headerText: {
    color: BrandColors.secondary,
  },
  headerDots: {
    flexDirection: 'row',
    marginLeft: Spacing.xs,
    gap: 3,
  },
  stepCounter: {
    color: '#9CA3AF',
    marginLeft: Spacing.xs,
  },
  // Current step summary (always visible when streaming)
  currentStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#F3F4F6',
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
    maxWidth: '95%',
    gap: Spacing.xs,
  },
  currentStepCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BrandColors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentStepDots: {
    flexDirection: 'row',
    gap: 2,
    marginRight: 2,
  },
  currentStepText: {
    color: BrandColors.primary,
    flex: 1,
  },
  // Content
  content: {
    overflow: 'hidden',
  },
  stepsContainer: {
    paddingTop: Spacing.sm,
    paddingLeft: Spacing.sm,
  },
  // Step item
  stepContainer: {
    flexDirection: 'row',
    minHeight: 28,
  },
  stepIndicator: {
    width: 20,
    alignItems: 'center',
  },
  checkContainer: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BrandColors.secondary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    marginTop: 5,
  },
  stepLine: {
    width: 1,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 4,
  },
  stepText: {
    flex: 1,
    color: BrandColors.primary,
    marginLeft: Spacing.sm,
    lineHeight: 20,
  },
  // Markdown styles
  normalText: {
    color: BrandColors.primary,
  },
  boldText: {
    fontFamily: FontFamily.semiBold,
    color: BrandColors.primary,
  },
  codeText: {
    fontFamily: FontFamily.mono || 'monospace',
    backgroundColor: '#F3F4F6',
    color: BrandColors.secondary,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontSize: 13,
  },
  cursor: {
    color: BrandColors.secondary,
    fontWeight: '300',
  },
});
