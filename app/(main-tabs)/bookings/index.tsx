import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Text } from '@/components/shared-ui';
import { StyleSheet, View } from 'react-native';


export default function BookingsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OtoPairIcon />
        <Text weight="semiBold" size="2xl" style={styles.title}>
          OtoPair
        </Text>
      </View>
    </View>
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
