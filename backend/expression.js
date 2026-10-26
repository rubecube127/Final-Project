// A very small expression evaluator for school algebra.
//
// Exists so the maths checker can decide things in code rather than asking a
// model whether a model was right. It handles exactly what turns up in a
// Prealgebra or Algebra 1 session: numbers, one variable, + - * / ^, brackets,
// unary minus, and implicit multiplication (2x, (x+2)(x+3)).
//
// Deliberately not a computer algebra system, and deliberately not eval():
// transcripts are untrusted text, and a CAS would mean a dependency the
// project does not allow.

/** Split an expression into tokens, inserting implicit multiplication. */
export function tokenize(input) {
  const text = String(input).replace(/\s+/g, '')
  const tokens = []

  for (let i = 0; i < text.length; ) {
    const char = text[i]

    if (/[0-9.]/.test(char)) {
      let number = ''
      while (i < text.length && /[0-9.]/.test(text[i])) number += text[i++]
      if (!/^\d*\.?\d+$/.test(number)) throw new Error(`bad number "${number}"`)
      push(tokens, { type: 'number', value: Number(number) })
      continue
    }

    if (/[a-zA-Z]/.test(char)) {
      let name = ''
      while (i < text.length && /[a-zA-Z]/.test(text[i])) name += text[i++]
      // One variable only. Anything else is out of scope and must not be
      // silently treated as a name we understand.
      if (name.length !== 1) throw new Error(`unsupported symbol "${name}"`)
      push(tokens, { type: 'var', value: name.toLowerCase() })
      continue
    }

    if ('+-*/^'.includes(char)) {
      tokens.push({ type: 'op', value: char })
      i += 1
      continue
    }

    if (char === '(') { push(tokens, { type: 'open' }); i += 1; continue }
    if (char === ')') { tokens.push({ type: 'close' }); i += 1; continue }

    throw new Error(`unexpected character "${char}"`)
  }

  return tokens
}

// "2x" and "(x+1)(x+2)" are multiplications nobody writes the sign for.
function push(tokens, token) {
  const previous = tokens[tokens.length - 1]
  const implicit =
    previous &&
    (previous.type === 'number' || previous.type === 'var' || previous.type === 'close') &&
    (token.type === 'number' || token.type === 'var' || token.type === 'open')

  if (implicit) tokens.push({ type: 'op', value: '*' })
  tokens.push(token)
}

const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }

/** Shunting-yard: infix tokens to reverse Polish. */
export function toRpn(tokens) {
  const output = []
  const operators = []
  let previous = null

  for (const token of tokens) {
    if (token.type === 'number' || token.type === 'var') {
      output.push(token)
    } else if (token.type === 'op') {
      // A minus with nothing usable before it is a negation, not subtraction.
      const unary =
        token.value === '-' &&
        (!previous || previous.type === 'op' || previous.type === 'open')

      if (unary) {
        output.push({ type: 'number', value: 0 })
        operators.push({ type: 'op', value: '-u' })
      } else {
        while (operators.length) {
          const top = operators[operators.length - 1]
          if (top.type !== 'op') break
          // Unary minus binds looser than ^ but tighter than * and /, so
          // -3^2 is -(3^2) and -3*2 is (-3)*2, as everyone writes them.
          const topPrecedence = top.value === '-u' ? 2.5 : PRECEDENCE[top.value]
          const rightAssociative = token.value === '^'
          if (topPrecedence > PRECEDENCE[token.value] ||
              (topPrecedence === PRECEDENCE[token.value] && !rightAssociative)) {
            output.push(operators.pop())
          } else break
        }
        operators.push(token)
      }
    } else if (token.type === 'open') {
      operators.push(token)
    } else if (token.type === 'close') {
      while (operators.length && operators[operators.length - 1].type !== 'open') {
        output.push(operators.pop())
      }
      if (!operators.length) throw new Error('unbalanced brackets')
      operators.pop()
    }

    previous = token
  }

  while (operators.length) {
    const op = operators.pop()
    if (op.type === 'open') throw new Error('unbalanced brackets')
    output.push(op)
  }

  return output
}

