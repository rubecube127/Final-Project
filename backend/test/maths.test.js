// Tests for the maths checker's arithmetic. The claim EXTRACTION is a model
// call and is not tested here; everything that decides true or false is.
//
// The property that matters most: an expression this evaluator cannot read
// must never produce a flag. A false accusation aimed at a volunteer tutor is
// worse than a missed error.

import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluate, equivalent, quadraticCoefficients, realRoots, isZeroAt } from '../expression.js'
import { checkClaim } from '../pipeline/mathCheck.js'

/* ------------------------------------------------------------- evaluator */

test('evaluate handles precedence, brackets and unary minus', () => {
  assert.equal(evaluate('2 + 3 * 4'), 14)
  assert.equal(evaluate('(2 + 3) * 4'), 20)
  assert.equal(evaluate('2 - 3'), -1)
  assert.equal(evaluate('-3 + 2'), -1)
  assert.equal(evaluate('-3 * 2'), -6)
})

test('unary minus binds looser than a power, as people write it', () => {
  // -3^2 is -(3^2). Getting this backwards would make the checker disagree
  // with every textbook.
  assert.equal(evaluate('-3^2'), -9)
  assert.equal(evaluate('(-3)^2'), 9)
  assert.equal(evaluate('-x^2', 5), -25)
})

test('powers associate to the right', () => {
  assert.equal(evaluate('2^3^2'), 512)
})

test('evaluate understands implicit multiplication', () => {
  assert.equal(evaluate('2x', 5), 10)
  assert.equal(evaluate('(x + 2)(x + 3)', 1), 12)
  assert.equal(evaluate('3(x + 1)', 2), 9)
})

test('evaluate refuses what it does not understand', () => {
  assert.throws(() => evaluate('sin(x)'))
  assert.throws(() => evaluate('half of x'))
  assert.throws(() => evaluate('(x + 1'))
  assert.throws(() => evaluate('2 +'))
})

/* ------------------------------------------------------------ equivalence */

test('equivalent recognises a correct factorisation', () => {
  assert.equal(equivalent('x^2 + 5x + 6', '(x + 2)(x + 3)'), true)
  assert.equal(equivalent('x^2 - 49', '(x - 7)(x + 7)'), true)
  assert.equal(equivalent('2(x + 3)', '2x + 6'), true)
})

test('equivalent rejects a wrong factorisation', () => {
  assert.equal(equivalent('x^2 + 5x + 6', '(x + 1)(x + 6)'), false)
  assert.equal(equivalent('(x + 2)^2', 'x^2 + 4'), false)
})

test('equivalent returns null — not false — when it cannot read the expression', () => {
  // This is the guard against flagging a tutor for the evaluator's own limits.
  assert.equal(equivalent('sin(x)', 'x'), null)
  assert.equal(equivalent('half of x', 'x/2'), null)
})

/* ----------------------------------------------------------- polynomials */

test('quadraticCoefficients recovers a, b and c', () => {
  assert.deepEqual(quadraticCoefficients('x^2 + 5x + 6'), { a: 1, b: 5, c: 6 })
  assert.deepEqual(quadraticCoefficients('(x + 2)(x + 3)'), { a: 1, b: 5, c: 6 })
})

test('quadraticCoefficients returns null for anything of higher degree', () => {
  // Otherwise a cubic would be mistaken for a quadratic and get wrong roots.
  assert.equal(quadraticCoefficients('x^3 + 1'), null)
})

test('realRoots covers two roots, one root, and none', () => {
  assert.deepEqual(realRoots({ a: 1, b: 5, c: 6 }), [-3, -2])
  assert.deepEqual(realRoots({ a: 1, b: 0, c: -49 }), [-7, 7])
  assert.deepEqual(realRoots({ a: 1, b: -2, c: 1 }), [1])
  assert.deepEqual(realRoots({ a: 1, b: 0, c: 1 }), [])
})

test('realRoots falls back to the linear case', () => {
  assert.deepEqual(realRoots({ a: 0, b: 2, c: -8 }), [4])
})

test('isZeroAt tests a claimed root', () => {
  assert.equal(isZeroAt('x^2 + 5x + 6', -2), true)
  assert.equal(isZeroAt('x^2 + 5x + 6', 2), false)
})

/* ----------------------------------------------------------------- claims */

test('a correct factorisation raises nothing', () => {
  const result = checkClaim({ kind: 'equivalence', left: 'x^2 + 5x + 6', right: '(x + 2)(x + 3)' })
  assert.equal(result.verdict, 'correct')
})

test('a wrong factorisation is flagged', () => {
  const result = checkClaim({ kind: 'equivalence', left: 'x^2 + 5x + 6', right: '(x + 1)(x + 6)' })
  assert.equal(result.verdict, 'incorrect')
})

test('wrong roots are flagged with the offending values', () => {
  const result = checkClaim({ kind: 'roots', expression: 'x^2 + 5x + 6', claimed: [2, 3] })

  assert.equal(result.verdict, 'incorrect')
  assert.match(result.detail, /2 and 3 are not solutions/)
})

test('a missing root is "incomplete", not "incorrect"', () => {
  // The case this whole stage exists for: "x^2 = 49, so x = 7" is true as far
  // as it goes. Calling it wrong would be unfair; calling it right would miss
  // the teaching point.
  const result = checkClaim({ kind: 'roots', expression: 'x^2 - 49', claimed: [7] })

  assert.equal(result.verdict, 'incomplete')
  assert.match(result.detail, /-7 also solves/)
})

test('both roots given is simply correct', () => {
  assert.equal(checkClaim({ kind: 'roots', expression: 'x^2 - 49', claimed: [7, -7] }).verdict, 'correct')
})

test('a repeated root is not reported as missing', () => {
  // (x-1)^2 has one distinct solution; saying "x = 1" is complete.
  assert.equal(checkClaim({ kind: 'roots', expression: 'x^2 - 2x + 1', claimed: [1] }).verdict, 'correct')
})

test('arithmetic is checked and reported with the real value', () => {
  assert.equal(checkClaim({ kind: 'arithmetic', expression: '2 * 3', claimed: 6 }).verdict, 'correct')

  const wrong = checkClaim({ kind: 'arithmetic', expression: '7 * 8', claimed: 54 })
  assert.equal(wrong.verdict, 'incorrect')
  assert.match(wrong.detail, /is 56, not 54/)
})

test('an unreadable claim is skipped entirely, never flagged', () => {
  assert.equal(checkClaim({ kind: 'equivalence', left: 'sin(x)', right: 'x' }), null)
  assert.equal(checkClaim({ kind: 'roots', expression: 'log(x)', claimed: [1] }), null)
  assert.equal(checkClaim({ kind: 'arithmetic', expression: 'two times three', claimed: 6 }), null)
  assert.equal(checkClaim({ kind: 'unknown-kind' }), null)
  assert.equal(checkClaim(null), null)
})

test('a claim missing its fields is skipped', () => {
  assert.equal(checkClaim({ kind: 'equivalence', left: 'x + 1' }), null)
  assert.equal(checkClaim({ kind: 'roots', expression: 'x^2 - 1', claimed: [] }), null)
  assert.equal(checkClaim({ kind: 'roots', expression: 'x^2 - 1', claimed: ['nonsense'] }), null)
})
