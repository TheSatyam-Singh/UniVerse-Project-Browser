import { createMemoryKeyStore } from "@universe/ai";

export type AiKeyBackend = {
  get: (providerId: string) => string;
  set: (providerId: string, apiKey: string) => void;
  delete: (providerId: string) => void;
  has: (providerId: string) => boolean;
};

let backend: AiKeyBackend = createMemoryKeyStore();

export function setAiKeyBackend(next: AiKeyBackend): void {
  backend = next;
}

export function getAiApiKey(providerId: string): string {
  return backend.get(providerId);
}

export function setAiApiKey(providerId: string, apiKey: string): void {
  backend.set(providerId, apiKey);
}

export function deleteAiApiKey(providerId: string): void {
  backend.delete(providerId);
}

export function hasAiApiKey(providerId: string): boolean {
  return backend.has(providerId);
}
