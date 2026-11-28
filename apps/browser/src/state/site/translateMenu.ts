import type { ChoiceItem } from "../app/menuChoice";
import { menuSections } from "../app/menuSections";

export type TranslateMenuState = {
  translated: boolean;
  target: string;
  languages: { id: string; name: string; current: boolean }[];
  neverTranslate: boolean | null;
  alwaysTranslate: { language: string; name: string; on: boolean } | null;
};

export type TranslateMenuItem = ChoiceItem<{ language: string }, "original" | "translate" | "choose" | "never" | "always">;

export function translateMenuItems({ translated, target, languages, neverTranslate, alwaysTranslate }: TranslateMenuState): TranslateMenuItem[] {
  return menuSections<TranslateMenuItem>(
    [
      translated ? { id: "original" as const, title: "Show Original", symbol: "arrow.uturn.backward" } : { id: "translate" as const, title: `Translate to ${target}`, symbol: "translate" },
      languages.length > 0 && {
        id: "choose" as const,
        title: "Choose Another Language",
        symbol: "globe",
        children: languages.map((l) => ({ value: { language: l.id }, title: l.name, checked: l.current })),
      },
    ],
    [
      alwaysTranslate && { id: "always" as const, title: `Always Translate ${alwaysTranslate.name}`, checked: alwaysTranslate.on },
      neverTranslate !== null && { id: "never" as const, title: "Never Translate This Site", checked: neverTranslate },
    ],
  );
}
