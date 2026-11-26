import { nativeModule } from "@universe/shell";

const Shell = nativeModule("UniVerseShell");

export const copyText = (text: string) => Shell.copyText(text);
export const readText = () => Shell.readText();
