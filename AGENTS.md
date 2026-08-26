- To regenerate the legacy JavaScript SDK, run `./packages/sdk/js/script/build.ts`.
- After changing the public Protocol or Server `HttpApi`, run `bun run generate` from `packages/client`. Do not edit `src/generated` or `src/generated-effect` directly.
- Keep runtime dependencies directed from Schema to Core and Protocol, then from Core and Protocol to Server. Client runtime code may depend on Schema and Protocol but never Core or Server; `sdk-next` composes Client, Core, and Server.
- The default branch in this repo is `dev`.
- Local `main` ref may not exist; use `dev` or `origin/dev` for diffs.

## Branch Names

Use a short branch name of at most three words, separated by hyphens. Do not use slashes or type prefixes such as `feat/` or `fix/`.

Examples: `session-recovery`, `fix-scroll-state`, `regenerate-sdk`.

## Commits and PR Titles

Use conventional commit-style messages and PR titles: `type(scope): summary`.

Valid types are `feat`, `fix`, `docs`, `chore`, `refactor`, and `test`. Scopes are optional; use the affected package or area when helpful, e.g. `core`, `opencode`, `tui`, `app`, `desktop`, `sdk`, or `plugin`.

Examples: `fix(tui): simplify thinking toggle styling`, `docs: update contributing guide`, `chore(sdk): regenerate types`.

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Do not extract single-use helpers preemptively. Inline the logic at the call site unless the helper is reused, hides a genuinely complex boundary, or has a clear independent name that improves the caller.
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream
- In `src/config`, follow the existing self-export pattern at the top of the file (for example `export * as ConfigAgent from "./agent"`) when adding a new config module.
- In Effect generators, bind services to named variables before calling methods. Do not use nested service yields such as `yield* (yield* Foo.Service).bar()`.

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Imports

- Never alias imports. Do not use `import { foo as bar } from "..."` or renamed imports like `resolve as pathResolve`.
- Never use star imports. Do not use `import * as Foo from "..."` or `import type * as Foo from "..."`.
- If a namespace-style value is needed, import the module's own exported namespace by name, for example `import { Project } from "@opencode-ai/core/project"`, then reference `Project.ID`.
- Prefer dynamic imports for heavy modules that are only needed in selected code paths, especially in startup-sensitive entrypoints. Destructure dynamic import bindings near the top of the narrowest scope that needs them so they read like normal imports. Avoid inline chains such as `await import("./module").then((mod) => mod.value())` or `(await import("./module")).value()`. Keep branch-specific imports inside the branch that needs them to preserve lazy loading.

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Complex Logic

When a function has several validation branches or supporting details, make the main function read as the happy path and move supporting details into small helpers below it.

```ts
// Good
export function loadThing(input: unknown) {
  const config = requireConfig(input)
  const metadata = readMetadata(input)
  return createThing({ config, metadata })
}

function requireConfig(input: unknown) {
  ...
}
```

- Keep helpers close to the code they support, below the main export when that improves readability.
- Do not over-abstract simple expressions into many single-use helpers; extract only when it names a real concept like `requireConfig` or `readMetadata`.
- Do not return `Effect` from helpers unless they actually perform effectful work. Synchronous parsing, validation, and option building should stay synchronous.
- Prefer Effect schema helpers such as `Schema.UnknownFromJsonString` and `Schema.decodeUnknownOption` over manual `JSON.parse` wrapped in `Effect.try` when parsing untrusted JSON strings.
- Add comments for non-obvious constraints and surprising behavior, not for obvious assignments or control flow.

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

## Testing

- Avoid mocks as much as possible, you shouldn't be using globalThis.\* at all unless it's the only option.
- Test actual implementation, do not duplicate logic into tests
- Tests cannot run from repo root (guard: `do-not-run-tests-from-root`); run from package dirs like `packages/opencode`.

## Type Checking

- Always run `bun typecheck` from package directories (e.g., `packages/opencode`), never `tsc` directly.

## Build From a Repository URL

When a user asks to install from a Git repository and provides a version
name, version number, or version suffix, treat those inputs as the repository
source and custom build identifier for the same operation.

