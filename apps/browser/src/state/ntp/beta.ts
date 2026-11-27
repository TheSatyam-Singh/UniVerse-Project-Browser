import { create } from "zustand";

type BetaState = { dismissed: boolean };

export const useBeta = create<BetaState>()(() => ({ dismissed: false }));

export function dismissBeta() {
  useBeta.setState({ dismissed: true });
}
