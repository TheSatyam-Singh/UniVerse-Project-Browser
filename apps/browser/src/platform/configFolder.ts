import { nativeModule, type ConfigFileRead } from "@universe/shell";

export type { ConfigFileRead };

const Config = nativeModule("UniVerseConfig");

export const readConfigFile = (name: string): ConfigFileRead => Config.readFile(name);
export const watchConfigFiles = (names: string[]) => Config.watch(names);
export const writeConfigSchemas = (files: Record<string, string>) => Config.writeSchemas(files);
export const onConfigChange = (listener: () => void) => Config.addListener("onChange", listener);
