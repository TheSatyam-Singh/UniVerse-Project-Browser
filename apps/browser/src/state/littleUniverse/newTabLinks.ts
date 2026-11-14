import { setLittleUniverseOpensNewTabLinks } from "../../platform/pageOptions";
import { useBrowser } from "../browser/store";

let started = false;

export function startLittleUniverseNewTabLinks() {
  if (started) return;
  started = true;
  let sent: boolean | null = null;
  const sync = () => {
    const enabled = !!useBrowser.getState().settings.littleUniverseOpensNewTabLinks;
    if (enabled !== sent) void setLittleUniverseOpensNewTabLinks((sent = enabled));
  };
  sync();
  useBrowser.subscribe(sync);
}
