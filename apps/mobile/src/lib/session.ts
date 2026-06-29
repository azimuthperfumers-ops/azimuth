import * as SecureStore from "expo-secure-store";

const KEY = "ba_session";

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function storeToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY);
}
