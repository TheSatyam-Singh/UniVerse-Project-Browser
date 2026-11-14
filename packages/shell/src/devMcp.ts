import { startDevMcpServer, type DevMcpBridge, type DevMcpServerHandle } from "@universe/ai";

export type DevMcpControl = {
  applyEnabledSetting: (enabled: boolean) => void;
  stop: () => Promise<void>;
  readonly running: boolean;
  readonly port: number | null;
};

export function createDevMcpControl(bridge: DevMcpBridge, options: { port?: number } = {}): DevMcpControl {
  let handle: DevMcpServerHandle | null = null;
  return {
    applyEnabledSetting(enabled: boolean): void {
      if (!enabled) {
        void this.stop();
        return;
      }
      if (handle) return;
      handle = startDevMcpServer(bridge, { port: options.port });
    },
    async stop(): Promise<void> {
      if (!handle) return;
      const current = handle;
      handle = null;
      await current.stop();
    },
    get running(): boolean {
      return handle !== null;
    },
    get port(): number | null {
      return handle ? handle.port : null;
    },
  };
}
