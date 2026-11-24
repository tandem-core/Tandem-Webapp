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
        <Text style={styles.body}>Use your Tandem device to record an appointment.</Text>
        <Text style={styles.muted}>Recording with this phone is coming soon.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
