# Sample transcripts

Three AI-written transcripts of an Algebra 1 session on quadratics, for trying
the app without using a real student's words. Paste one into the **Type it out**
tab, or upload `2-good.pdf` under **Upload PDF**.

Each is written to exercise a different part of the pipeline. Scores below are
from real runs; the model will vary a little between runs, but the ordering and
the maths flags are stable.

| File | Overall | What it demonstrates |
|------|---------|----------------------|
| `1-excellent.txt` | 5.0 / 5 — Consistently strong | Three coaching strengths, 5/5 evidence verified, two representations |
| `2-good.txt` | 2.6 / 5 — Mixed | Two strengths, PII scrubbing, a quote that fails the support check |
| `3-poor.txt` | 1.2 / 5 — Needs support | One strength, and four maths errors caught |
| `4-safeguarding.txt` | — pipeline halts | A child's disclosure stops the run before any scoring |
| `2-good.pdf` | — | The same transcript as a PDF, for the upload path |

## What to look for in each

### 1-excellent.txt
The tutor asks rather than tells, asks for reasoning even when the student is
right, lets the student find their own error, praises the method rather than the
person, and moves between symbols, a number line and a sketch of the parabola.
All the mathematics is correct, so the maths card stays quiet.

**Good screenshot for:** the coaching note with three strengths; a rubric scoring
5 across the board with every quote verified.

### 2-good.txt
Realistic middle ground: some genuine questioning, but the tutor supplies the
step whenever the student pauses, praise is generic, and the whole session stays
in symbols. It also contains a phone number and an email address, so the
**Details removed** figure is non-zero and the scrubbed transcript visibly shows
`[PHONE]` and `[EMAIL]`.

**Good screenshot for:** PII scrubbing; a mid-range rubric; two strengths.

### 3-poor.txt
The tutor lectures, never asks for reasoning, tells the student they are "a smart
kid" rather than naming anything they did, and makes four mathematical mistakes:

| Line | Problem | Verdict |
|------|---------|---------|
| `(x + 2)(x + 6)` for `x² + 7x + 12` | Those factors give `x² + 8x + 12` | **incorrect** |
| `x = -2 and x = -6` | Neither solves `x² + 7x + 12 = 0` | **incorrect** |
| `x² = 36 … so x = 6` | True, but `-6` is missing | **incomplete** |
| `7 times 8 is 54` | It is 56 | **incorrect** |

Two later factorisations in the same transcript are correct and are *not*
flagged, which shows the checker is discriminating rather than just complaining.

**Good screenshot for:** the "Worth checking" card; the difference between
*incorrect* and *incomplete*; a low rubric with a single honest strength.

### 4-safeguarding.txt
A perfectly ordinary session — the student is getting every question right —
until one line, where they mention being hit at home. Everything after it goes
back to the mathematics, exactly as it often would.

Running this produces **no scores and no coaching note**. The pipeline stops
after the scrub stage and returns escalation guidance instead: contact the
programme's safeguarding lead today, share what the student said in their own
words, and write down the date and time. The progress pills show only
**Scrubbed** as complete.

It is also free. The phrase list catches this one before any model call, so the
run costs **$0.0000 and 0 tokens** — the halt does not depend on the model being
available or on anyone paying for it.

**Good screenshot for:** the safeguarding banner; the pipeline stopping after one
stage; the flagged line tagged in the transcript.

> Note: this transcript is invented. Nothing in it describes a real child.

## Notes

- The names in these transcripts are invented and are removed by the scrubber
  before any model call, which is why the names you typed do not appear in the
  "What the model read" panel.
- To see progress tracking, run two of them while signed in to the same account:
  the second run compares against the first and sets the next focus.
