# Square One

Private feedback for volunteer Algebra 1 tutors on one session transcript about
solving quadratic equations (factoring, square roots, the quadratic formula).

---

## Quick start

Node 18 or newer. No API key is needed to run the tests; one is needed to coach
a session.

**1. Add your key.** Copy `.env.example` to `.env` and fill in
`PORTKEY_API_KEY`. The server searches upward, so `backend/.env`, `.env` in the
project root, or a `.env` up to two folders above the project all work — on boot
it prints which file it loaded.

```bash
cp .env.example .env     # then edit it
```

**2. Start the backend** (port 3001):

```bash
cd backend && npm install && npm start
```

**3. Start the frontend** (port 5173), in a second terminal:

```bash
cd frontend && npm install && npm run dev
```

**4. Open http://localhost:5173** and sign in with the test account, which is
created automatically on first boot:

```
testtest@gmail.com / testpassword
```

**5. Try it.** Open the **Type it out** tab and press **Load example**, or paste
one of the included sample transcripts from `samples/`:

| File | What it shows |
|------|---------------|
| `1-excellent.txt` | Scores 5.0; three coaching strengths |
| `2-good.txt` | Scores 2.6; contains a phone number and email, so scrubbing is visible |
| `3-poor.txt` | Scores 1.2; contains four maths errors for the checker to catch |
| `4-safeguarding.txt` | The pipeline halts — no scores, no coaching |
| `2-good.pdf` | The same session as a PDF, for the **Upload PDF** tab |

The test account is a coordinator, so the **Coordinator digest** tab is visible.
It needs a few sessions before it shows anything — `cd backend && npm run seed`
fills it with demo data, and `npm run seed -- --clear` removes it again.

**Verify the install without spending any tokens:**

```bash
cd backend && npm test
```

83 unit tests, no API key required.

---

## How it is put together

- `/frontend` — Vite + React (JavaScript). The browser only ever calls `/api/*`.
- `/backend` — Node + Express (ES modules). Holds the Portkey key and talks to
  **GPT-6-luna** through the Portkey gateway.

The Vite dev server proxies `/api` to Express on port 3001, so the API key never
reaches the browser.

The interface is set in a heavy slab serif (Bitter, falling back to Zilla Slab
and Roboto Slab), loaded from Google Fonts in `frontend/index.html`. The chalk colours do the signposting: yellow for
headings, blue for section labels, pink for anything that needs the tutor's
attention. All of it lives in `frontend/src/styles.css`.

A finished run opens with **Scores at a glance** — all five category scores in
one strip directly under the transcript box, so the result is visible without
scrolling. Each one links down to its full rubric row, where the evidence is.

Below that, the run is laid out in two columns so it fits in far less scrolling.
The left column carries what you read — the coaching note, the rubric, and any
maths flags. The right column carries what you glance at: the tutor's standing
record, the overall score, their progress, the counts and the token cost. The
scrubbed transcript sits at the end of the left column, collapsed by default,
because it is reference rather than feedback — expanding it adds about 1,300
pixels that most runs do not need.

Under 1100px the two columns stack and the right-hand cards go back to their
full-width layouts.

## Getting a transcript in

Two tabs at the top of the page:

- **Upload PDF** — the PDF is read in the browser with `pdfjs-dist`; the file
  itself never reaches the server. The extracted text is shown in an editable
  box so the tutor can fix anything that came out wrong before sending. Scanned
  or photographed PDFs have no text layer and are rejected with a message
  saying so.
- **Type it out** — paste or type the session directly.

Either way, only the text the tutor has seen is posted to `/api/coach`, and the
scrub stage runs on it before any model call.

## Pipeline — `POST /api/coach`

The response is **newline-delimited JSON**, streamed as the run progresses:
one `{"type":"stage","stage":"..."}` each time a stage the UI shows finishes,
then one `{"type":"result","result":{...}}`. A run takes the better part of a
minute, so without this the progress pills would sit on the first stage and
then all complete at once.

Validation failures (too short, too long) and auth failures answer before the
stream opens, as ordinary JSON with a status code. A failure *after* the stream
has opened arrives as `{"type":"error","error":"..."}`, because the headers have
already gone out.


Runs in this order, one file per stage in `/backend/pipeline`:

1. **scrub** — strips PII with regex rules and a name list, before any model call.
2. **injectionCheck** — flags instruction-like text hidden in the transcript.
3. **safeguarding** — a phrase list plus a model check; a child-welfare
   disclosure stops the pipeline and no coaching is produced.
