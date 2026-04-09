---
name: warp-deploy-nexus
description: Add a new warp route to the Nexus UI whitelist. Checks out the nexus branch of hyperlane-warp-ui-template, adds the warp route ID to warpRouteWhitelist.ts, and opens a PR targeting the nexus branch.
---

# Warp Deploy — Nexus Whitelist

You are adding a warp route to the Nexus UI whitelist.

## Input

The user provides:

- **Warp route ID** (required, e.g. `SOL/igra-solanamainnet`)

If not provided, ask for it now.

---

## Step 1: Confirm the warp route ID

Show the user the warp route ID you'll add and ask them to confirm before proceeding.

---

## Step 2: Prepare the branch

The `hyperlane-warp-ui-template` repo is at the same level as `hyperlane-monorepo`:

```
REPO_PATH="$(dirname $(pwd))/../hyperlane-warp-ui-template"
```

1. Ensure the repo is clean and up to date on the `nexus` branch:

```bash
cd "$REPO_PATH"
git fetch origin
git checkout nexus
git pull origin nexus
```

2. Create a new branch from `nexus`. Use the format `feat/<warp-route-id-slugified>` where the warp route ID is lowercased and `/` replaced with `-`:

```bash
git checkout -b feat/<slug>
```

---

## Step 3: Add to whitelist

The whitelist file is at:

```
$REPO_PATH/src/consts/warpRouteWhitelist.ts
```

Read the file and add the warp route ID to the `warpRouteWhitelist` array. Insert it in alphabetical order by token symbol, then by chain string. Preserve existing formatting (single quotes, trailing comma on each entry).

Example — adding `SOL/igra-solanamainnet` to an existing list:

```typescript
export const warpRouteWhitelist: Array<string> | null = [
  'SOL/igra-solanamainnet',
  'USDC/mainnet-cctp-v2-fast',
];
```

---

## Step 4: Commit and push

```bash
cd "$REPO_PATH"
git add src/consts/warpRouteWhitelist.ts
git commit -m "feat: add <WARP_ROUTE_ID> to Nexus whitelist"
git push origin <branch-name>
```

---

## Step 5: Open a PR

Target branch is `nexus` (not `main`).

```bash
gh pr create \
  --base nexus \
  --title "feat: add <WARP_ROUTE_ID> to Nexus whitelist" \
  --body "Adds \`<WARP_ROUTE_ID>\` to the Nexus UI warp route whitelist."
```

Show the user the PR URL when done.
