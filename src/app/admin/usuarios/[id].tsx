import { useLocalSearchParams } from 'expo-router';
import { UserDetailScreen } from '@/screens/admin/user-detail';
export default function AdminUserRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserDetailScreen id={id} />;
}
