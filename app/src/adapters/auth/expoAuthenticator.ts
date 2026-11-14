import * as LocalAuthentication from 'expo-local-authentication';
import type { Authenticator } from '@/core/ports/auth';

/**
 * SE-8: Face ID or Touch ID through expo-local-authentication, with the device passcode as the fallback. Expo Go
 * cannot use Face ID itself (its usage text is not in Expo Go), so there the system asks for the passcode.
 */
export const expoAuthenticator: Authenticator = {
  async available() {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  },
  async authenticate(reason) {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
    return result.success;
  },
};
