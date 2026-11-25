import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Camera, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { UploadFile } from '@/api/announce';
import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { showDialog } from '@/components/dialog';
import { useTheme } from '@/hooks/use-theme';
import { space } from '@/theme';
import { ensureCameraPermission } from '@/utils/permission';
import { preparePhoto } from '@/utils/prepare-photo';

/** Foto redonda da conta; sem foto (ou se ela não carregar), o ícone de pessoa. */
export function ProfileAvatar({ uri, size = 72 }: { uri: string | null; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const show = uri && failed !== uri;
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.subtle, borderColor: colors.border }]}
      accessibilityRole="image"
      accessibilityLabel={show ? 'Foto de perfil' : 'Sem foto de perfil'}>
      {show ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" onError={() => setFailed(uri)} />
      ) : (
        <UserRound size={size * 0.42} color={colors.muted} />
      )}
    </View>
  );
}

/**
 * Escolher foto de perfil ou logo da loja, da galeria ou da câmera. A imagem é reduzida para 1024 px e perde os
 * metadados antes de sair do aparelho, como no site.
 */
export function ProfilePhotoPicker({
  file,
  currentUri,
  onChange,
  hint = 'Opcional. Ela aparece nos seus anúncios.',
}: {
  file: UploadFile | null;
  currentUri?: string | null;
  onChange: (file: UploadFile | null) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function apply(result: ImagePicker.ImagePickerResult) {
    if (result.canceled || !result.assets[0]) return;
    setBusy(true);
    setError('');
    try {
      onChange(await preparePhoto(result.assets[0], 'perfil.jpg', 1024));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível preparar a foto.');
    } finally {
      setBusy(false);
    }
  }

  function choose() {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], exif: false, quality: 1 };
    showDialog({
      title: 'Foto de perfil',
      actions: [
        { label: 'Cancelar', kind: 'cancel' },
        {
          label: 'Tirar foto',
          onPress: async () => {
            if (!(await ensureCameraPermission('tirar sua foto de perfil'))) return;
            apply(await ImagePicker.launchCameraAsync(options));
          },
        },
        { label: 'Escolher da galeria', onPress: async () => apply(await ImagePicker.launchImageLibraryAsync(options)) },
      ],
    });
  }

  return (
    <View style={styles.picker}>
      <ProfileAvatar uri={file?.uri ?? currentUri ?? null} />
      <View style={styles.body}>
        <AppText variant="bodyStrong">Foto de perfil ou logo da loja</AppText>
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
        <View style={styles.actions}>
          <Button
            label={busy ? 'Preparando…' : file || currentUri ? 'Trocar foto' : 'Escolher foto'}
            variant="secondary"
            icon={<Camera size={16} />}
            loading={busy}
            onPress={choose}
          />
          {file ? <Button label="Remover" variant="ghost" onPress={() => onChange(null)} /> : null}
        </View>
        {error ? (
          <AppText variant="caption" color="red" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  picker: { flexDirection: 'row', gap: space.lg, alignItems: 'flex-start' },
  body: { flex: 1, gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs, flexWrap: 'wrap' },
});
