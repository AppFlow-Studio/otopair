import { Redirect } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Button,
  Container,
  Divider,
  H2,
  Small,
  Text,
} from "@/components/shared-ui";
import { useToast } from "@/hooks/useToast";
import { haptics } from "@/lib/haptics";

/**
 * Dev-only playground for the in-app toast system. Fires every variant
 * and exercises queueing, preemption, swipe-up dismissal, and Reduce
 * Motion paths. Routed at /dev/toast-playground but only mounted when
 * __DEV__ is true.
 */
export default function ToastPlaygroundScreen() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  return <Playground />;
}

function Playground() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <Container padding="md">
        <H2>Toast playground</H2>
        <Small>Mount point for the in-app notification system. Dev-only.</Small>
        <Divider />

        <Section title="Single variant fire">
          <Button
            onPress={() =>
              toast.success("Booking confirmed", "Thursday, 9:00 AM")
            }
          >
            Success
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast.info(
                "Vehicle checked in.",
                "Your mechanic will review shortly.",
              )
            }
          >
            Info
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast.warning(
                "Quote revised",
                "Review the change before approving.",
              )
            }
          >
            Warning
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast.error(
                "Couldn't save",
                "Check your connection and try again.",
              )
            }
          >
            Error
          </Button>
          <Button
            variant="secondary"
            onPress={() =>
              toast.trust(
                "Parts came in $42 under the estimate.",
                "Refund is on its way.",
              )
            }
          >
            Trust-Moment
          </Button>
        </Section>

        <Section title="Queue + preemption">
          <Button
            onPress={() => {
              toast.success("First", "fires immediately");
              toast.info("Second", "queued behind success");
              toast.warning("Third", "still queued");
            }}
          >
            Stack 3 toasts
          </Button>
          <Button
            variant="secondary"
            onPress={() => {
              toast.info("Plain info", "about to be interrupted");
              setTimeout(
                () => toast.error("Error preempts", "watch this preempt info"),
                400,
              );
            }}
          >
            Error preempts Info
          </Button>
          <Button variant="ghost" onPress={toast.dismissAll}>
            Dismiss all
          </Button>
        </Section>

        <Section title="Haptic policy">
          <Button onPress={haptics.cta}>haptics.cta()</Button>
          <Button variant="secondary" onPress={haptics.selection}>
            haptics.selection()
          </Button>
          <Button variant="secondary" onPress={haptics.confirmDestructive}>
            haptics.confirmDestructive()
          </Button>
        </Section>

        <Section title="Visual checkpoint">
          <Text>
            Toggle iOS Simulator → Settings → Developer → Dark Appearance to
            verify the dark sheet hex values. Toggle Settings → Accessibility →
            Motion → Reduce Motion to verify crossfade + suppressed haptics.
          </Text>
        </Section>
      </Container>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <H2>{title}</H2>
      <View style={{ height: 8 }} />
      <View style={{ gap: 8 }}>{children}</View>
      <Divider />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll: { paddingHorizontal: 16 },
  section: { marginTop: 16 },
});
