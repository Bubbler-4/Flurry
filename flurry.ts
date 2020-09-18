/*
Flurry step-by-step interpreter
() = K, <> = S, {} = Pop, [] = Height
(a b c) = Push(a b c)
<a b c> = Compose(a,b,c)
{a b c} = Lambda(a b c)
[a b c] = (a b c)

Reduction order: applicative order (evaluate argument first, then application)
Lambda calculus: Var('x') | App(x,x,...) | Lambda('x',x)
Flurry term: S | K | Pop | Height | App(x,x,...) | Compose(x,x,...) | Lambda(x) | Push(x) | Num(n) | Succ
Syntax translation: (a b c) -> Push(App(...)), {a b c} -> Lambda(App(...))
Reduction rules:
Pop -> (anything popped from the stack)
Height -> (number that represents the current stack height)
Push(x) -> [eval x, push x] x
Compose(a,b,...,c) -> [eval a, b, ..., c] Compose(a,b,...,c)
Compose(x) -> [eval x] x
Compose(...Num(m), Num(n)...) -> Compose(...Num(mn)...)
Compose(...Num(0), any) -> Compose(...Num(0))
Compose(any1, Num(1), any2) -> Compose(any1, any2)
Lambda(x) -> Num(n) if it has certain form (I and higher num literals)
App(x) -> x
S K -> Num(0)
K Num(1) -> Num(0)
S (Compose(S,K)) -> Succ
Lambda(x) y -> [eval y, push y] x
Compose(a,b,...,c) x -> [eval x] Compose(a,b,...) (c x)
Num(0) x -> [eval x] 1
Num(1) x -> [eval x] x
Num(m) Num(n) -> Num(n**m)
Succ Num(n) -> Num(n+1)
K x y -> [eval x, y] x
Num(m) Succ Num(n) -> Num(m+n)
<need to remove> Num(0) f x -> [eval f, x] x
Num(n+1) f x -> [eval f, x] Num(n) f (f x)
Succ x y -> [eval x, y] S (K y) (x y) (reduction of S <SK> x y)
<SK> x y -> [eval x, y] <xy>
S x y z -> [eval x, y, z] x z (y z)
*/

export type Node =
  { type: 'S' | 'K' | 'Pop' | 'Height' | 'Succ' } |
  { type: 'App' | 'Compose', child: Node[] } |
  { type: 'Lambda' | 'Push', child: Node } |
  { type: 'Num', child: bigint }

export function newNode(type : string, child: any) : Node {
  if (child !== undefined) return { type, child } as Node;
  return { type } as Node;
}

export function popStack(stack : Node[]) : Node {
  if (stack.length === 0) return newNode('Num', 1n);
  const retNode = stack[stack.length - 1];
  stack.pop();
  return retNode;
}

