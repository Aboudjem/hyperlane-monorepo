import type { ProtocolTypeValue } from '@hyperlane-xyz/utils';

export interface WarpMonitorConfig {
  warpRouteId: string;
  checkFrequency: number;
  coingeckoApiKey?: string;
  registryUri?: string;
  explorerApiUrl?: string;
  explorerQueryLimit?: number;
  inventoryAddress?: string;
  inventoryAddressesByProtocol?: Partial<Record<ProtocolTypeValue, string>>;
}
