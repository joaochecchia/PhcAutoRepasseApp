import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Volta do login com Google (phcauto://auth ou exp://.../--/auth). Quem trata o resultado é o
 * openAuthSessionAsync na tela de login; esta rota só existe para o link não cair em "página não encontrada"
 * quando o Android entrega o endereço ao app. Fecha na hora e devolve a pessoa para onde estava.
 */
export default function AuthReturnRoute() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
