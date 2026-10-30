# Contract Approval

Migration of the legacy JSP "Contract Approval" screen to Angular 22. The UI is in Ukrainian.

## Requirements
Node.js 22.22+ or 24.15+.

## Run
```bash
npm ci
npm start    # http://localhost:4200
npm test -- --watch=false    # unit tests, single run
```

The mock backend runs inside the app, so no server is needed. Requests are logged to the browser console (`[mock] → …`), not the Network tab.

## How to check
- URL params: `?chaos=off` (no random errors), `?chaos=timeout` (slow approval response — triggers the 5 s client timeout), `?role=viewer` (read-only user).
- Browser console: `mockBackend.stats()` shows the approval requests actually created; `mockBackend.reset()` restores the initial data.

## Highlights
- No duplicate approval requests on timeout or retry: the same `requestId` is reused, so the server returns the original result instead of creating a second request.
- An unfinished submission is recovered after a page reload.
- Only the latest response is shown; background requests are cancelled when no longer needed.

## Stack
Angular 22 (standalone, zoneless), signals + RxJS, Angular Material, Vitest. No state manager.

Design decisions, trade-offs and scenarios — see [SOLUTION.md](SOLUTION.md) (in Ukrainian).
