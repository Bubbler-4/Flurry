// Copyright 2018-2020 the Deno authors. All rights reserved. MIT license.

// This is a specialised implementation of a System module loader.

"use strict";

// @ts-nocheck
/* eslint-disable */
let System, __instantiate;
(() => {
  const r = new Map();

  System = {
    register(id, d, f) {
      r.set(id, { d, f, exp: {} });
    },
  };
  async function dI(mid, src) {
    let id = mid.replace(/\.\w+$/i, "");
    if (id.includes("./")) {
      const [o, ...ia] = id.split("/").reverse(),
        [, ...sa] = src.split("/").reverse(),
        oa = [o];
      let s = 0,
        i;
      while ((i = ia.shift())) {
        if (i === "..") s++;
        else if (i === ".") break;
        else oa.push(i);
      }
      if (s < sa.length) oa.push(...sa.slice(s));
      id = oa.reverse().join("/");
    }
    return r.has(id) ? gExpA(id) : import(mid);
  }

  function gC(id, main) {
    return {
      id,
      import: (m) => dI(m, id),
      meta: { url: id, main },
    };
  }

  function gE(exp) {
    return (id, v) => {
      v = typeof id === "string" ? { [id]: v } : id;
      for (const [id, value] of Object.entries(v)) {
        Object.defineProperty(exp, id, {
          value,
          writable: true,
          enumerable: true,
        });
      }
    };
  }

  function rF(main) {
    for (const [id, m] of r.entries()) {
      const { f, exp } = m;
      const { execute: e, setters: s } = f(gE(exp), gC(id, id === main));
      delete m.f;
      m.e = e;
      m.s = s;
    }
  }

  async function gExpA(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](await gExpA(d[i]));
      const r = e();
      if (r) await r;
    }
    return m.exp;
  }

  function gExp(id) {
    if (!r.has(id)) return;
    const m = r.get(id);
    if (m.s) {
      const { d, e, s } = m;
      delete m.s;
      delete m.e;
      for (let i = 0; i < s.length; i++) s[i](gExp(d[i]));
      e();
    }
    return m.exp;
  }
  __instantiate = (m, a) => {
    System = __instantiate = undefined;
    rF(m);
    return a ? gExpA(m) : gExp(m);
  };
})();

