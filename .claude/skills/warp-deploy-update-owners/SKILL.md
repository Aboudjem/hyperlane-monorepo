---
name: warp-deploy-update-owners
description: Post-deployment ownership transfer and registry PR for a warp route. Transfers ownership from the temporary deployer address to real owners, adds CoinGecko ID, commits, and opens a registry PR. Run after warp-deploy-init completes deployment.
---

# Warp Route Deploy — Update Owners & Finalize

You are transferring ownership of a newly deployed warp route and opening the registry PR.

## Input

The user provides (or you have from a prior `/warp-deploy-init` session):

- **Warp route ID** (e.g. `RISE/bsc-ethereum`)
- **Registry path** (defaults to `$(dirname $(pwd))/../hyperlane-registry`)
- **Key env var(s)** used during deployment (e.g. `HYP_KEY`, `HYP_KEY_ETHEREUM`)
- **Real owner addresses per chain** (from the Linear ticket or from the prior session)

If any of the above are missing, ask the user before proceeding.

---

## Step 10: Transfer Ownership to Real Owners (deployer mode only)

**Skip this step entirely if the deploy did NOT use a deployer address as temporary owner** (i.e., the deploy.yaml already has real owner addresses).

If the deploy used a deployer address, the deployed contracts are currently owned by the deployer. This step transfers ownership to the real owners from the ticket.

### 10a: Confirm Real Owners

Show the user the real owner addresses extracted from the ticket. Present them clearly per chain, e.g.:

```
Real owners from ticket:
  ethereum:  0xSafe...
  arbitrum:  0xICA... (ICA address — confirm this has been deployed)
  base:      0xICA...
```

Ask the user:

> **Are these the correct real owner addresses?** Type `yes` to proceed, or provide corrections.

Wait for confirmation before proceeding. If the user provides corrections, update your record of owner addresses accordingly.

### 10b: Update deploy.yaml with Real Owners

Replace every occurrence of the deployer address in the deploy.yaml with the correct real owner per chain. Update `owner` fields at the chain level and inside any `tokenFee` blocks.

Write the updated deploy.yaml back to the registry path. Show the user the diff (old → new owners).

### 10c: Build and Run Warp Apply

Assemble the warp apply command. Use the same key environment variable(s) from deployment. Run from `typescript/cli`:

```bash
cd typescript/cli

pnpm hyperlane warp apply \
  --registry $REGISTRY_PATH \
  --key.ethereum $MY_ETH_KEY_VAR \
  [--key.sealevel $MY_SOL_KEY_VAR]  # only if sealevel chains present
  [--key.cosmos $MY_COSMOS_KEY_VAR]  # only if cosmos chains present
  -w <TOKEN>/<chain1>-<chain2>
```

Show the user the exact command and ask:

> **Ready to run warp apply to transfer ownership?** Type `yes` to execute, or `no` to run manually.

If the user confirms, run it with a 10-minute timeout (600000ms). Show the full output on completion.

**On failure:** show the error and stop. Do not proceed to Step 11. Common issues:

- Deployer key no longer has funds → top up and retry
- ICA address not yet deployed → deploy ICA first, then retry

### 10d: Verify Ownership with Warp Read

After warp apply completes, run warp read to confirm all ownership transfers took effect:

```bash
cd /path/to/hyperlane-monorepo/typescript/cli

pnpm hyperlane warp read \
  --registry $REGISTRY_PATH \
  -w <TOKEN>/<chain1>-<chain2>
```

Show the user the output and verify that each chain's `owner` matches the expected real owner address. Flag any discrepancies.

---

## Step 11: Add CoinGecko ID and Finalize Config

### 11a: Look Up CoinGecko ID

Search CoinGecko for the token symbol/name in the registry core-config.yaml.

If found, add `coinGeckoId: <api-id>` to each **non-synthetic** token entry in the config.yaml (i.e., `collateral` and `native` entries only — NOT `synthetic` entries).

Update the config.yaml file with the coinGeckoId field added after `addressOrDenom` (or at the end of each matching token block, before `connections`).

If not found on CoinGecko, note this to the user and skip.

### 11b: Show Final Config for Review

Show the user the complete final content of `<chains>-config.yaml`. Ask:

> **Does this config.yaml look correct?** Type `yes` to proceed, or describe any changes needed.

Do not proceed to Step 12 until the user confirms.

---

## Step 12: Commit, Push, and Open Registry PR

### 12a: Check Registry Git Status

```bash
cd $REGISTRY_PATH && git status
```

Show the user the list of changed/new files. There should be at minimum:

- `deployments/warp_routes/<TOKEN>/<chains>-deploy.yaml`
- `deployments/warp_routes/<TOKEN>/<chains>-config.yaml`

### 12b: Write Changeset

Write a changeset file directly to `$REGISTRY_PATH/.changeset/` — do NOT run the interactive CLI. Use a filename derived from the warp route (e.g. `add-ikas-ethereum-igra.md`):

```markdown
---
'@hyperlane-xyz/registry': minor
---

added <token-name> warp route on <chain1> and <chain2>
```

Follow the changeset style from CLAUDE.md: past tense, lowercase, concise. The bump is always `minor` for new warp routes.

### 12c: Create a Branch and Commit

Check out a new branch named after the warp route ID (replace `/` with `-`):

```bash
cd $REGISTRY_PATH
git checkout -b feat/<token-chains>
git add deployments/warp_routes/<TOKEN>/
git add .changeset/
git commit -m "feat: add <TOKEN>/<chain1>-<chain2> warp route"
```

### 12d: Push and Open PR

Push the branch and open a PR on GitHub:

```bash
cd $REGISTRY_PATH
git push -u origin HEAD
gh pr create \
  --title "feat: add <TOKEN>/<chain1>-<chain2> warp route" \
  --body "$(cat <<'EOF'
## Summary

Adds the `<TOKEN>/<chain1>-<chain2>` warp route.

| Field | Value |
| ----- | ----- |
| **Token** | <token-name> (<TOKEN>) |
| **Route type** | <e.g. native → synthetic, collateral → synthetic> |
| **Chains** | <chain1> (<type>), <chain2> (<type>), ... |
| **Decimals** | <decimals> |
| **Warp fee** | <fee in bps, or "none"> |
| **Owners** | <chain>: `<owner-address>`, ... |

### Contracts deployed

| Chain | Contract | Address |
| ----- | -------- | ------- |
| <chain> | <HypNative / HypSynthetic / HypERC20Collateral / ...> | `<address>` |
| ... | ... | ... |

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Fill in the PR body with real values from the deployment:

- Route type: describe the chain types (e.g. "igra (native) → ethereum (synthetic)")
- Contracts: list each deployed contract address from the config.yaml `addressOrDenom` fields
- Owners: list per-chain real owner addresses from the final deploy.yaml

Show the user the PR URL when done.

After showing the PR URL, tell the user:

> **Once this PR is merged**, run `/warp-deploy-register-route` to add the warp route ID to the monorepo and update `.registryrc`.

---

## Notes

- The registry path is `$(dirname $(pwd))/../hyperlane-registry` relative to the monorepo root. The hyperlane-registry repo is expected to be cloned at the same level as hyperlane-monorepo.
- If the ticket has links to token contracts on block explorers, use those addresses
- `owner` is typically an Abacus Works Safe address specified in the ticket; for non-Ethereum chains managed via ICA, use `<ICA_ADDRESS>` as placeholder
