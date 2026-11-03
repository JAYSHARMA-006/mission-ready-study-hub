<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Server-function modules (`*.functions.ts` with `createServerFn`) live in `src/lib/`, never under `src/server/` — the import-protection guard blocks `src/server/**` from client bundles. `src/server/db.server.ts` stays server-only and is imported inside handler bodies via `await import("@/server/db.server")`.

