import { useLocalSearchParams } from 'expo-router';

import { LotScreen } from '@/screens/lot';

export default function LotRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LotScreen id={id} />;
}