/**
 * Evaluate an expression at a given value of the variable.
 * Throws if the expression is malformed or outside what this understands.
 */
export function evaluate(expression, x = 0) {
  const rpn = toRpn(tokenize(expression))
  const stack = []

  for (const token of rpn) {
    if (token.type === 'number') { stack.push(token.value); continue }
    if (token.type === 'var') { stack.push(x); continue }

    const b = stack.pop()
    const a = stack.pop()
    if (a === undefined || b === undefined) throw new Error('malformed expression')

    switch (token.value) {
      case '+': stack.push(a + b); break
      case '-': case '-u': stack.push(a - b); break
      case '*': stack.push(a * b); break
      case '/': stack.push(a / b); break
      case '^': stack.push(a ** b); break
      default: throw new Error(`unknown operator ${token.value}`)
    }
  }

  if (stack.length !== 1) throw new Error('malformed expression')
  const result = stack[0]
  if (!Number.isFinite(result)) throw new Error('expression does not evaluate to a number')
  return result
}

/**
 * Are two expressions the same function?
 *
 * Checked by sampling rather than by rearranging symbols: if they agree at a
 * spread of values they are equal as polynomials of any degree we care about.
 * This is what lets one mechanism cover factorising, expanding and simplifying.
 */
export function equivalent(left, right, samples = [-7, -3, -1.5, 0, 0.5, 2, 4.25, 11]) {
  let compared = 0

  for (const x of samples) {
    let a
    let b
    try {
      a = evaluate(left, x)
      b = evaluate(right, x)
    } catch {
      continue // a division by zero at this sample proves nothing
    }

    const scale = Math.max(1, Math.abs(a), Math.abs(b))
    if (Math.abs(a - b) > 1e-9 * scale) return false
    compared += 1
  }

  // Too few usable samples means the expressions could not be read, which is
  // NOT the same as them being different. Returning false here would flag a
  // tutor for writing something this evaluator simply does not understand.
  return compared >= 3 ? true : null
}

/** Is this expression zero at x? Used to test a claimed root. */
export function isZeroAt(expression, x) {
  const value = evaluate(expression, x)
  const scale = Math.max(1, Math.abs(evaluate(expression, x + 1)))
  return Math.abs(value) <= 1e-9 * scale
}

/**
 * Recover a, b, c for an expression that is a quadratic (or lower) in x.
 *
 * Three samples fix three coefficients; two more confirm the expression really
 * was quadratic rather than something that merely passed through those points.
 * Returns null when it is not.
 */
export function quadraticCoefficients(expression) {
  let f0
  let f1
  let fMinus1
  try {
    f0 = evaluate(expression, 0)
    f1 = evaluate(expression, 1)
    fMinus1 = evaluate(expression, -1)
  } catch {
    return null
  }

  const c = f0
  const a = (f1 + fMinus1) / 2 - c
  const b = (f1 - fMinus1) / 2

  for (const x of [2, -3, 5.5]) {
    let actual
    try {
      actual = evaluate(expression, x)
    } catch {
      return null
    }
    const predicted = a * x * x + b * x + c
    const scale = Math.max(1, Math.abs(actual))
    if (Math.abs(actual - predicted) > 1e-9 * scale) return null
  }

  return { a, b, c }
}

/** The real roots of ax² + bx + c, in order, with repeats collapsed. */
export function realRoots({ a, b, c }) {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return []
    return [-c / b]
  }

  const discriminant = b * b - 4 * a * c
  if (discriminant < -1e-12) return []
  if (Math.abs(discriminant) <= 1e-12) return [-b / (2 * a)]

  const root = Math.sqrt(discriminant)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].sort((p, q) => p - q)
}
