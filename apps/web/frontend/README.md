# ProofOfWorkPay — demo

A demo of the "no proof, no pay" idea: a buyer locks money, an AI worker
produces a deliverable, a deterministic verifier runs the buyer's frozen
tests against the deliverable, and the verifier — not the buyer —
releases the funds on pass.

## Two agents

The demo runs two distinct agents against the Google Gemini API:

1. **Test-Authoring Agent** — reads the buyer's job request and proposes
   3–7 executable, deterministic test cases. (`POST /api/propose-tests`)
2. **Worker Agent** — does the actual work and produces a real
   deliverable. The output is **independent of the tests**: it is what
   the model actually returns. (`POST /api/run-job`)

A "verifier" plan is randomized on the server:
- 1–3 total attempts (max 3, weighted toward 2)
- every attempt except the last fails (1+ tests failing)
- the final attempt always passes — so the demo ends green
- the *worker's actual output* is unaffected by these pass/fail events;
  the verifier is just a visual gate

If `GEMINI_API_KEY` is not set, both agents return small hardcoded
fallback data so the UI still works end-to-end.

## Running

```bash
# 1. install
npm install                  # frontend
npm --prefix server install  # backend

# 2. set your Gemini key
cp server/.env.example server/.env
# edit server/.env and paste your key from https://aistudio.google.com/apikey

# 3. start both (Vite on :3000, API on :8787)
npm run dev
```

Then open <http://localhost:3000>.

The Vite dev server proxies `/api/*` to the backend, so the frontend
just calls `/api/run-job` etc. and doesn't need to know the backend
URL.

## API

| Method | Path                | Body                              | Returns                                  |
| ------ | ------------------- | --------------------------------- | ---------------------------------------- |
| GET    | `/api/health`       | —                                 | `{ ok, hasKey, model }`                  |
| POST   | `/api/propose-tests`| `{ jobTitle, jobRequest }`        | `{ tests, source }`                      |
| POST   | `/api/run-job`      | `{ jobTitle, jobRequest }`        | `{ tests, worker, plan }`                |
| POST   | `/api/verify`       | `{ totalTests, attempt, seed }`   | `{ attempt, totalAttempts }`             |