// Return: [result, whether the node was reduced or not]
export function reduceOnce(node : Node, stack : Node[]) : [Node, boolean] {
  // Helper function
  type WrapUpFunc = (nodes : Node[], reduced : boolean) => [Node, boolean];
  function sequential(nodes : Node[], lastStep : WrapUpFunc) : [Node, boolean] {
    const [resultNodes, reduced] = nodes.reduce(([resultNodes, reduced] : [Node[], boolean], node) => {
      if (reduced) {
        resultNodes.push(node);
        return [resultNodes, reduced];
      }
      const [nextNode, nextReduced] = reduceOnce(node, stack);
      resultNodes.push(nextNode);
      return [resultNodes, nextReduced];
    }, [[], false]);
    return lastStep(resultNodes, reduced);
  }

  // Main logic
  if (node.type === 'Pop') {
    // Pop -> (pop from stack)
    return [popStack(stack), true];
  }
  if (node.type === 'Height') {
    // Height -> Num(stack height)
    return [newNode('Num', BigInt(stack.length)), true];
  }
  if (node.type === 'Push') {
    // Push(x) -> [eval x, push x] x
    const lastStep : WrapUpFunc = (nodes, reduced) => {
      const x = nodes[0];
      if (!reduced) {
        stack.push(x);
        return [x, true];
      } else {
        return [newNode('Push', x), true];
      }
    }
    const x = node.child;
    return sequential([x], lastStep);
  }
  if (node.type === 'Compose') {
    // Compose([a, b, ...]) -> [eval a, b, ...] Compose([a, b, ...])
    // Compose([x]) -> x
    // Compose([..., Num(n), Num(m), ...]) -> Compose([..., Num(n*m), ...])
    // Compose(...Num(0), any) -> Compose(...Num(0))
    // Compose(any1, Num(1), any2) -> Compose(any1, any2)
    function reduceNum(nodes : Node[]) : Node[] {
      return nodes.reduce((nodes : Node[], node : Node) => {
        if (nodes.length > 0) {
          const lastNode = nodes[nodes.length - 1];
          nodes.pop();
          if (lastNode.type === 'Num' && node.type === 'Num') {
            nodes.push(newNode('Num', lastNode.child * node.child));
            return nodes;
          } else if (lastNode.type === 'Num' && lastNode.child === 0n) {
            return nodes;
          } else if (node.type === 'Num' && node.child === 1n) {
            return nodes;
          } else {
            nodes.push(lastNode);
          }
        }
        nodes.push(node);
        return nodes;
      }, []);
    }
    const lastStep : WrapUpFunc = (nodes, reduced) => {
      if (!reduced) {
        // Try singleton reduction
        if (nodes.length === 1) {
          return [nodes[0], true];
        }
        // Try num reduction
        const numReduction = reduceNum(nodes);
        if (numReduction.length !== nodes.length) {
          return [newNode('Compose', numReduction), true];
        }
        return [newNode('Compose', nodes), false];
      }
      return [newNode('Compose', nodes), true];
    }
    const nodes = node.child;
    return sequential(nodes, lastStep);
  }
  if (node.type === 'Lambda') {
    const lChild = node.child;
    if (lChild.type !== 'App') return [node, false];
    const aChild = lChild.child;
    if (aChild.length !== 1) return [node, false];
    // Literal I == 1
    if (aChild[0].type === 'Pop') return [newNode('Num', 1n), true];
    // Literal 2 or higher
    if (aChild[0].type === 'Compose') {
      // all nodes must be in a form of Push$App$Push$App$...$Pop
      const cChild = aChild[0].child;
      let height = 1;
      for (let cNode of cChild) {
        --height;
        if (height < 0) return [node, false];
        while (cNode.type !== 'Pop') {
          if (cNode.type !== 'Push') return [node, false];
          if (cNode.child.type !== 'App') return [node, false];
          if (cNode.child.child.length !== 1) return [node, false];
          ++height;
          cNode = cNode.child.child[0];
        }
      }
      if (height === 0) return [newNode('Num', BigInt(cChild.length)), true];
      else return [node, false];
    }
    return [node, false];
  }
  if (node.type === 'App') {
    // App(App(...),...) -> App(...,...)
    const first = node.child[0];
    if (first.type === 'App') {
      const child = first.child.concat(node.child.slice(1));
      return [newNode('App', child), true];
    }
    // Reduce first item
    const [firstR, firstDone] = reduceOnce(first, stack);
    if (firstDone) {
      const child = [firstR].concat(node.child.slice(1));
      return [newNode('App', child), true];
    }
    // App(x) -> x
    if (node.child.length === 1) {
      return [firstR, true];
    }
    // Reduce second item
    const second = node.child[1];
    const [secondR, secondDone] = reduceOnce(second, stack);
    if (secondDone) {
      const child = [firstR, secondR].concat(node.child.slice(2));
      return [newNode('App', child), true];
    }
    // S K -> Num(0)
    // S (Compose(S,K)) -> Succ
    // K Num(1) -> Num(0)
    // Lambda(x) y -> [eval y, push y] x
    // Compose(a,b,...,c) x -> [eval x] Compose(a,b,...) (c x)
    // Num(m) Num(n) -> Num(n**m)
    // Num(0) x -> [eval x] 1
    // Num(1) x -> [eval x] x
    // Succ Num(n) -> Num(n+1)
    const twoTermsResult : Node[] = [];
    if (firstR.type === 'S' && secondR.type === 'K') {
      twoTermsResult.push(newNode('Num', 0n));
    } else if (firstR.type === 'K' && secondR.type === 'Num' && secondR.child === 1n) {
      twoTermsResult.push(newNode('Num', 0n));
    } else if (firstR.type === 'S' && secondR.type === 'Compose' &&
               secondR.child.length === 2 &&
               secondR.child[0].type === 'S' && secondR.child[1].type === 'K') {
      twoTermsResult.push(newNode('Succ', undefined));
    } else if (firstR.type === 'Lambda') {
      stack.push(secondR);
      twoTermsResult.push(firstR.child);
    } else if (firstR.type === 'Compose') {
      const comp = firstR.child;
      const uncomp = newNode('App', [comp[comp.length - 1], secondR]);
      comp.pop();
      twoTermsResult.push(newNode('Compose', comp), uncomp);
    } else if (firstR.type === 'Num' && secondR.type === 'Num') {
      twoTermsResult.push(newNode('Num', secondR.child ** firstR.child));
    } else if (firstR.type === 'Num' && firstR.child === 0n) {
      twoTermsResult.push(newNode('Num', 1n));
    } else if (firstR.type === 'Num' && firstR.child === 1n) {
      twoTermsResult.push(secondR);
    } else if (firstR.type === 'Succ' && secondR.type === 'Num') {
      twoTermsResult.push(newNode('Num', secondR.child + 1n));
    }
    if (twoTermsResult.length > 0) {
      const child = twoTermsResult.concat(node.child.slice(2));
      return [newNode('App', child), true];
    }
    // Reduce third item
    if (node.child.length < 3) {
      return [node, false];
    }
    const third = node.child[2];
    const [thirdR, thirdDone] = reduceOnce(third, stack);
    if (thirdDone) {
      const child = [firstR, secondR, thirdR].concat(node.child.slice(3));
      return [newNode('App', child), true];
    }
    // K x y -> [eval x, y] x
    // Num(m) Succ Num(n) -> Num(m+n)
    // Num(0) f x -> [eval f, x] x
    // Num(n+1) f x -> [eval f, x] Num(n) f (f x)
    // Succ x y -> [eval x, y] <y(xy)> (reduction of S <SK> x y)
    // <SK> x y -> [eval x, y] <xy>
    const threeTermsResult : Node[] = [];
    if (firstR.type === 'K') {
      threeTermsResult.push(secondR);
    } else if (firstR.type === 'Num' && secondR.type === 'Succ' && thirdR.type === 'Num') {
      threeTermsResult.push(newNode('Num', firstR.child + thirdR.child));
    } else if (firstR.type === 'Num') {
      if (firstR.child === 0n) {
        threeTermsResult.push(thirdR);
      } else {
        threeTermsResult.push(newNode('Num', firstR.child - 1n), secondR, newNode('App', [secondR, thirdR]));
      }
    } else if (firstR.type === 'Succ') {
      threeTermsResult.push(newNode('Compose', [thirdR, newNode('App', [secondR, thirdR])]));
      // threeTermsResult.push(newNode('S', undefined));
      // threeTermsResult.push(newNode('App', [newNode('K', undefined), thirdR]));
      // threeTermsResult.push(newNode('App', [secondR, thirdR]));
    } else if (firstR.type === 'Compose' && firstR.child.length === 2 &&
               firstR.child[0].type === 'S' && firstR.child[1].type === 'K') {
      threeTermsResult.push(newNode('Compose', [secondR, thirdR]));
    }
    if (threeTermsResult.length > 0) {
      const child = threeTermsResult.concat(node.child.slice(3));
      return [newNode('App', child), true];
    }
    // Reduce fourth item
    if (node.child.length < 4) {
      return [node, false];
    }
    const fourth = node.child[3];
    const [fourthR, fourthDone] = reduceOnce(fourth, stack);
    if (fourthDone) {
      const child = [firstR, secondR, thirdR, fourthR].concat(node.child.slice(4));
      return [newNode('App', child), true];
    }
    // S x y z -> [eval x, y, z] x z (y z)
    const fourTermsResult : Node[] = [];
    if (firstR.type === 'S') {
      fourTermsResult.push(secondR, fourthR, newNode('App', [thirdR, fourthR]));
    }
    if (fourTermsResult.length > 0) {
      const child = fourTermsResult.concat(node.child.slice(4));
      return [newNode('App', child), true];
    }
  }
  // irreducible nodes: S, K, Succ, Num
  return [node, false];
}

