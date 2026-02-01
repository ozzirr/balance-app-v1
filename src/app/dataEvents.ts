import { DeviceEventEmitter, EmitterSubscription } from "react-native";

const DATA_RESET_EVENT = "dataReset";
const DATA_CHANGED_EVENT = "dataChanged";

export const emitDataReset = (): void => {
  DeviceEventEmitter.emit(DATA_RESET_EVENT);
};

export const onDataReset = (handler: () => void): EmitterSubscription =>
  DeviceEventEmitter.addListener(DATA_RESET_EVENT, handler);

export const emitDataChanged = (): void => {
  DeviceEventEmitter.emit(DATA_CHANGED_EVENT);
};

export const onDataChanged = (handler: () => void): EmitterSubscription =>
  DeviceEventEmitter.addListener(DATA_CHANGED_EVENT, handler);
