import { useEffect, useState } from "react";
import { copySetupCode } from "../../../apps/browser/src/state/presets/actions";
import { startCustomize, watchCustomize, type CustomizeState } from "./customizeFlow";

export function Customize() {
  const [state, setState] = useState<CustomizeState>({ active: false, code: null });
  const [copied, setCopied] = useState(false);
  useEffect(() => watchCustomize(setState), []);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="universe-customize">
      <button type="button" className="universe-customize-button" disabled={state.active} onMouseDown={(e) => e.preventDefault()} onClick={startCustomize}>
        {state.code ? "Customize again" : "Customize it"}
      </button>
      {state.code ? (
        <>
          <code className="universe-customize-code">{state.code}</code>
          <button
            type="button"
            className="universe-customize-copy"
            onClick={() => {
              copySetupCode(state.code!);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </>
      ) : null}
    </div>
  );
}
