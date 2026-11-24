import { Stack } from 'expo-router';

// Keeps the list under an appointment opened from Home, so Back lands on it.
export const unstable_settings = { anchor: 'index' };

export default function AppointmentsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
