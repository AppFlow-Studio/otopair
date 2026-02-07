/**
 * AIReasoning
 *
 * PURPOSE: Collapsible "Show thinking" panel with animated step-by-step typewriter reveal
 *
 * USED IN: components/ai-chat/AIMessageBubble.tsx (renders inside AI messages with reasoning)
 *
 * PROPS:
 *   - steps (ReasoningStep[]): Array of reasoning steps to display
 *   - isStreaming (boolean): Whether the message is still streaming
 *   - defaultExpanded (boolean): Whether to start expanded (default: false)
 *   - onToggle ((isExpanded: boolean) => void): Callback when expand/collapse is toggled
 *
 * EXAMPLE:
 *   <AIReasoning
 *     steps={[{ id: '1', text: 'Analyzing brake data...', completed: true }]}
 *     isStreaming={true}
 *     defaultExpanded={false}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

// 2. Expo & Third-party
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
import { ChevronDown, Check } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

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
  shouldAnimate = true,
}: { 
  text: string; 
  isComplete?: boolean;
  delay?: number;
  speed?: number;
  shouldAnimate?: boolean;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTypingDone, setIsTypingDone] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    // If already complete or shouldn't animate, show full text immediately
    if (isComplete || !shouldAnimate || hasAnimatedRef.current) {
      setDisplayedText(text);
      setIsTypingDone(true);
      return;
    }

    // Mark as animated
    hasAnimatedRef.current = true;

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
  }, [text, isComplete, delay, speed, shouldAnimate]);

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
    <View style={styles.thinkingRow}>
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
  shouldAnimate = true,
}: { 
  step: ReasoningStep; 
  index: number;
  isLast: boolean;
  isStreaming?: boolean;
  cumulativeDelay?: number;
  shouldAnimate?: boolean;
}) {
  const opacity = useSharedValue(shouldAnimate ? 0 : 1);
  const checkScale = useSharedValue(step.completed ? 1 : 0);

  useEffect(() => {
    if (!shouldAnimate) {
      opacity.value = 1;
      if (step.completed) {
        checkScale.value = 1;
      }
      return;
    }

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
  }, [step.completed, cumulativeDelay, shouldAnimate]);

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
        shouldAnimate={shouldAnimate}
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
  const [hasFullyRendered, setHasFullyRendered] = useState(false);
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

  // Auto-collapse when streaming ends and mark as fully rendered
  useEffect(() => {
    if (!isStreaming && steps.length > 0) {
      // Mark as fully rendered once streaming completes
      setHasFullyRendered(true);
      
      if (isExpanded) {
        // Small delay before auto-collapse
        const timeout = setTimeout(() => {
          handleToggle();
        }, 2000);
        return () => clearTimeout(timeout);
      }
    }
  }, [isStreaming]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    rotation.value = withTiming(newExpanded ? 180 : 0, { 
      duration: 200,
      easing: Easing.inOut(Easing.ease),
    });
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
      {/* Header - Gemini style toggle */}
      <Pressable
        onPress={handleToggle}
        style={styles.header}
      >
        <Text style={styles.headerText} size="sm">
          {isExpanded ? 'Hide thinking' : 'Show thinking'}
        </Text>
        <Animated.View style={chevronStyle}>
          <ChevronDown size={14} color="#5F6368" strokeWidth={2} />
        </Animated.View>
      </Pressable>

      {/* Current Step Summary - Always visible when streaming (no box) */}
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
            // Calculate cumulative delay for this step (only if not fully rendered)
            let cumulativeDelay = 0;
            if (!hasFullyRendered) {
              for (let i = 0; i < index; i++) {
                cumulativeDelay += steps[i].text.length * 20 + 1500;
              }
            }
            
            return (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                isLast={index === steps.length - 1}
                isStreaming={isStreaming}
                cumulativeDelay={cumulativeDelay}
                shouldAnimate={!hasFullyRendered}
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
  // Thinking indicator row (above toggle)
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  // Thinking indicator (standalone - for no steps state)
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  thinkingText: {
    color: BrandColors.secondary,
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
  // Header - Gemini minimal style
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    alignSelf: 'flex-start',
    gap: 6,
  },
  headerText: {
    color: '#5F6368',
    fontSize: 13,
  },
  // Current step summary (always visible when streaming) - no box
  currentStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
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