export function prettify(node : Node) : string {
  if (node.type === 'S' || node.type === 'K' || node.type === 'Height' ||
      node.type === 'Pop' || node.type === 'Succ') {
    return node.type;
  }
  if (node.type === 'Num') {
    return node.child.toString();
  }
  if (node.type === 'Push') {
    return `Push(${prettify(node.child)})`;
  }
  if (node.type === 'App') {
    return `[${node.child.map(prettify).join(' ')}]`;
  }
  if (node.type === 'Compose') {
    return `<${node.child.map(prettify).join(' ')}>`;
  }
  if (node.type === 'Lambda') {
    return `{${prettify(node.child)}}`;
  }
  return '';
}

export function parse(source : string) : Node {
  // just assumes the source code is syntactically correct
  if (source === '') {
    return newNode('Pop', undefined);
  }
  function prefixParse(source : string) : [Node, string] {
    const closing = { '(': ')', '<': '>', '[': ']', '{': '}' };
    const nilad = { '(': 'K', '<': 'S', '[': 'Height', '{': 'Pop' };
    const monad = { '(': 'Push', '<': 'Compose', '[': 'App', '{': 'Lambda' };
    // Push and Lambda has App node as child
    const head = source[0] as keyof typeof closing;

    if (source[1] === closing[head]) {
      return [newNode(nilad[head], undefined), source.slice(2)];
    }
    const children : Node[] = [];
    let restString = source.slice(1);
    while (restString[0] !== closing[head]) {
      const [node, nextString] = prefixParse(restString);
      restString = nextString;
      children.push(node);
    }
    if (head === '(' || head === '{') {
      return [newNode(monad[head], newNode('App', children)), restString.slice(1)];
    } else {
      return [newNode(monad[head], children), restString.slice(1)];
    }
  }
  return prefixParse('[' + source + ']')[0];
}

export type Either<T,U> = { success: true, value: T } | { success: false, error: U }
export function right<T,U>(value: T) : Either<T,U> {
  return { success: true, value };
}
export function left<T,U>(error: U) : Either<T,U> {
  return { success: false, error };
}

export function safeParse(source : string) : Either<Node,string> {
  // Remove any non-brackets
  const source2 = source.replaceAll(/[^(){}<>\[\]]/g, '');
  const closing = { '(': ')', '<': '>', '[': ']', '{': '}' };
  const stack : (keyof typeof closing)[] = [];
  for (const c of source2) {
    switch (c) {
      case '(':
      case '<':
      case '[':
      case '{':
        stack.push(c); break;
      default:
        if (stack.length === 0 || closing[stack[stack.length - 1]] !== c)
          return left('unbalanced brackets');
        stack.pop();
    }
  }
  if (stack.length !== 0) return left('unbalanced brackets');
  return right(parse(source2));
}
