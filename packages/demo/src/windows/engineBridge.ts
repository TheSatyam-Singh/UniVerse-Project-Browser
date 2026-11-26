import { emitNativeEvent, provideNativeModule } from "../shims/expo-modules-core";
import { hostObject, isWindowsShell, onShellMessage } from "./hostObject";

const ENGINE_DOMAINS = [
  "autofill",
  "bookmarks",
  "downloads",
  "engine",
  "extensions",
  "favicons",
  "history",
  "media",
  "passwords",
  "permissions",
  "profiles",
  "search",
  "sites",
  "tabs",
  "windows",
] as const;

const capitalized = (domain: string) => `${domain[0]!.toUpperCase()}${domain.slice(1)}`;

let installed = false;

export function installWindowsEngineBridge(): boolean {
  if (installed) return true;
  if (!isWindowsShell()) return false;
  const host = hostObject();
  if (!host) return false;
  for (const domain of ENGINE_DOMAINS) {
    provideNativeModule(`Ardia${capitalized(domain)}`, {
      call: (name: string, profile: string, args: string) => host.engineCall(domain, name, profile, args),
    });
  }
  onShellMessage((message) => {
    if (message.kind !== "engine-event") return;
    emitNativeEvent(`Ardia${capitalized(message.domain)}`, message.domain, { name: message.name, data: message.data });
  });
  installed = true;
  return true;
}
