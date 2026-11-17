import { useLocalSearchParams } from 'expo-router';

import { DeleteAccount } from '@/screens/account/delete-account';

export default function DeleteAccountRoute() {
  const { senha } = useLocalSearchParams<{ senha?: string }>();
  return <DeleteAccount hasPassword={senha !== '0'} />;
}