System.register("flurry", [], function (exports_1, context_1) {
    "use strict";
    var __moduleName = context_1 && context_1.id;
    function newNode(type, child) {
        if (child !== undefined)
            return { type, child };
        return { type };
    }
    exports_1("newNode", newNode);
    function popStack(stack) {
        if (stack.length === 0)
            return newNode('Num', 1n);
        const retNode = stack[stack.length - 1];
        stack.pop();
        return retNode;
    }
    exports_1("popStack", popStack);
    function reduceOnce(node, stack) {
        function sequential(nodes, lastStep) {
            const [resultNodes, reduced] = nodes.reduce(([resultNodes, reduced], node) => {
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
        if (node.type === 'Pop') {
            return [popStack(stack), true];
        }
        if (node.type === 'Height') {
            return [newNode('Num', BigInt(stack.length)), true];
        }
        if (node.type === 'Push') {
            const lastStep = (nodes, reduced) => {
                const x = nodes[0];
                if (!reduced) {
                    stack.push(x);
                    return [x, true];
                }
                else {
                    return [newNode('Push', x), true];
                }
            };
            const x = node.child;
            return sequential([x], lastStep);
        }
        if (node.type === 'Compose') {
            function reduceNum(nodes) {
                return nodes.reduce((nodes, node) => {
                    if (nodes.length > 0) {
                        const lastNode = nodes[nodes.length - 1];
                        nodes.pop();
                        if (lastNode.type === 'Num' && node.type === 'Num') {
                            nodes.push(newNode('Num', lastNode.child * node.child));
                            return nodes;
                        }
                        else if (lastNode.type === 'Num' && lastNode.child === 0n) {
                            return nodes;
                        }
                        else if (node.type === 'Num' && node.child === 1n) {
                            return nodes;
                        }
                        else {
                            nodes.push(lastNode);
                        }
                    }
                    nodes.push(node);
                    return nodes;
                }, []);
            }
            const lastStep = (nodes, reduced) => {
                if (!reduced) {
                    if (nodes.length === 1) {
                        return [nodes[0], true];
                    }
                    const numReduction = reduceNum(nodes);
                    if (numReduction.length !== nodes.length) {
                        return [newNode('Compose', numReduction), true];
                    }
                    return [newNode('Compose', nodes), false];
                }
                return [newNode('Compose', nodes), true];
            };
            const nodes = node.child;
            return sequential(nodes, lastStep);
        }
        if (node.type === 'Lambda') {
            const lChild = node.child;
            if (lChild.type !== 'App')
                return [node, false];
            const aChild = lChild.child;
            if (aChild.length !== 1)
                return [node, false];
            if (aChild[0].type === 'Pop')
                return [newNode('Num', 1n), true];
            if (aChild[0].type === 'Compose') {
                const cChild = aChild[0].child;
                let height = 1;
                for (let cNode of cChild) {
                    --height;
                    if (height < 0)
                        return [node, false];
                    while (cNode.type !== 'Pop') {
                        if (cNode.type !== 'Push')
                            return [node, false];
                        if (cNode.child.type !== 'App')
                            return [node, false];
                        if (cNode.child.child.length !== 1)
                            return [node, false];
                        ++height;
                        cNode = cNode.child.child[0];
                    }
                }
                if (height === 0)
                    return [newNode('Num', BigInt(cChild.length)), true];
                else
                    return [node, false];
            }
            return [node, false];
        }
        if (node.type === 'App') {
            const first = node.child[0];
            if (first.type === 'App') {
                const child = first.child.concat(node.child.slice(1));
                return [newNode('App', child), true];
            }
            const [firstR, firstDone] = reduceOnce(first, stack);
            if (firstDone) {
                const child = [firstR].concat(node.child.slice(1));
                return [newNode('App', child), true];
            }
            if (node.child.length === 1) {
                return [firstR, true];
            }
            const second = node.child[1];
            const [secondR, secondDone] = reduceOnce(second, stack);
            if (secondDone) {
                const child = [firstR, secondR].concat(node.child.slice(2));
                return [newNode('App', child), true];
            }
            const twoTermsResult = [];
            if (firstR.type === 'S' && secondR.type === 'K') {
                twoTermsResult.push(newNode('Num', 0n));
            }
            else if (firstR.type === 'K' && secondR.type === 'Num' && secondR.child === 1n) {
                twoTermsResult.push(newNode('Num', 0n));
            }
            else if (firstR.type === 'S' && secondR.type === 'Compose' &&
                secondR.child.length === 2 &&
                secondR.child[0].type === 'S' && secondR.child[1].type === 'K') {
                twoTermsResult.push(newNode('Succ', undefined));
            }
            else if (firstR.type === 'Lambda') {
                stack.push(secondR);
                twoTermsResult.push(firstR.child);
            }
            else if (firstR.type === 'Compose') {
                const comp = firstR.child;
                const uncomp = newNode('App', [comp[comp.length - 1], secondR]);
                comp.pop();
                twoTermsResult.push(newNode('Compose', comp), uncomp);
            }
            else if (firstR.type === 'Num' && secondR.type === 'Num') {
                twoTermsResult.push(newNode('Num', secondR.child ** firstR.child));
            }
            else if (firstR.type === 'Num' && firstR.child === 0n) {
                twoTermsResult.push(newNode('Num', 1n));
            }
            else if (firstR.type === 'Num' && firstR.child === 1n) {
                twoTermsResult.push(secondR);
            }
            else if (firstR.type === 'Succ' && secondR.type === 'Num') {
                twoTermsResult.push(newNode('Num', secondR.child + 1n));
            }
            if (twoTermsResult.length > 0) {
                const child = twoTermsResult.concat(node.child.slice(2));
                return [newNode('App', child), true];
            }
            if (node.child.length < 3) {
                return [node, false];
            }
            const third = node.child[2];
            const [thirdR, thirdDone] = reduceOnce(third, stack);
            if (thirdDone) {
                const child = [firstR, secondR, thirdR].concat(node.child.slice(3));
                return [newNode('App', child), true];
            }
            const threeTermsResult = [];
            if (firstR.type === 'K') {
                threeTermsResult.push(secondR);
            }
            else if (firstR.type === 'Num' && secondR.type === 'Succ' && thirdR.type === 'Num') {
                threeTermsResult.push(newNode('Num', firstR.child + thirdR.child));
            }
            else if (firstR.type === 'Num') {
                if (firstR.child === 0n) {
                    threeTermsResult.push(thirdR);
                }
                else {
                    threeTermsResult.push(newNode('Num', firstR.child - 1n), secondR, newNode('App', [secondR, thirdR]));
                }
            }
            else if (firstR.type === 'Succ') {
                threeTermsResult.push(newNode('Compose', [thirdR, newNode('App', [secondR, thirdR])]));
            }
            else if (firstR.type === 'Compose' && firstR.child.length === 2 &&
                firstR.child[0].type === 'S' && firstR.child[1].type === 'K') {
                threeTermsResult.push(newNode('Compose', [secondR, thirdR]));
            }
            if (threeTermsResult.length > 0) {
                const child = threeTermsResult.concat(node.child.slice(3));
                return [newNode('App', child), true];
            }
            if (node.child.length < 4) {
                return [node, false];
            }
            const fourth = node.child[3];
            const [fourthR, fourthDone] = reduceOnce(fourth, stack);
            if (fourthDone) {
                const child = [firstR, secondR, thirdR, fourthR].concat(node.child.slice(4));
                return [newNode('App', child), true];
            }
            const fourTermsResult = [];
            if (firstR.type === 'S') {
                fourTermsResult.push(secondR, fourthR, newNode('App', [thirdR, fourthR]));
            }
            if (fourTermsResult.length > 0) {
                const child = fourTermsResult.concat(node.child.slice(4));
                return [newNode('App', child), true];
            }
        }
        return [node, false];
    }
    exports_1("reduceOnce", reduceOnce);
    function prettify(node) {
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
    exports_1("prettify", prettify);
    function parse(source) {
        if (source === '') {
            return newNode('Pop', undefined);
        }
        function prefixParse(source) {
            const closing = { '(': ')', '<': '>', '[': ']', '{': '}' };
            const nilad = { '(': 'K', '<': 'S', '[': 'Height', '{': 'Pop' };
            const monad = { '(': 'Push', '<': 'Compose', '[': 'App', '{': 'Lambda' };
            const head = source[0];
            if (source[1] === closing[head]) {
                return [newNode(nilad[head], undefined), source.slice(2)];
            }
            const children = [];
            let restString = source.slice(1);
            while (restString[0] !== closing[head]) {
                const [node, nextString] = prefixParse(restString);
                restString = nextString;
                children.push(node);
            }
            if (head === '(' || head === '{') {
                return [newNode(monad[head], newNode('App', children)), restString.slice(1)];
            }
            else {
                return [newNode(monad[head], children), restString.slice(1)];
            }
        }
        return prefixParse('[' + source + ']')[0];
    }
    exports_1("parse", parse);
    function right(value) {
        return { success: true, value };
    }
    exports_1("right", right);
    function left(error) {
        return { success: false, error };
    }
    exports_1("left", left);
    function safeParse(source) {
        const source2 = source.replaceAll(/[^(){}<>\[\]]/g, '');
        const closing = { '(': ')', '<': '>', '[': ']', '{': '}' };
        const stack = [];
        for (const c of source2) {
            switch (c) {
                case '(':
                case '<':
                case '[':
                case '{':
                    stack.push(c);
                    break;
                default:
                    if (stack.length === 0 || closing[stack[stack.length - 1]] !== c)
                        return left('unbalanced brackets');
                    stack.pop();
            }
        }
        if (stack.length !== 0)
            return left('unbalanced brackets');
        return right(parse(source2));
    }
    exports_1("safeParse", safeParse);
    return {
        setters: [],
        execute: function () {
        }
    };
});
System.register("index", ["flurry"], function (exports_2, context_2) {
    "use strict";
    var flurry_ts_1, _a, codeE, stdinE, _b, argsE, flagsE, reduxLimitE, stepCountE, _c, goE, stepE, resultE;
    var __moduleName = context_2 && context_2.id;
    function elements(ids) {
        return ids.map(id => document.getElementById(id));
    }
    return {
        setters: [
            function (flurry_ts_1_1) {
                flurry_ts_1 = flurry_ts_1_1;
            }
        ],
        execute: function () {
            console.log('Compilation success!');
            _a = elements(['code', 'stdin']), codeE = _a[0], stdinE = _a[1];
            _b = elements(['args', 'flags', 'redux-limit', 'step-count']), argsE = _b[0], flagsE = _b[1], reduxLimitE = _b[2], stepCountE = _b[3];
            _c = elements(['go', 'step', 'rslt']), goE = _c[0], stepE = _c[1], resultE = _c[2];
            goE.onclick = _ => {
                const code = codeE.value;
                const parseResult = flurry_ts_1.safeParse(code);
                if (parseResult.success) {
                    const node = parseResult.value;
                    console.log(flurry_ts_1.prettify(node));
                }
                else {
                    console.log(parseResult.error);
                }
            };
        }
    };
});

__instantiate("index", false);
