import { nativeModule } from "@universe/shell";

export { completeInline, translation } from "@universe/shell";

export const startDictation = () => nativeModule("ArdiaShell").startDictation();
