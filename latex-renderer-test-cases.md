# LatexRenderer Test Cases

Use these test cases to verify the LatexRenderer handles various AI model outputs correctly.

## Test Case 1: Basic Inline Math

```
The quadratic formula is $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$.
```

**Expected**: Formula renders inline with text.

---

## Test Case 2: Display Math

```
The integral of e^x is:

$$\int e^x \, dx = e^x + C$$
```

**Expected**: Equation centered on its own line.

---

## Test Case 3: Implicit Math in Parentheses

```
The answer is ( x^2 + 1 ) which simplifies to ( x + 1 ).
```

**Expected**: Parenthetical expressions render as math.

---

## Test Case 4: Boxed Answer

```
The final answer is $\boxed{42}$.

Alternative format: [ \boxed{x = 5} ]
```

**Expected**: Answer displayed in a box, no redundant parentheses.

---

## Test Case 5: List with Math

```
Steps to solve:
1. Set $f'(x) = 0$
2. Solve for $x$
3. Check second derivative
```

**Expected**: Numbered list with inline math rendering.

---

## Test Case 6: Greek Letters

```
The parameters are $\alpha = 0.05$, $\beta = 0.95$, and $\gamma = 1.0$.

Capital letters: $\Delta$, $\Sigma$, $\Omega$
```

**Expected**: All Greek letters render correctly.

---

## Test Case 7: Complex Expression

```
$$
\int_{0}^{\infty} e^{-x^2} \, dx = \frac{\sqrt{\pi}}{2}
$$
```

**Expected**: Integral with limits and fractions.

---

## Test Case 8: Malformed Input (MathML)

```
The result is <math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math> simple.
```

**Expected**: MathML stripped, shows "The result is x simple."

---

## Test Case 9: Missing Backslashes

```
The fraction frac{1}{2} and square root sqrt{x} should work.
```

**Expected**: Backslashes added automatically, renders as math.

---

## Test Case 10: Code Block with Math Symbols

````
Here's some code:

```python
def calculate(x):
    return x**2 + 1  # x^2 + 1
\```
````

**Expected**: Code preserved as-is, not rendered as math.

---

## Test Case 11: Table with Math

```
| Operation | Formula |
|-----------|---------|
| Derivative | $\frac{d}{dx}[x^n] = nx^{n-1}$ |
| Integral | $\int x^n \, dx = \frac{x^{n+1}}{n+1} + C$ |
```

**Expected**: Table renders with math in cells.

---

## Test Case 12: Unicode Superscripts

```
Einstein's equation: E = mc²

Polynomial: x³ - 2x² + x - 1
```

**Expected**: Superscripts convert to proper LaTeX rendering.

---

## Test Case 13: Mixed Delimiters

```
Inline with $dollar$ and display with $$double dollar$$

Also \(paren style\) and \[bracket style\]
```

**Expected**: All four delimiter styles work correctly.

---

## Test Case 14: Derivative Notation

```
The derivative d/dx[x^2] equals 2x.

Partial derivative: $\frac{\partial f}{\partial x}$
```

**Expected**: Both notation styles render correctly.

---

## Test Case 15: Task List with Math

```
- [x] Solve $x^2 = 4$
- [ ] Integrate $\int x \, dx$
- [x] Find $\lim_{x \to 0} \frac{\sin x}{x}$
```

**Expected**: Checkboxes with rendered math.

---

## Test Case 16: Nested Lists with Math

```
Calculus concepts:
- Derivatives
  - Power rule: $\frac{d}{dx}[x^n] = nx^{n-1}$
  - Product rule: $(fg)' = f'g + fg'$
- Integrals
  - Basic: $\int x^n \, dx = \frac{x^{n+1}}{n+1} + C$
```

**Expected**: Nested structure with math in sub-items.

---

## Test Case 17: Multiple Math Modes

```
Consider the function $f(x) = x^2$. Its integral is:

$$F(x) = \int f(x) \, dx = \frac{x^3}{3} + C$$

