import { domainModule } from "./engine/call";
import type { CardInput } from "./autofill";
import type { SwipeModule } from "./swipe";

type Secret = Promise<string>;

export type UniVerseCoreNativeModules = {
  UniVerseTabs: {
    prepareTransfer(tabId: string): void;
    releaseTransfer(tabId: string): void;
    claimLaunchTab(tabId: string, url: string, profile: string): void;
    revealTab(tabId: string): void;
    dropTabReveals(tabId: string): void;
    revealOffered(adoptId: string, overTabId: string): void;
    discardOffered(adoptId: string): Promise<boolean>;
  };
  UniVerseEngine: { inputIdleSeconds(): number };
  UniVersePasswords: {
    save(profile: string, origin: string, username: string, password: string): Secret;
    update(profile: string, origin: string, username: string, newUsername: string | null, newPassword: string | null): Secret;
  };
  UniVerseAutofill: { saveCard(profile: string, card: CardInput, number: string | null): Secret };
  UniVerseSwipe: SwipeModule;
};

const domainOfModule = (name: string) => `${name[8]!.toLowerCase()}${name.slice(9)}`;

export const nativeModule = <Name extends keyof UniVerseCoreNativeModules>(name: Name) =>
  domainModule<UniVerseCoreNativeModules[Name]>(domainOfModule(name));