- Use the repository URL supplied by the user. Do not substitute another remote
  or assume a particular hosting provider.
- Clone the repository without specifying a branch so Git uses the repository's
  default branch. If the repository is already checked out, fetch and update
  that default branch before building.
- Read the baseline version from
  `packages/opencode/package.json` in the checked-out repository. Do not guess
  the baseline version.
- Treat a short identifier such as `AB` as a suffix and build
  `${BASE_VERSION}.AB`; for example, baseline `1.18.21` becomes
  `1.18.21.AB`.
- If the user supplies a complete custom version beginning with the baseline,
  such as `1.18.21.AB`, use it as-is and do not append it twice. Reject values
  that do not match the baseline or the allowed suffix format.
- Pass the resulting version through `OPENCODE_VERSION` and verify the built
  executable reports that exact version before claiming installation succeeded.

For a new checkout, the source step is equivalent to:

```bash
REPOSITORY_URL="https://github.com/OWNER/REPOSITORY.git"
git clone "$REPOSITORY_URL" opencode-local
cd opencode-local
```

The clone command intentionally omits `--branch`; the remote's default branch
is the build source.

## Local Production Build

Use this guide when building a customized local OpenCode executable from the
baseline. The command below follows the production build path and only builds
the current host platform.

### Prerequisites

- Run commands from the repository root.
- Use the Bun version declared in the root `package.json` (`bun@1.3.14`).
- This is a local single-platform build. Before building, inspect
  `packages/opencode/script/build.ts` and make its platform dependency installs
  target only the current host: replace each `--os="*" --cpu="*"` with
  `--os=${process.platform} --cpu=${process.arch}`. Apply this to the
  `@opentui/core`, `@parcel/watcher`, and `@ff-labs/fff-bun` install commands.
- Do not use this local-only change for a release build that produces binaries
  for multiple platforms. Restore the wildcard install arguments before such a
  build.

### Version Suffix

Ask the user for a non-empty custom version suffix before building. Do not guess
or silently choose one. The suffix must contain only ASCII letters, digits, and
hyphens, matching `^[A-Za-z0-9-]+$`.

### Formal Build

Replace `AB` with the exact suffix supplied by the user. When the user supplied
an already normalized full custom version, set `CUSTOM_VERSION` to that value
instead of appending it again:

```bash
VERSION_INPUT="AB"
BUN=(npm exec --yes bun@1.3.14 --)

BASE_VERSION="$("${BUN[@]}" -e 'const pkg = await Bun.file("packages/opencode/package.json").json(); console.log(pkg.version)')"
if [[ -z "$BASE_VERSION" ]]; then
  printf 'Could not read the baseline version\n' >&2
  exit 1
fi

if [[ "$VERSION_INPUT" == "$BASE_VERSION."* ]]; then
  CUSTOM_VERSION="$VERSION_INPUT"
  CUSTOM_SUFFIX="${VERSION_INPUT#"$BASE_VERSION."}"
else
  CUSTOM_SUFFIX="$VERSION_INPUT"
  CUSTOM_VERSION="${BASE_VERSION}.${CUSTOM_SUFFIX}"
fi

if [[ ! "$CUSTOM_SUFFIX" =~ ^[A-Za-z0-9-]+$ ]]; then
  printf 'Invalid version suffix or custom version: %s\n' "$VERSION_INPUT" >&2
  exit 1
fi

printf 'Building OpenCode %s\n' "$CUSTOM_VERSION"

BUN_NO_UPDATE_NOTIFIER=1 "${BUN[@]}" install --frozen-lockfile
OPENCODE_CHANNEL=latest OPENCODE_VERSION="$CUSTOM_VERSION" \
  BUN_NO_UPDATE_NOTIFIER=1 "${BUN[@]}" run ./packages/opencode/script/build.ts --single
```

The command preserves the production options: minification, code splitting,
embedded Web UI, and Bun compilation. Do not add `--skip-embed-web-ui`,
`--sourcemaps`, `--baseline`, or a preview channel setting. `--single` builds
only the current host platform.

