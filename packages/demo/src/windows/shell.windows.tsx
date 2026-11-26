export * from "../shims/shell";
import { provideNativeModule } from "../shims/expo-modules-core";

const WINDOWS_SYSTEM_INFO = {
  appName: "UniVerse Project Browser",
  appVersion: "windows",
  appBuild: "windows",
  bundleId: "dev.universe.windows",
  configuration: "Release",
  osVersion: "windows",
  osBuild: "",
  arch: "x64",
  model: "windows",
  memoryGB: 8,
  locale: typeof navigator === "undefined" ? "en-US" : navigator.language,
};

provideNativeModule("ArdiaApp", { systemInfo: () => WINDOWS_SYSTEM_INFO });
provideNativeModule("ArdiaAppWindows", { windowCornerRadius: () => 8 });
