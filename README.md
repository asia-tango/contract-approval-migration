# Contract Approval

Migration of the legacy JSP "Contract Approval" screen to Angular 22. The UI is in Ukrainian.

## Project structure
Code lives in `src/app/`: the screen in `contracts/`, shared UI and helpers in `shared/`.
Layers: `data-access` talks HTTP (and sessionStorage), `state` holds screen state in signal stores,
`helpers` are pure functions (business rules, validation, mapping, response codes), `forms` is the form factory,
and `components` render it (only `contract-list` and `contract-card` use stores; the rest are presentational).

**Where to look**
- Approval route (committee threshold) — [`helpers/calc.ts`](src/app/contracts/helpers/calc.ts)
- Validation rules and messages — [`helpers/validation.ts`](src/app/contracts/helpers/validation.ts)
- Form fields and cross-field rules (committee comment, protocol number) — [`forms/contract-form.ts`](src/app/contracts/forms/contract-form.ts)
- Server response codes — [`helpers/api-error.ts`](src/app/contracts/helpers/api-error.ts)
- Submission and retry with the same `requestId` — [`state/submission-store.ts`](src/app/contracts/state/submission-store.ts)
- Contract card, exchange rates, status polling — [`state/contract-card-store.ts`](src/app/contracts/state/contract-card-store.ts)
- Contract list: filters, search, paging — [`state/contract-list-store.ts`](src/app/contracts/state/contract-list-store.ts)

**Stores** (provided by `contracts-page`, live as long as the screen). Dependencies go one way, Submission → Card → List:
`SubmissionStore` uses `ContractCardStore` and `ContractListStore`; `ContractCardStore` uses `ContractListStore`;
`ContractListStore` uses no other store.

**Docs** (in Ukrainian): [SOLUTION.md](SOLUTION.md) — decisions and scenarios;
[SOLUTION_POST_INTERVIEW.md](SOLUTION_POST_INTERVIEW.md) — changes after the interview;
[CLAUDE.md](CLAUDE.md) — the AI working instructions used during development.

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
