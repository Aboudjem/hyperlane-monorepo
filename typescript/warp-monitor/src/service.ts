#!/usr/bin/env node
/**
 * Hyperlane Warp Monitor Service Entry Point
 *
 * This is the main entry point for running the warp balance monitor as a standalone service
 * in Kubernetes or other container environments. It reads configuration from
 * environment variables, then starts the monitor in daemon mode.
 *
 * Environment Variables:
 * - WARP_ROUTE_ID: The warp route ID to monitor (required)
 * - CHECK_FREQUENCY: Balance check frequency in ms (default: 30000)
 * - COINGECKO_API_KEY: API key for CoinGecko price fetching (optional)
 * - LOG_LEVEL: Logging level (default: "info") - supported by pino
 * - REGISTRY_URI: Registry URI for chain metadata. Can include /tree/{commit} to pin version (default: GitHub registry)
 * - RPC_URL_<CHAIN>: Override RPC URL for a specific chain (e.g., RPC_URL_ETHEREUM, RPC_URL_ARBITRUM)
 * - EXPLORER_API_URL: Hyperlane explorer GraphQL endpoint for pending transfer liabilities (optional)
 * - EXPLORER_QUERY_LIMIT: Max pending transfer rows fetched per cycle (default: 200)
 * - INVENTORY_ADDRESS: Default address whose per-node inventory balances should be tracked (optional)
 * - INVENTORY_ADDRESSES_BY_PROTOCOL: JSON object keyed by protocol type (e.g. `{\"ethereum\":\"0x...\",\"sealevel\":\"...\"}`) (optional)
 *
 * Usage:
 *   node dist/service.js
 *   WARP_ROUTE_ID=ETH/ethereum-base COINGECKO_API_KEY=... node dist/service.js
 */
import { DEFAULT_GITHUB_REGISTRY } from '@hyperlane-xyz/registry';
import { getRegistry } from '@hyperlane-xyz/registry/fs';
import { ProtocolType, rootLogger } from '@hyperlane-xyz/utils';

import { WarpMonitor } from './monitor.js';
import { initializeLogger } from './utils.js';

function parseInventoryAddressesByProtocol():
  | Partial<Record<`${ProtocolType}`, string>>
  | undefined {
  const raw = process.env.INVENTORY_ADDRESSES_BY_PROTOCOL?.trim();
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    rootLogger.error(
      { error, raw },
      'INVENTORY_ADDRESSES_BY_PROTOCOL must be valid JSON',
    );
    process.exit(1);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    rootLogger.error(
      { raw },
      'INVENTORY_ADDRESSES_BY_PROTOCOL must be a JSON object',
    );
    process.exit(1);
  }

  const output: Partial<Record<`${ProtocolType}`, string>> = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = key.trim().toLowerCase();
    if (
      !Object.values(ProtocolType).includes(normalizedKey as ProtocolType) ||
      normalizedKey === ProtocolType.Unknown
    ) {
      rootLogger.error(
        { key },
        'INVENTORY_ADDRESSES_BY_PROTOCOL contains an unsupported protocol key',
      );
      process.exit(1);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      rootLogger.error(
        { key, value },
        'INVENTORY_ADDRESSES_BY_PROTOCOL values must be non-empty strings',
      );
      process.exit(1);
    }
    output[normalizedKey as `${ProtocolType}`] = value.trim();
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

async function main(): Promise<void> {
  const VERSION = process.env.SERVICE_VERSION || 'dev';

  // Validate required environment variables
  const warpRouteId = process.env.WARP_ROUTE_ID;
  if (!warpRouteId) {
    rootLogger.error('WARP_ROUTE_ID environment variable is required');
    process.exit(1);
  }

  // Parse optional environment variables
  let checkFrequency = 30_000;
  if (process.env.CHECK_FREQUENCY) {
    const parsed = parseInt(process.env.CHECK_FREQUENCY, 10);
    if (isNaN(parsed) || parsed <= 0) {
      rootLogger.error(
        'CHECK_FREQUENCY must be a positive number (milliseconds)',
      );
      process.exit(1);
    }
    checkFrequency = parsed;
  }

  const coingeckoApiKey = process.env.COINGECKO_API_KEY;
  const explorerApiUrl = process.env.EXPLORER_API_URL;
  const inventoryAddress = process.env.INVENTORY_ADDRESS;
  const inventoryAddressesByProtocol = parseInventoryAddressesByProtocol();

  let explorerQueryLimit = 200;
  if (process.env.EXPLORER_QUERY_LIMIT) {
    const parsed = Number(process.env.EXPLORER_QUERY_LIMIT);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      rootLogger.error('EXPLORER_QUERY_LIMIT must be a positive integer');
      process.exit(1);
    }
    explorerQueryLimit = parsed;
  }

  // Create logger (uses LOG_LEVEL environment variable for level configuration)
  const logger = await initializeLogger('warp-balance-monitor', VERSION);

  logger.info(
    {
      version: VERSION,
      warpRouteId,
      checkFrequency,
      explorerApiUrl,
      explorerQueryLimit,
      inventoryAddress,
      inventoryAddressesByProtocol,
    },
    'Starting Hyperlane Warp Balance Monitor Service',
  );

  try {
    // Initialize registry (uses env var or defaults to GitHub registry)
    // For GitHub registries, REGISTRY_URI can include /tree/{commit} to pin to a specific version
    const registryUri = process.env.REGISTRY_URI || DEFAULT_GITHUB_REGISTRY;
    const registry = getRegistry({
      registryUris: [registryUri],
      enableProxy: true,
      logger: rootLogger,
    });
    logger.info({ registryUri }, 'Initialized registry');

    // Create and start the monitor
    const monitor = new WarpMonitor(
      {
        warpRouteId,
        checkFrequency,
        coingeckoApiKey,
        registryUri,
        explorerApiUrl,
        explorerQueryLimit,
        inventoryAddress,
        inventoryAddressesByProtocol,
      },
      registry,
    );

    await monitor.start();
  } catch (error) {
    logger.error({ error }, 'Failed to start warp monitor service');
    process.exit(1);
  }
}

// Run the service
main().catch((error) => {
  rootLogger.error({ error }, 'Fatal error');
  process.exit(1);
});
