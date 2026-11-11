import * as SecureStore from 'expo-secure-store';
import type { KeyStore } from '@/core/ports/keystore';

const OPTIONS: SecureStore.SecureStoreOptions = {
  // SE-3: readable only while unlocked, and not migrated through backups or to another device.
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** iOS Keychain via expo-secure-store (included in Expo Go). Values are never logged. */
export const secureStoreKeyStore: KeyStore = {
  get: (name) => SecureStore.getItemAsync(name, OPTIONS),
  set: (name, value) => SecureStore.setItemAsync(name, value, OPTIONS),
  delete: (name) => SecureStore.deleteItemAsync(name, OPTIONS),
};
