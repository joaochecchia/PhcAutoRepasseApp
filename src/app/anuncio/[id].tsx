import { useLocalSearchParams } from 'expo-router';

import { VehicleDetail } from '@/screens/vehicle';

export default function VehicleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VehicleDetail id={id} />;
}
