import { nativeModule, type BangListReply } from "@universe/shell";

const Documents = nativeModule("UniVerseDocuments");

export const readDocument = (name: string) => Documents.readDocument(name);
export const writeDocument = (name: string, contents: string) => Documents.writeDocument(name, contents);
export const saveDocument = (name: string, contents: string) => Documents.saveDocument(name, contents);
export const documentSaved = (name: string) => Documents.documentSaved(name);
export const removeDocument = (name: string) => Documents.removeDocument(name);
export const fetchBangList = (etag: string | null): Promise<BangListReply> => nativeModule("UniVerseShell").fetchBangList(etag);
