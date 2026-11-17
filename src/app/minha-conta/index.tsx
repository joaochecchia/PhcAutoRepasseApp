import { useLocalSearchParams } from 'expo-router';

import { AccountScreen } from '@/screens/account';

/** Com origem=anunciar, a tela é a conferência dos dados do anunciante e volta ao anúncio ao salvar. */
export default function AccountRoute() {
  const { origem } = useLocalSearchParams<{ origem?: string }>();
  return <AccountScreen fromAnnounce={origem === 'anunciar'} />;
}
