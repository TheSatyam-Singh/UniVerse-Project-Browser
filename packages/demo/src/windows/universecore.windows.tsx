export * from "../shims/universecore";
export { WebView } from "./WebView.windows";
import { installWindowsEngineBridge } from "./engineBridge";

installWindowsEngineBridge();
