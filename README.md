[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/Bubbler-4/Flurry)

# Try Flurry Online! 

This is the in-browser interpreter of the [Flurry](https://esolangs.org/wiki/Flurry) programming language,
using the I/O formats of [Reconcyl/flurry](https://github.com/Reconcyl/flurry) (which is considered the reference implementation).

[Try Flurry online!](https://bubbler-4.github.io/Flurry/)

## Language spec

Flurry is a language where the only meaningful tokens are balanced brackets `() {} [] <>`.

### Nilads

* `<>` evaluates to S combinator.
* `()` evaluates to K combinator.
* `{}` pops an item from the stack and evaluates to that. If the stack is empty, I is popped.
* `[]` evaluates to the Church numeral representing the stack height.

### Monads

* `<a b ... c>` evaluates to `a . b . ... . c` (function composition of all terms inside the brackets).
* `[a b ... c]` evaluates to `a b ... c` (function application).
* `(a b ... c)` is the same as `[...]` except that it also pushes the evaluated value to the stack.
* `{a b ... c}` is a lambda expression where `{a b ... c} x` pushes `x` and evaluates to `[a b ... c]`.

### Input, execution, and output

When the program starts, the input values are pushed to the stack as Church numerals.
The entire program is then strictly evaluated like a lambda calculus expression (in applicative order).
When the program is in normal form (no longer reducible), the stack contents and the program's value
(both optional) are interpreted as Church numerals and outputted as their integer values.

## How to use the interpreter

If you have some experience with the Haskell (reference) interpreter, you will find the interface familiar.

* Code: Enter the Flurry source code. Non-Flurry characters are ignored.
* Stdin: Enter input values as whitespace-separated integers (integer mode) or any string (character mode).
* Extra args: Enter whitespace-separated integers to push on top of values from stdin. You can use it for
  e.g. a task which requires taking a string and an integer input.
* IO flags: Set the I/O modes. Must match `/^[ibvn][ivn][ibn]$/`. Explanation in order:
    * 1st char: Stack output
        * `i`: Integer output
        * `b`: Binary (text) output
        * `v`: Verbose output
        * `n`: No output (ignore stack contents)
    * 2nd char: Return value output
        * `i`: Integer output
        * `v`: Verbose output
        * `n`: No output (ignore return value)
    * 3rd char: Stdin input
        * `i`: Integer input
        * `b`: Binary (text) input
        * `n`: No input (ignore stdin)
* Reduction limit: The interpreter counts the number of reduction steps.
  When it hits the limit, evaluation is aborted and error is printed.

Also, the page has the permalink feature (click the `#` symbol at the top).
A permalink contains information about all active fields, so anyone clicking the permalink can
try running the code right away. It also generates a Code Golf.SE post under Output.

## Differences and enhancements from reference implementation

### Computed node types and many special-cased reduction rules

This interpreter uses number and `Succ` nodes internally to shortcut common arithmetic operations.
(This feature may be a source of bugs; if you find a bug, please let me know by opening an issue here
or pinging Bubbler at the [Flurry chat room on SE](https://chat.stackexchange.com/rooms/111736/flurry).)

Reduction rules are outlined in the big comment at the top of `flurry.ts`.

### Step-by-step evaluation, and aborting possibly infinite loops

The interpreter evaluates the program one step at a time, and runs to completion by repeating the
single-stepping function. As a result, it is possible to count the number of steps taken and
abort if it takes too much time to complete. This feature is necessary to not hang the browser.

It might also help in visualizing the single steps, but it is not yet implemented.

### Verbose output mode for debugging

The `v` output mode was added for both stack and return value outputs. This shows the terms as
a pretty-printed internal representation. This will help debugging both the Flurry code and
the interpreter. I decided to add it because I found it hard to build complicated intermediate
values without any way to inspect them.

## License

MIT