4. **score** — GPT-6-luna scores five rubric dimensions, quotes evidence for
   each, and reports how confident it is in each score.
5. **verifyEvidence** — the Verifier, in two passes:
   - *exactness*: every quote must be an exact substring of the scrubbed
     transcript. Quotes that are not are dropped. Pure and unit-tested.
   - *support*: a second model pass asks whether each surviving quote actually
     shows the thing it was cited for. A quote that is real but does not back
     its score is shown to the tutor and marked, not hidden.
   The formal teaching score — the mean of the sub-scores — is computed here,
   in arithmetic rather than by a model, so a tutor can reconstruct it from the
   rows above it. Overall confidence is the *lowest* of the rows, and any
   unsupported quote forces it to "low".
6. **coach** — GPT-6-luna writes one strength, one focus, one phrase to try,
   and is given only quotes that passed both verifier passes.
7. **usage** — totals tokens and cost across every model call in the request.
8. **growthTracker** — records the scores against a tutor's name, works out
   whether last session's focus moved, and picks the next one. Arithmetic, not
   a model call. Runs before the coach so the note can speak to the progress.

There is deliberately **no mathematical accuracy dimension**. A maths slip must
not move a teaching score, so the maths checker below is kept entirely separate
from the rubric and the overall number.

## Maths checker (flag only)

Runs in parallel with the scorer and feeds nothing into it.

The split is the whole design: **GPT-6-luna only extracts claims**, and plain
JavaScript decides whether each one is true. The model is never asked to judge
its own subject — the same division of labour as the evidence verifier.

Three claim shapes are extracted (`backend/pipeline/mathCheck.js`):

- `equivalence` — one expression rewritten as another (factorising, expanding)
- `roots` — the stated solutions of an equation
- `arithmetic` — a plain numeric claim

They are checked by `backend/expression.js`, a ~200-line evaluator supporting
numbers, one variable, `+ - * / ^`, brackets, unary minus and implicit
multiplication. Equivalence is decided by sampling both sides at a spread of
values rather than by rearranging symbols, which lets one mechanism cover
factorising, expanding and simplifying. No CAS, so no new dependency.

Three verdicts, two of which are shown:

- **incorrect** — the claim is false
- **incomplete** — true as far as it goes, but a solution is missing
- *correct* — checked and fine, not shown

The middle one matters. "x² = 49, so x = 7" is not wrong — 7 really is a
solution — it is incomplete. Calling it an error would be unfair to the tutor;
calling it correct would miss the teaching point.

### What it will not do

- **It never flags what it cannot read.** `equivalent()` returns `null`, not
  `false`, when neither side parses, and an unparsed claim produces silence.
  A false accusation aimed at a volunteer is worse than a missed error.
- **It never scores.** Flags appear in their own card, below the rubric, with
  the note that they did not affect any score.
