import * as ImagePicker from 'expo-image-picker';

/**
 * Request permission to access the device media library.
 * Returns true if permission is granted, false otherwise.
 */
export async function requestImagePermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Open the image picker for selecting a custom button image.
 * Returns the local image URI on success, or null if the user cancels
 * or permission is denied.
 */
export async function pickButtonImage(): Promise<string | null> {
  const granted = await requestImagePermission();
  if (!granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  return result.assets[0].uri;
}
