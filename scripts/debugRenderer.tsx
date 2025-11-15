import React from 'react';
import ReactDOMServer from 'react-dom/server';
import LatexRenderer from '../frontend/src/components/LatexRenderer';

const sample = `Here's a complete, step-by-step example of solving a quadratic equation using the quadratic formula. I'll use the equation **$2x^2 + 4x - 6 = 0$** to illustrate every detail clearly. This example includes all necessary calculations, common pitfalls to avoid, and verification of results.



---



### 🔢 **Step 1: Ensure the equation is in standard form**

The quadratic formula only works for equations in the form **$ax^2 + bx + c = 0$**.  

- Your equation: $2x^2 + 4x - 6 = 0$  

- This is already in standard form (all terms on one side equal to zero). ✅



---



### 🔢 **Step 2: Identify coefficients $a$, $b$, and $c$**

- **$a$** = coefficient of $x^2$ → **$a = 2$**  

- **$b$** = coefficient of $x$ → **$b = 4$**  

- **$c$** = constant term → **$c = -6$**  



⚠️ **Critical Reminder:**  

- $c$ is **negative** because it's $-6$.  

- **Never drop the sign** of $c$ when substituting!  

- $b$ is **positive**, but the quadratic formula requires **$-b$** (so $-4$, not $4$).



---



### 🔢 **Step 3: Write down the quadratic formula**

$$

x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}

$$



---



### 🔢 **Step 4: Substitute values into the formula**

Plug in $a = 2$, $b = 4$, and $c = -6$:

$$

x = \frac{-(4) \pm \sqrt{(4)^2 - 4(2)(-6)}}{2(2)}

$$



---



### 🔢 **Step 5: Calculate the discriminant ($b^2 - 4ac$)**

The discriminant is the part under the square root:

$$

b^2 - 4ac = (4)^2 - 4(2)(-6)

$$

- $4^2 = 16$  

- $4 \times 2 \times (-6) = -48$  

- So: $16 - (-48) = 16 + 48 = 64$  



✅ **Key Insight:**  

- Because $c$ is negative, $-4ac$ becomes **positive** ($-4 \times 2 \times -6 = +48$).  

- If you forget the negative sign of $c$, you’d compute $16 - 48 = -32$, which is wrong!



---



### 🔢 **Step 6: Take the square root of the discriminant**

$$

\sqrt{64} = 8

$$



---



### 🔢 **Step 7: Split into two solutions (one with $+$, one with $-$)**

Now compute both possibilities:

$$

x = \frac{-4 \pm 8}{4}

$$



#### Case 1: Use the **$+$** sign

$$

x = \frac{-4 + 8}{4} = \frac{4}{4} = 1

$$



#### Case 2: Use the **$-$** sign

$$

x = \frac{-4 - 8}{4} = \frac{-12}{4} = -3

$$



---



### 🔢 **Step 8: Verify solutions (optional but highly recommended!)**

Plug $x = 1$ and $x = -3$ back into the original equation to confirm they work:



#### For $x = 1$:

$$

2(1)^2 + 4(1) - 6 = 2 + 4 - 6 = 0 \quad \text{✓}

$$



#### For $x = -3$:

$$

2(-3)^2 + 4(-3) - 6 = 2(9) - 12 - 6 = 18 - 12 - 6 = 0 \quad \text{✓}

$$



---



### ✅ **Final Answer**

The solutions to $2x^2 + 4x - 6 = 0$ are:  

$$

\boxed{x = 1 \quad \text{and} \quad x = -3}

$$



---



### ⚠️ **Common Mistakes to Avoid**

1. **Forgetting the negative sign in $-b$**:  

   - If $b = 4$, you must use $-4$ in the formula — not $4$.  

2. **Misplacing signs when calculating $4ac$**:  

   - If $c$ is negative (like $-6$), $4ac$ becomes negative, so $-4ac$ is **positive**.  

3. **Dividing only by $a$ instead of $2a$**:  

   - The denominator is always $2a$ (here, $2 \times 2 = 4$, not $2$).  



---



### 💡 **Why This Works**

The quadratic formula derives from "completing the square" on a general quadratic equation. It guarantees **all real solutions** (if any) for $ax^2 + bx + c = 0$, even when factoring is difficult or impossible. The discriminant ($b^2 - 4ac$) tells you how many real solutions exist:  

- **Positive discriminant** → 2 real solutions (like our example)  

- **Zero discriminant** → 1 real solution (a repeated root)  

- **Negative discriminant** → No real solutions (only complex ones)  



You now have a complete, verified method for solving any quadratic equation using the quadratic formula! 🎯`;

const element = React.createElement(LatexRenderer, { children: sample });
const html = ReactDOMServer.renderToStaticMarkup(element);
console.log(html);