- **It does not claim coverage it lacks.** Spoken maths ("you set them both to
  zero") cannot be turned into an equation, so the card reports how many
  statements were checked rather than implying the session was verified.

## Accounts

Everything behind the sign-in gate belongs to one account. Sessions are
recorded against the signed-in user id, never a name typed into a box, so one
tutor cannot file a session under someone else's name.

- Passwords: scrypt with a per-user random salt, compared in constant time.
  Built on `node:crypto` — no bcrypt, no JWT library, within the dependency
  limit.
- Sessions: an opaque 32-byte token stored server-side and sent as a Bearer
  header. Logging out deletes it, so the token stops working everywhere.
- Changing email or password always requires the current password; holding a
  session is not enough to take an account over.

**No email is ever sent.** There is no verification step and no password reset,
which is stated on the sign-in screen rather than left to be discovered.

**Roles.** New accounts are `tutor`. The coordinator digest shows every tutor's
scores, so it requires a `coordinator` account and the tab is hidden otherwise.

### Test account

Created automatically at boot if missing:

```
testtest@gmail.com / testpassword
```

It is a coordinator, so the digest is visible while testing.

### What is still missing

Rate limiting on sign-in, password reset, and email verification. Fine for a
single trusted machine; not enough for a public deployment.

## Growth tracking

Recorded against the signed-in account.

**What is stored** (`backend/data/growth.json`, gitignored): per session, the
date, the overall score, each dimension's score, the model's confidence,
whether the quote stood up, and which dimension was set as the focus.

**What is never stored**: the transcript, or any quote from it. Quotes are
verbatim student and tutor speech, so keeping them would undo the scrub stage.
`toRecord()` in `backend/storage.js` is the only writer and copies fields one
by one, so a new field on the pipeline result cannot leak in by accident.
There is a test asserting no transcript text survives it.

The next focus is the weakest dimension, ties broken by rubric order. If the
previous focus is still the weakest it stays the focus — one session is rarely
enough to shift a habit. When nothing is below 4/5 no focus is set, rather than
inventing a weakness.

**This is not sign-in.** The name is a label, not an account: anyone using the
same label on the same server sees the same history. It is built for a trusted
staff machine, not a shared one.

## Coordinator digest — `GET /api/digest?days=7`

One summary across every tutor's stored scores, for whoever runs the campus.

- **Needs a check-in** — a tutor is flagged when their latest session is at or
  below 2.5/5, their scores have fallen across three consecutive sessions, the
  same focus has been set three sessions running, or they have recorded nothing
  this period. Every reason is listed individually rather than summarised, so a
  director can disagree with any one of them.
- **What's working** — the strongest dimensions team-wide, plus any tutor whose
  previous focus actually moved.
- **Across the team** — average score per dimension, weakest first, with the
  sample size each average rests on.
- **Suggested PD theme** — drawn from the weakest dimension. The arithmetic is
  done in `backend/digest.js` and one model call turns it into a title, a
  reason and three things a 45-minute session could do.

The digest sees only scores. Since no transcript is ever stored, there is no
student data in it at all.

### PD theme history

Each digest's proposed theme is kept, one entry per ISO week, so reopening the
tab refreshes that week rather than adding another. Stored with it: the
dimension it came from and that dimension's average at the time.

That last part is the point — the next digest compares the stored average with
the current one and reports **"Did the last theme land?"**: improved, held
steady, or slipped back. It is the only honest read on whether a PD session
changed anything.

A past theme list sits below, oldest entries first.

### Demo data

The digest needs a few tutors' history before it shows anything. To fill it:

```bash
cd backend && npm run seed
```

That writes nine sessions across four invented tutors, each shaped to trip one
of the flagging rules — one improving, one declining, one stuck on the same
focus, one gone quiet. Scores only, no model calls, no API key needed.

To remove them again:

```bash
cd backend && npm run seed -- --clear
```

Clearing matches on the `seed_` session id prefix, not on tutor names, so a
real tutor who happens to share a name with a demo one keeps their records.

## Configuration

### Where the key can live

The server searches upward for a `.env` containing `PORTKEY_API_KEY`, and uses
the first one it finds:

```
backend/.env
<project>/.env
<one folder above the project>/.env     <- the course convention
<two folders above the project>/.env
```

A real environment variable beats every file. On boot the server prints which
file it loaded, or lists everywhere it looked if it found none:

```
Square One server listening on http://localhost:3001 (model: gpt-6-luna)
Loaded environment from: /Users/you/Desktop/AI/.env
```

Without a key the app still starts and accounts still work — only the coaching
calls fail, with a message naming the paths that were searched. `npm test`
needs no key at all: every stage that is unit-tested is pure.

### Settings

`backend/.env` (gitignored, never shipped to the browser):

```
PORTKEY_API_KEY=...
PORTKEY_BASE_URL=https://api.portkey.ai/v1
MODEL_NAME=gpt-6-luna
PORT=3001
PRICE_INPUT_PER_MTOK=1.25
PRICE_OUTPUT_PER_MTOK=10.00
```

Backend dependencies are limited to `express`, `cors`, `dotenv`, and the OpenAI
SDK (used as the Portkey client); password hashing and session tokens use
`node:crypto`. The frontend uses React, Vite, and `pdfjs-dist` for reading
uploaded PDFs in the browser.

## Tokens and cost on screen

Every coached run ends with a **Tokens and cost** card: the total, the
input/cached/fresh/output split, the dollar cost, what caching saved, and a
per-agent table showing exactly which model call spent what. Stages that never
reach the model — scrubbing, the injection check, the exact-quote check — cost
nothing and are listed as such.

## Prompt caching

The model caches a call's static prefix, but only when that prefix is long
enough — measured on this setup, a 141-token prompt is never cached and caching
engages somewhere above ~1,000 tokens.

So the rubric, the score anchors and the coaching tone examples all live in the
**system** prompt, which never changes between sessions, and only the
transcript goes in the user message. That makes the prefix both long enough to
cache and genuinely more useful than the thin prompts it replaced.

Measured across four different sessions: **2,260 tokens cached per session**,
saving about **$0.0025 a session** — roughly 16% of input cost. The safeguarding
and verifier prompts are still too short to cache, and are left alone rather
than padded.

`usage` reports `cachedTokens` and `savedUsd` alongside the cost, so the saving
is visible rather than asserted.
