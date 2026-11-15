import type { BrowserState } from "./store";

type StoreActions = { [K in keyof BrowserState as BrowserState[K] extends (...args: never[]) => unknown ? K : never]: BrowserState[K] };

let getStoreState: (() => BrowserState) | undefined;

export function setStoreActionStore(get: () => BrowserState) {
  getStoreState = get;
}

export const storeAction =
  <K extends keyof StoreActions>(name: K): StoreActions[K] =>
  ((...args: unknown[]) => {
    if (!getStoreState) throw new Error("storeAction called before the browser store was created");
    return (getStoreState()[name] as (...a: unknown[]) => unknown)(...args);
  }) as StoreActions[K];
