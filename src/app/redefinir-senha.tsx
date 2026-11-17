import { useLocalSearchParams } from 'expo-router';

import { PasswordScreen } from '@/screens/password';

/** /redefinir-senha: esqueci a senha. Com origem=perfil: troca de senha de quem está logado. */
export default function PasswordRoute() {
  const { origem } = useLocalSearchParams<{ origem?: string }>();
  return <PasswordScreen change={origem === 'perfil'} />;
}
