import type * as Expo from "expo-modules-core";
import { universeCoreNativeModules } from "./universecore";
import { shellNativeModules } from "./shell";

const nativeModules: Record<string, object> = { ...shellNativeModules, ...universeCoreNativeModules };
const testModules = () => (globalThis as { acTestNativeModules?: Record<string, object> }).acTestNativeModules;

export const requireNativeModule: typeof Expo.requireNativeModule = <Module,>(name: string) => (testModules()?.[name] ?? nativeModules[name] ?? {}) as Module;

export const requireOptionalNativeModule: typeof Expo.requireOptionalNativeModule = <Module,>(name: string) =>
  (testModules()?.[name] ?? nativeModules[name] ?? null) as Module | null;

export const uuid = { v4: () => crypto.randomUUID(), v5: () => crypto.randomUUID() } as unknown as typeof Expo.uuid;

export const requireNativeViewManager: typeof Expo.requireNativeViewManager = () => () => null;
