import { nativeModule } from "@universe/shell";

export { completeInline, translation } from "@universe/shell";

export const startDictation = () => nativeModule("UniVerseShell").startDictation();
