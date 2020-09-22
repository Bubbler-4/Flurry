/// <reference lib="dom" />

import { Node, intToNode } from './flurry.ts';
import { reduceOnce, safeParse, prettify } from './flurry.ts';

console.log('Compilation success!');

function elements<T extends HTMLElement>(ids: string[]) : T[] {
  return ids.map(id => document.getElementById(id) as T);
}

const [codeE, stdinE] = elements<HTMLTextAreaElement>(['code', 'stdin']);
const [argsE, flagsE, reduxLimitE, stepCountE] =
  elements<HTMLInputElement>(['args', 'flags', 'redux-limit', 'step-count']);
const [goE, stepE, resultE] = elements<HTMLElement>(['go', 'step', 'rslt']);

// returns [returnVal, stack, isComplete]
function runToEnd(program : Node, init : bigint[], limit : bigint) : [Node, Node[], boolean] {
  const stack = init.map(intToNode);
  let reduced : boolean = true;
  while (0 < limit && reduced) {
    [program, reduced] = reduceOnce(program, stack);
    --limit;
  }
  return [program, stack, !reduced];
}

goE.onclick = _ => {
  const code = codeE.value;
  const stdin = stdinE.value;
  const args = argsE.value;
  const flags = flagsE.value;
  if (!/^[ibvn][ivn][ibn]$/.test(flags)) {
    resultE.classList.add('err');
    resultE.innerHTML = 'Incorrect flags; should be [ibn][in][ibn]';
    return;
  }
  const initialStack : bigint[] = [];
  if (flags[2] === 'i') {
    if (/^\s*(\d+\s*)*$/.test(stdin)) {
      initialStack.push(...stdin.trim().split(/\s+/).filter(x => x !== '').map(BigInt));
    } else {
      resultE.classList.add('err');
      resultE.innerHTML = 'Incorrect stdin format for integer input mode';
      return;
    }
  } else if (flags[2] === 'b') {
    initialStack.push(...[...stdin].map(x => BigInt(x.codePointAt(0))));
  }
  if (/^\s*(\d+\s*)*$/.test(args)) {
    initialStack.push(...args.trim().split(/\s+/).filter(x => x !== '').map(BigInt));
  } else {
    resultE.classList.add('err');
    resultE.innerHTML = 'Incorrect extra args format';
    return;
  }
  let reduxLimit : bigint;
  try {
    reduxLimit = BigInt(reduxLimitE.value);
    if (reduxLimit < 0n) throw 'negative';
  } catch (e) {
    resultE.classList.add('err');
    resultE.innerHTML = 'Reduction limit is not a non-negative integer';
    return;
  }
  const parseResult = safeParse(code);
  if (parseResult.success) {
    const node = parseResult.value;
    console.log(prettify(node));
    resultE.classList.remove('err');
    const [returnVal, stack, isComplete] = runToEnd(node, initialStack, reduxLimit);
    if (isComplete) {
      const stackOut : string[] = [];
      const retOut : string[] = [];
      if (flags[0] === 'i') {
        for (const node of stack) {
          if (node.type === 'Num') stackOut.push(node.child.toString());
        }
      } else if (flags[0] === 'b') {
        let stackStr = '';
        for (const node of stack) {
          if (node.type === 'Num') stackStr += String.fromCodePoint(Number(node.child % 1114111n));
        }
        stackOut.push(stackStr);
      } else if (flags[0] === 'v') {
        stack.forEach(node => stackOut.push(prettify(node)));
      }
      if (flags[1] === 'i') {
        if (returnVal.type === 'Num') retOut.push(returnVal.child.toString());
      } else if (flags[1] === 'v') {
        retOut.push(prettify(returnVal));
      }
      resultE.innerHTML = `${stackOut.join(' ') + (flags[0] === 'n' ? '' : '\n')}${retOut.join(' ') + (flags[1] === 'n' ? '' : '\n')}`;
    } else {
      resultE.classList.add('err');
      resultE.innerHTML = `Step limit exceeded\nreturn: ${prettify(returnVal)}\nstack: [${stack.map(prettify).join(', ')}]`;
    }
  } else {
    resultE.classList.add('err');
    resultE.innerHTML = parseResult.error;
  }
}
