<overview>
Framework-specific configuration code for agent-tail. Each section contains the exact code to add for that framework type.
</overview>

<vite_config>
**Add the agent-tail Vite plugin to the existing vite.config file.**

Import and add to plugins array:

```typescript
import { agentTail } from "agent-tail/vite"

// Add to plugins array in defineConfig:
plugins: [
  // ... existing plugins
  agentTail()
]
```

With excludes (filter noisy output):

```typescript
agentTail({
  excludes: [
    "[HMR]",
    "Download the React DevTools",
    "/^\\[vite\\]/"
  ]
})
```

With custom options:

```typescript
agentTail({
  excludes: ["[HMR]"],
  warnOnMissingGitignore: false
})
```
</vite_config>

<nextjs_config>
**Three files need modification for Next.js browser log capture.**

**1. Wrap next.config with withAgentTail:**

```typescript
// next.config.ts (or .js / .mjs)
import { withAgentTail } from "agent-tail/next"

const nextConfig = {
  // ... existing config
}

export default withAgentTail(nextConfig)
```

With excludes:

```typescript
export default withAgentTail(nextConfig, {
  excludes: ["[Fast Refresh]", "compiled successfully"]
})
```

**2. Add AgentTailScript to root layout:**

```tsx
// app/layout.tsx
import { AgentTailScript } from "agent-tail/next/script"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {process.env.NODE_ENV === "development" && <AgentTailScript />}
      </head>
      <body>{children}</body>
    </html>
  )
}
```

**Important**: Only render `AgentTailScript` in development. The `process.env.NODE_ENV` check ensures it's excluded from production builds.

If the layout already has a `<head>` tag, add the `AgentTailScript` inside it. If it doesn't, add the `<head>` tag.

**3. Create the browser log API route:**

```typescript
// app/api/__browser-logs/route.ts
export { POST } from "agent-tail/next/handler"
```

Create the directory structure `app/api/__browser-logs/` if it doesn't exist.
</nextjs_config>

<monorepo_config>
**Root-level setup for monorepos (Turborepo, Nx, pnpm workspaces).**

**1. Root package.json — initialize session before runner:**

```json
{
  "scripts": {
    "dev": "agent-tail-core init && turbo dev"
  }
}
```

For Nx:
```json
{
  "scripts": {
    "dev": "agent-tail-core init && nx run-many --target=dev"
  }
}
```

**2. Each package/app — wrap with agent-tail:**

```json
{
  "scripts": {
    "dev": "agent-tail-core wrap web --log-dir ../../tmp/logs -- vite"
  }
}
```

The `--log-dir` flag points to the root's log directory. Adjust the relative path based on package depth.

Pattern: `agent-tail-core wrap <service-name> --log-dir <path-to-root>/tmp/logs -- <original-command>`

**3. Example complete monorepo setup:**

```
monorepo/
├── package.json          # "dev": "agent-tail-core init && turbo dev"
├── apps/
│   ├── web/
│   │   └── package.json  # "dev": "agent-tail-core wrap web --log-dir ../../tmp/logs -- next dev"
│   └── api/
│       └── package.json  # "dev": "agent-tail-core wrap api --log-dir ../../tmp/logs -- node server.js"
└── tmp/logs/latest/      # All logs aggregated here
    ├── web.log
    ├── api.log
    └── combined.log
```
</monorepo_config>

<cli_config>
**CLI-only configuration for plain Node.js or non-framework projects.**

**Single service:**

```json
{
  "scripts": {
    "dev": "agent-tail-core run 'app: node server.js'"
  }
}
```

**Multiple services:**

```json
{
  "scripts": {
    "dev": "agent-tail-core run 'api: node server.js' 'worker: node worker.js'"
  }
}
```

**With excludes and muting:**

```json
{
  "scripts": {
    "dev": "agent-tail-core run --exclude '[DEBUG]' --exclude '/^TRACE/' --mute worker 'api: node server.js' 'worker: node worker.js'"
  }
}
```

**Service format**: `'<name>: <command>'` — the name becomes the log filename (e.g., `api.log`).
</cli_config>

<package_manager_detection>
Detect the package manager from lockfiles in the project root:

| Lockfile | Package Manager | Install Command |
|----------|----------------|-----------------|
| `bun.lock` or `bun.lockb` | bun | `bun add -D agent-tail agent-tail-core` |
| `pnpm-lock.yaml` | pnpm | `pnpm add -D agent-tail agent-tail-core` |
| `yarn.lock` | yarn | `yarn add -D agent-tail agent-tail-core` |
| `package-lock.json` | npm | `npm install -D agent-tail agent-tail-core` |

If no lockfile found, default to npm.
</package_manager_detection>

<gitignore_entry>
Add to `.gitignore` if not already present:

```
# agent-tail logs
tmp/
```

Check for existing `tmp/` entry before adding. Also check for `tmp` without trailing slash.
</gitignore_entry>
