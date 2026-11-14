import { universeCoreNativeModules } from "../../../test-native/universecore.ts";
import { shellNativeModules } from "../../../test-native/shell.ts";

export const escapeCapture = [];
const recordEscape = (on) => (escapeCapture.push(on), Promise.resolve());
const withEscape = (module) => module && { ...module, setDragEscapeCapture: recordEscape };

globalThis.acTestNativeModules = {
  ...globalThis.acTestNativeModules,
  ArdiaWindows: { ...universeCoreNativeModules.ArdiaWindows, ...shellNativeModules.ArdiaWindows },
  ...(shellNativeModules.ArdiaFocus ? { ArdiaFocus: withEscape(shellNativeModules.ArdiaFocus) } : {}),
  ArdiaShell: shellNativeModules.ArdiaShell.setDragEscapeCapture ? withEscape(shellNativeModules.ArdiaShell) : shellNativeModules.ArdiaShell,
};
