/// <reference lib="dom" />

import { Node, intToNode } from './flurry.ts';
import { reduceOnce, safeParse, prettify } from './flurry.ts';

console.log('Compilation success!');

function elements<T extends HTMLElement>(ids: string[]) : T[] {
  return ids.map(id => document.getElementById(id) as T);
}

const [codeE, stdinE, outputE, errorE] = elements<HTMLTextAreaElement>(['code', 'stdin', 'output', 'error']);
const [argsE, flagsE, reduxLimitE, stepCountE] =
  elements<HTMLInputElement>(['args', 'flags', 'redux-limit', 'step-count']);
const [goE, stepE, resultE, permaE, bytesE] = elements<HTMLElement>(['go', 'step', 'rslt', 'perm', 'bytes']);

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

function encodeField(s : string) {
  const codeUnits = new Uint16Array(s.length);
  for (let i = 0; i < codeUnits.length; i++) {
    codeUnits[i] = s.charCodeAt(i);
  }
  return btoa(String.fromCharCode(...new Uint8Array(codeUnits.buffer)));
}

function decodeField(b : string) {
  b = atob(b);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = b.charCodeAt(i);
  }
  return String.fromCharCode(...new Uint16Array(bytes.buffer));
}

function byteCount(s : string) {
  return [...s].map(c => {
    const codepoint = c.codePointAt(0) as number;
    if (codepoint <= 0x7f) return 1;
    if (codepoint <= 0x7ff) return 2;
    if (codepoint <= 0xffff) return 3;
    return 4;
  }).reduce((x, y) => x + y, 0);
}

window.onload = () => {
  codeE.focus();
  if (location.hash === '') return;
  try {
    const [code, stdin, args, flags, reduxLimit] = location.hash.slice(2).split('#').map(decodeField);
    codeE.value = code;
    stdinE.value = stdin;
    argsE.value = args;
    flagsE.value = flags;
    reduxLimitE.value = reduxLimit;
  } catch (e) {
    codeE.value = stdinE.value = argsE.value = '';
    flagsE.value = 'nnn';
    reduxLimitE.value = '10000';
  }
  bytesE.innerHTML = byteCount(codeE.value).toString();
}

codeE.oninput = () => {
  bytesE.innerHTML = byteCount(codeE.value).toString();
}

permaE.onclick = () => {
  const code = codeE.value;
  const stdin = stdinE.value;
  const args = argsE.value;
  const flags = flagsE.value;
  const reduxLimit = reduxLimitE.value;
  location.hash = '#!' + [code, stdin, args, flags, reduxLimit].map(encodeField).join('#');
  const bytes = byteCount(code);
  outputE.value = `# [Flurry](https://github.com/Reconcyl/flurry) \`-${flags}\`, ${bytes} bytes\n\n`;
  outputE.value += '```\n' + code + '\n```\n\n';
  outputE.value += `[Try it online!](${window.location.href})`;
  errorE.value = '';
}

// Takes all active fields and returns [output, error]
function runInterpreter(code : string, stdin : string, args : string, flags : string, reduxLimitS : string) : [string, string] {
  //outputE.value = errorE.value = '';
  //const code = codeE.value;
  //const stdin = stdinE.value;
  //const args = argsE.value;
  //const flags = flagsE.value;
  if (!/^[ibvn][ivn][ibn]$/.test(flags)) {
    return ['', 'Incorrect flags; should be [ibvn][ivn][ibn]'];
  }
  const initialStack : bigint[] = [];
  if (flags[2] === 'i') {
    if (/^\s*(\d+\s*)*$/.test(stdin)) {
      initialStack.push(...stdin.trim().split(/\s+/).filter(x => x !== '').map(BigInt));
    } else {
      return ['', 'Incorrect stdin format for integer input mode'];
    }
  } else if (flags[2] === 'b') {
    initialStack.push(...[...stdin].map(x => BigInt(x.codePointAt(0))));
  }
  if (/^\s*(\d+\s*)*$/.test(args)) {
    initialStack.push(...args.trim().split(/\s+/).filter(x => x !== '').map(BigInt));
  } else {
    return ['', 'Incorrect extra args format'];
  }
  let reduxLimit : bigint;
  try {
    reduxLimit = BigInt(reduxLimitS);
    if (reduxLimit < 0n) throw 'negative';
  } catch (e) {
    return ['', 'Reduction limit is not a non-negative integer'];
  }
  const parseResult = safeParse(code);
  if (parseResult.success) {
    const node = parseResult.value;
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
      return [`${stackOut.join(' ') + (/[nb]/.test(flags[0]) ? '' : '\n')}${retOut.join(' ') + (flags[1] === 'n' ? '' : '\n')}`, ''];
    } else {
      return ['', `Step limit exceeded\nreturn: ${prettify(returnVal)}\nstack: [${stack.map(prettify).join(', ')}]`];
    }
  } else {
    return ['', parseResult.error];
  }
}

goE.onclick = _ => {
  const code = codeE.value;
  const stdin = stdinE.value;
  const args = argsE.value;
  const flags = flagsE.value;
  const reduxLimitS = reduxLimitE.value;
  [outputE.value, errorE.value] = runInterpreter(code, stdin, args, flags, reduxLimitS);
}
