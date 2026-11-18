import { useLocalSearchParams } from 'expo-router';
import { ModerationThreadScreen } from '@/screens/admin/conversation';
export default function AdminConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ModerationThreadScreen id={id} />;
}
