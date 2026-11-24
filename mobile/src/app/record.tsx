import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/ui';

export default function Record() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          Record
        </Text>
        <Text style={styles.muted}>Coming soon.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
