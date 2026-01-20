export type SecurityConfig = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  pinHash: string | null;
};

export type SecurityState = {
  securityEnabled: boolean;
  biometryEnabled: boolean;
  hasPin: boolean;
};
