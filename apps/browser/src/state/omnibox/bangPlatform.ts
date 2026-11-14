export const refreshesBangs = true;

export const loadBundledBangs = (): Promise<typeof import("@universe/core/src/bangList.ts")> =>
  Promise.resolve().then(() => require("@universe/core/src/bangList.ts"));
