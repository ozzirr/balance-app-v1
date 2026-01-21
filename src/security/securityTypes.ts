export type SecurityConfig = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  pinHash: string | null;
  autoLockEnabled: boolean;
};

export type SecurityState = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  hasPin: boolean;
  autoLockEnabled: boolean;
};
