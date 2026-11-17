import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import type * as ImagePicker from 'expo-image-picker';

import type { UploadFile } from '@/api/announce';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

/**
 * Reduz a foto (padrão 1600 px) e a deixa abaixo de 3 MB em JPEG, como o site faz antes de enviar. Regravar a imagem
 * também descarta os metadados, inclusive a localização (GPS).
 */
export async function preparePhoto(asset: ImagePicker.ImagePickerAsset, name: string, maxWidth = 1600): Promise<UploadFile> {
  if (asset.fileSize && asset.fileSize > 60 * 1024 * 1024) throw new Error('Uma foto passa de 60 MB.');
  let image = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: Math.min(asset.width, maxWidth) } }], {
    compress: 0.85,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  for (const quality of [0.75, 0.65]) {
    if (new File(image.uri).size <= MAX_PHOTO_BYTES) break;
    image = await ImageManipulator.manipulateAsync(image.uri, [], { compress: quality, format: ImageManipulator.SaveFormat.JPEG });
  }
  if (new File(image.uri).size > MAX_PHOTO_BYTES) throw new Error('Uma foto continua acima de 3 MB após a preparação.');
  return { uri: image.uri, name, type: 'image/jpeg' };
}
