/** SE-8: asks the person to prove they are the owner: Face ID, or the device passcode as the fallback. */
export interface Authenticator {
  /** True when the device has Face ID, Touch ID or at least a passcode to ask for. */
  available(): Promise<boolean>;
  /** Shows the system prompt. True only when the person passed it. */
  authenticate(reason: string): Promise<boolean>;
}