Therefore, ( F'(x) = f(x) ).
```

**Expected**: Inline, display, and implicit math all work together.

---

## Test Case 18: Long Expressions

```
$$
\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6} \quad \text{and} \quad \prod_{p \text{ prime}} \frac{1}{1-p^{-2}} = \frac{\pi^2}{6}
$$
```

**Expected**: Complex sums and products render without errors.

---

## Test Case 19: Matrices

```
$$
A = \begin{pmatrix}
1 & 2 \\
3 & 4
\end{pmatrix}
$$
```

**Expected**: Matrix renders properly (KaTeX must support pmatrix).

---

## Test Case 20: Edge Case - Empty Math

```
Empty inline: $$ and empty display: $$$$

Should not break: $\boxed{}$
```

**Expected**: Graceful handling of empty expressions.

---

## Test Case 21: Special Cases from AI Models

### OpenAI Format

```
The solution is \boxed{x = 5}.
```

### Claude Format

```
The answer is [ x = 10 ].
```

### Gemini Format (sometimes outputs MathML)

```
Result: <math><mi>x</mi><mo>=</mo><mn>5</mn></math>
```

**Expected**: All three formats normalize and render correctly.

---

## Test Case 22: Escaped Characters

```
Use backslash-asterisk: \* and backslash-dollar: \$

But math should work: $x \times y$
```

**Expected**: Escaped characters shown literally, math still works.

---

## Test Case 23: Multiple Boxed Answers

```
Problem 1: $\boxed{x = 2}$
Problem 2: $\boxed{y = 3}$
Problem 3: ( \boxed{z = 4} )
```

**Expected**: All boxed answers render, third has parens removed.

---

## Test Case 24: Real AI Response Example

```
To find the derivative of $f(x) = x^3 - 2x^2 + x - 1$:

1. Apply the power rule to each term:
   - $\frac{d}{dx}[x^3] = 3x^2$
   - $\frac{d}{dx}[-2x^2] = -4x$
   - $\frac{d}{dx}[x] = 1$
   - $\frac{d}{dx}[-1] = 0$

2. Combine the results:
   $$f'(x) = 3x^2 - 4x + 1$$

The final answer is $\boxed{f'(x) = 3x^2 - 4x + 1}$.
```

**Expected**: Complete formatted response with list, inline math, display math, and boxed answer.

---

## Stress Tests

### Stress Test 1: Very Long Math Expression

```
$$
x = a_0 + \frac{1}{a_1 + \frac{1}{a_2 + \frac{1}{a_3 + \frac{1}{a_4 + \frac{1}{a_5}}}}}
$$
```

**Expected**: Deep nesting handled correctly.

---

### Stress Test 2: Mixed Content Soup

````
Text $inline$ more **bold** text $more$ math and `code` then:

$$display$$

- List $item$
- Another ( with math )

| Table | Math |
|-------|------|
| Cell  | $x^2$ |

```python
code_block = "preserved"
\```

End text.
````

**Expected**: All elements render in correct order and format.

---

## Manual Testing Checklist

- [ ] All basic math renders
- [ ] No crashes on malformed input
- [ ] Code blocks preserved
- [ ] Lists formatted correctly
- [ ] Tables render
- [ ] No MathML/SVG artifacts visible
- [ ] Greek letters work
- [ ] Boxed answers clean
- [ ] Mobile responsive
- [ ] Console has no errors (or only warnings)

---

## Automated Testing (Recommended)

````typescript
describe("LatexRenderer", () => {
  test("renders inline math", () => {
    const result = render(<LatexRenderer>$x^2$</LatexRenderer>);
    expect(result.container).toMatchSnapshot();
  });

  test("handles malformed MathML", () => {
    const input = "<math>x</math>";
    const result = render(<LatexRenderer>{input}</LatexRenderer>);
    expect(result.container.textContent).not.toContain("math");
  });

  test("preserves code blocks", () => {
    const input = "```python\nx = 1\n```";
    const result = render(<LatexRenderer>{input}</LatexRenderer>);
    expect(result.container.querySelector("code")).toBeTruthy();
  });
});
````

---

## Performance Benchmarks

Test with responses of varying lengths:

- **Small** (< 500 chars): < 10ms
- **Medium** (500-2000 chars): < 50ms
- **Large** (2000-5000 chars): < 100ms
- **Very Large** (> 5000 chars): < 200ms

If slower, check for:

- Excessive regex backtracking
- Large nested structures
- Memory allocation issues
