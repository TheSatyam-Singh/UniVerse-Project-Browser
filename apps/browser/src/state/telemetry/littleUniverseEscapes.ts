export type EscapePressedIn = "page" | "window" | "blankBar";

const none = (): Record<EscapePressedIn, number> => ({ page: 0, window: 0, blankBar: 0 });

let closes = none();

export function noteLittleUniverseEscapeClose(pressedIn: EscapePressedIn) {
  closes[pressedIn]++;
}

export function takeLittleUniverseEscapeCloses() {
  const taken = closes;
  closes = none();
  return {
    little_universe_escape_closes: taken.page,
    little_universe_escape_closes_unfocused: taken.window,
    little_universe_escape_closes_blank: taken.blankBar,
  };
}
