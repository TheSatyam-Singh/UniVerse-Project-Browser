import { universeCoreNativeModules } from "../../../test-native/universecore.ts";
import { shellNativeModules } from "../../../test-native/shell.ts";

export const escapeCapture = [];
const recordEscape = (on) => (escapeCapture.push(on), Promise.resolve());
const withEscape = (module) => module && { ...module, setDragEscapeCapture: recordEscape };

globalThis.acTestNativeModules = {
  ...globalThis.acTestNativeModules,
  UniVerseWindows: { ...universeCoreNativeModules.UniVerseWindows, ...shellNativeModules.UniVerseWindows },
  ...(shellNativeModules.UniVerseFocus ? { UniVerseFocus: withEscape(shellNativeModules.UniVerseFocus) } : {}),
  UniVerseShell: shellNativeModules.UniVerseShell.setDragEscapeCapture ? withEscape(shellNativeModules.UniVerseShell) : shellNativeModules.UniVerseShell,
};
