import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Button, Text } from '@/components/shared-ui';
import { MoveRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OtoPairIcon />
        <Text weight="semiBold" size="2xl" style={styles.title}>
          OtoPair
        </Text>
        <Button variant='primary'>Let’s Check Your Car Now <MoveRight size={16} color="#fff" /> </Button>
      </View>
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: '#141C24',
    letterSpacing: 0.5,
  },
});
