import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Button, Text } from '@/components/shared-ui';
import { MoveRight, MessageCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OtoPairIcon />
        <Text weight="semiBold" size="2xl" style={styles.title}>
          OtoPair
        </Text>
        <Text style={styles.subtitle} size="md">
          Your AI-powered automotive assistant
        </Text>
        
        <View style={styles.buttonContainer}>
          <Button 
            variant='secondary' 
            onPress={() => router.push('/(main-tabs)/ai-chat')}
            fullWidth
          >
            <MessageCircle size={18} color="#fff" style={{ marginRight: 8 }} />
            Ask AI About Your Car
          </Button>
          
          <Button variant='primary' fullWidth>
            Let's Check Your Car Now 
            <MoveRight size={16} color="#fff" style={{ marginLeft: 8 }} />
          </Button>
        </View>
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
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  title: {
    color: '#141C24',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
});
