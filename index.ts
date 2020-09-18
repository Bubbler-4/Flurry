/// <reference lib="dom" />

import { safeParse, prettify } from './flurry.ts';

console.log('Compilation success!');

function elements<T extends HTMLElement>(ids: string[]) : T[] {
  return ids.map(id => document.getElementById(id) as T);
}

const [codeE, stdinE] = elements<HTMLTextAreaElement>(['code', 'stdin']);
const [argsE, flagsE, reduxLimitE, stepCountE] =
  elements<HTMLInputElement>(['args', 'flags', 'redux-limit', 'step-count']);
const [goE, stepE, resultE] = elements<HTMLElement>(['go', 'step', 'rslt']);

goE.onclick = _ => {
  const code = codeE.value;
  const parseResult = safeParse(code);
  if (parseResult.success) {
    const node = parseResult.value;
    console.log(prettify(node));
  } else {
    console.log(parseResult.error);
  }
}
