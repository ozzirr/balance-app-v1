import * as Crypto from "expo-crypto";

export async function hashPin(pin4: string): Promise<string> {
  if (!/^\d{4}$/.test(pin4)) {
    throw new Error("PIN deve essere composto da 4 cifre");
  }
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin4);
}
