import { useLocalSearchParams } from 'expo-router';

import { StoreScreen } from '@/screens/stores/store';

export default function StoreRoute() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <StoreScreen slug={slug} />;
}
