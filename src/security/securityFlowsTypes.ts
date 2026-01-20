export type SecurityModalStackParamList = {
  SetPinModal: {
    mode: "create" | "change";
    onPinSet: () => void;
  };
  VerifyPinModal: {
    onVerified: () => void;
  };
};
