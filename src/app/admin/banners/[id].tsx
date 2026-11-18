import { useLocalSearchParams } from 'expo-router';
import { BannerEditorScreen } from '@/screens/admin/banner-editor';
export default function AdminBannerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BannerEditorScreen id={id} />;
}
