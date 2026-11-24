import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/ui';

export default function Todos() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle} accessibilityRole="header">
          To-dos
        </Text>
        <Text style={styles.body}>Things to do after your appointments will show up here soon.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
