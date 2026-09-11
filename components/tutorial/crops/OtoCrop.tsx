/**
 * OtoCrop — one exchange with Oto.
 *
 * The reply is written to do two things the step's copy claims: it uses the
 * car's OWN history ("34,000 mi ago"), which is what separates Oto from a
 * general chatbot, and it ends in something bookable rather than in advice.
 * A generic answer here would make the step a feature tour of a text box.
 *
 * BEAT: question, pause, typing, answer. The pause is the whole point — it
 * shows Oto working rather than the answer having been sitting there. Skipping
 * it would make the exchange read as a screenshot of a script.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BrandColors, FontFamily } from "@/constants/theme";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../PhoneMock";

const INK = BrandColors.primary;
const ACCENT = BrandColors.secondary;

/** Question in, beat, typing, answer. Tuned so the whole run lands inside the
 *  time a driver spends reading the headline underneath. */
const ASK_AT = 120;
const TYPING_AT = 520;
const REPLY_AT = 1220;

function TypingDot({ index, play, reduceMotion }: { index: number; play: boolean; reduceMotion: boolean }) {
  const v = useSharedValue(0.3);
  useEffect(() => {
    if (reduceMotion || !play) {
      v.value = 0.3;
      return;
    }
    v.value = withDelay(
      TYPING_AT + index * 140,
      withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0.3, { duration: 320 })), -1),
    );
  }, [play, reduceMotion, index, v]);
  const s = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.typingDot, s]} />;
}

export function OtoCrop({ play, reduceMotion }: { play: boolean; reduceMotion: boolean }) {
  const ask = useSharedValue(reduceMotion ? 1 : 0);
  const typing = useSharedValue(0);
  const reply = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      ask.value = 1;
      typing.value = 0;
      reply.value = 1;
      return;
    }
    if (!play) {
      ask.value = 0;
      typing.value = 0;
      reply.value = 0;
      return;
    }
    const ease = { duration: 260, easing: Easing.bezier(0.16, 1, 0.3, 1) };
    ask.value = withDelay(ASK_AT, withTiming(1, ease));
    // The indicator is shown and then taken away again — it is a state, not a
    // decoration, so it must not survive the answer arriving.
    typing.value = withDelay(TYPING_AT, withTiming(1, { duration: 180 }));
    typing.value = withDelay(REPLY_AT - 80, withTiming(0, { duration: 120 }));
    reply.value = withDelay(REPLY_AT, withTiming(1, ease));
  }, [play, reduceMotion, ask, typing, reply]);

  const askStyle = useAnimatedStyle(() => ({
    opacity: ask.value,
    transform: [{ translateY: (1 - ask.value) * 10 }],
  }));
  const typingStyle = useAnimatedStyle(() => ({ opacity: typing.value }));
  const replyStyle = useAnimatedStyle(() => ({
    opacity: reply.value,
    transform: [{ translateY: (1 - reply.value) * 10 }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.thread}>
        <Animated.View style={[styles.askRow, askStyle]}>
          <View style={styles.askBubble}>
            <Text style={styles.askText}>Grinding noise when I brake — is that bad?</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.typingRow, typingStyle]} pointerEvents="none">
          <View style={styles.avatar}>
            <Text style={styles.avatarMark}>O</Text>
          </View>
          <View style={styles.typingBubble}>
            {[0, 1, 2].map((i) => (
              <TypingDot key={i} index={i} play={play} reduceMotion={reduceMotion} />
            ))}
          </View>
        </Animated.View>

        <Animated.View style={[styles.replyRow, replyStyle]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarMark}>O</Text>
          </View>
          <View style={styles.replyBubble}>
            <Text style={styles.replyText}>
              Usually worn pads. Your brakes were last done 34,000 mi ago — worth a look.
            </Text>
            <View style={styles.action}>
              <Text style={styles.actionText}>Book a brake check</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#FFFFFF" },
  thread: { position: "absolute", left: 12, right: 12, top: 84, gap: 10 },
  askRow: { flexDirection: "row", justifyContent: "flex-end" },
  askBubble: {
    maxWidth: 146,
    backgroundColor: ACCENT,
    borderRadius: 15,
    borderBottomRightRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  askText: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 17, color: "#FFFFFF" },
  typingRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8EDF3",
    borderRadius: 15,
    borderTopLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  typingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#8A94A3" },
  replyRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarMark: { fontFamily: FontFamily.bold, fontSize: 11, color: "#FFFFFF" },
  replyBubble: {
    flex: 1,
    backgroundColor: "#E8EDF3",
    borderRadius: 15,
    borderTopLeftRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  replyText: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 17, color: INK },
  action: {
    height: 28,
    borderRadius: 8,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontFamily: FontFamily.semiBold, fontSize: 11.5, color: "#FFFFFF" },
});
