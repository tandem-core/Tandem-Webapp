import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/ui';

export default function Prescriptions() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          Prescriptions
        </Text>
        <Text style={styles.body}>Medicines discussed at your appointments will show up here soon.</Text>
        <Text style={styles.muted}>Your prescription label and your pharmacist have the final word.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