The executable is written to:

```text
packages/opencode/dist/opencode-<platform>/bin/opencode
```

### Build Acceleration

- Keep Bun's package cache and `node_modules` between builds. Do not remove them
  unless dependencies need to be repaired.
- Use `bun install --frozen-lockfile` so an unchanged lockfile avoids dependency
  resolution changes and keeps the build reproducible.
- On the first local build after applying the local-only `build.ts` change, do
  not pass `--skip-install`; this installs only the current platform's native
  packages. On repeat builds, when dependencies and the lockfile have not
  changed and those packages are still available, pass `--skip-install` to
  `packages/opencode/script/build.ts`. This skips only dependency installation;
  it does not change the production bundle.
- Keep `--single` for local builds. Building all release targets is substantially
  slower and is unnecessary for a local executable.

Do not use `--skip-install` for the first build unless the platform-specific
packages installed by the build script are already available.

### Verify

The build script runs a smoke test for the current host. Also verify the final
version explicitly:

```bash
BINARY_PATHS=(packages/opencode/dist/*/bin/opencode)
if [[ ${#BINARY_PATHS[@]} -ne 1 || ! -x "${BINARY_PATHS[0]}" ]]; then
  printf 'Could not identify the current-platform OpenCode binary\n' >&2
  exit 1
fi

VERSION_OUTPUT="$("${BINARY_PATHS[0]}" --version)"
printf '%s\n' "$VERSION_OUTPUT"
if [[ "$VERSION_OUTPUT" != *"$CUSTOM_VERSION"* ]]; then
  printf 'Expected version %s, got: %s\n' "$CUSTOM_VERSION" "$VERSION_OUTPUT" >&2
  exit 1
fi
```

The version output must contain the complete custom version, such as
`1.18.21.AB`. Do not distribute the binary if it does not.

## V2 Session Core

- Keep durable prompt admission separate from model execution. `SessionV2.prompt(...)` admits one durable `session_input` row before scheduling advisory `SessionExecution.wake(sessionID)` unless `resume: false` requests admit-only behavior. The serialized runner promotes admitted inputs into visible user messages at safe boundaries.
- Reusing a Session ID adopts the existing Session. Reusing a prompt message ID reconciles an exact retry only when Session, prompt, and delivery mode match; conflicting reuse fails. Historical projected prompts lazily synthesize promoted inbox records during exact retry.
- Keep `SessionExecution` process-global and Session-ID based. Its local implementation owns the process-local Session coordinator and discovers placement through `SessionStore` plus `LocationServiceMap.get(session.location)` only when a drain starts; no layer should take a Session ID. V2 interruption targets the active process-local ownership chain for that Session; idle or missing interruption is a no-op.
- Keep `SessionRunner`, model resolution, tool registry, permissions, and filesystem Location-scoped. Omitted `Location.workspaceID` means implicit-local placement; explicit workspace identity remains reserved for future placement semantics.
- Preserve one explicit `llm.stream(request)` call per provider turn and reload projected history before durable continuation. Do not bridge through legacy `SessionPrompt.loop(...)` or delegate orchestration to an in-memory tool loop.
- Keep local Session drains process-local until clustering is implemented. `SessionRunCoordinator` joins explicit same-Session resumes, coalesces prompt wakeups, and allows different Sessions to run concurrently. Advisory wakes drain eligible durable inbox rows only; post-crash continuation recovery requires a separate explicit design before it may retry provider work. A drain has no durable identity or transcript boundary.
- Keep delivery vocabulary explicit. Prompts steer by default and promote at the next safe provider-turn boundary while the current drain requires continuation. An explicit `queue` input remains pending until the Session would otherwise become idle; promote one queued input at that boundary, then reevaluate continuation before promoting another. Promoting any new user input resets the selected agent's provider-turn allowance; a batch of steers resets it once.
- Keep EventV2 replay owner claims separate from clustered Session execution ownership.
- Keep the System Context algebra, registry, and built-ins in `src/system-context`; keep Context Source producers with their observed domains, and keep Session History selection plus Context Epoch persistence Session-owned.
