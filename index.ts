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
  const parseResult = safeParse(code);
  if (parseResult.success) {
    const node = parseResult.value;
    console.log(prettify(node));
    resultE.classList.remove('err');
    const [returnVal, stack, isComplete] = runToEnd(node, [], 10000n);
    if (isComplete) {
      resultE.innerHTML = prettify(returnVal);
      console.log(stack.map(prettify));
    } else {
      resultE.classList.add('err');
      resultE.innerHTML = 'step limit exceeded';
      console.log('return:', prettify(returnVal));
      console.log('stack:', stack.map(prettify));
    }
  } else {
    console.log(parseResult.error);
    resultE.classList.add('err');
    resultE.innerHTML = parseResult.error;
  }
}
