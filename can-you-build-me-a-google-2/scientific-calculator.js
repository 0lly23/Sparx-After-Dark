(() => {
  'use strict';

  const MAX_FACTORIAL = 170;
  const instances = new WeakMap();

  function calculatorError(message) {
    return new Error(message);
  }

  function finite(value) {
    if (!Number.isFinite(value)) throw calculatorError('Result is outside the calculator range.');
    return value;
  }

  function integer(value, label) {
    if (!Number.isInteger(value)) throw calculatorError(`${label} needs a whole number.`);
    return value;
  }

  function factorial(value) {
    integer(value, 'Factorial');
    if (value < 0 || value > MAX_FACTORIAL) throw calculatorError(`Factorial supports whole numbers from 0 to ${MAX_FACTORIAL}.`);
    let result = 1;
    for (let index = 2; index <= value; index += 1) result *= index;
    return result;
  }

  function combinations(n, r) {
    integer(n, 'nCr');
    integer(r, 'nCr');
    if (n < 0 || r < 0 || r > n) throw calculatorError('For nCr, use 0 ≤ r ≤ n.');
    const smaller = Math.min(r, n - r);
    let result = 1;
    for (let index = 1; index <= smaller; index += 1) result = result * (n - smaller + index) / index;
    return finite(result);
  }

  function permutations(n, r) {
    integer(n, 'nPr');
    integer(r, 'nPr');
    if (n < 0 || r < 0 || r > n) throw calculatorError('For nPr, use 0 ≤ r ≤ n.');
    let result = 1;
    for (let index = 0; index < r; index += 1) result *= n - index;
    return finite(result);
  }

  function greatestCommonDivisor(left, right) {
    integer(left, 'gcd');
    integer(right, 'gcd');
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  function leastCommonMultiple(left, right) {
    integer(left, 'lcm');
    integer(right, 'lcm');
    if (left === 0 || right === 0) return 0;
    return Math.abs(left * right) / greatestCommonDivisor(left, right);
  }

  function tokenize(expression) {
    const source = String(expression || '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, 'pi')
      .replace(/√/g, 'sqrt');
    const tokens = [];
    let index = 0;

    while (index < source.length) {
      const character = source[index];
      if (/\s/.test(character)) {
        index += 1;
        continue;
      }

      if (/\d|\./.test(character)) {
        const match = source.slice(index).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
        if (!match) throw calculatorError('That number is not valid.');
        tokens.push({ type: 'number', value: Number(match[0]) });
        index += match[0].length;
        continue;
      }

      if (/[a-z]/i.test(character)) {
        const match = source.slice(index).match(/^[a-z]+/i);
        tokens.push({ type: 'identifier', value: match[0].toLowerCase() });
        index += match[0].length;
        continue;
      }

      if ('+-*/^!%,()'.includes(character)) {
        tokens.push({ type: character, value: character });
        index += 1;
        continue;
      }

      throw calculatorError(`I do not recognise “${character}”.`);
    }
    return tokens;
  }

  class ExpressionParser {
    constructor(tokens, { degrees, answer }) {
      this.tokens = tokens;
      this.degrees = degrees;
      this.answer = Number.isFinite(answer) ? answer : 0;
      this.position = 0;
    }

    peek(type) {
      const token = this.tokens[this.position];
      return token && token.type === type;
    }

    take(type) {
      if (!this.peek(type)) return null;
      return this.tokens[this.position++];
    }

    expect(type, message) {
      const token = this.take(type);
      if (!token) throw calculatorError(message || `Expected “${type}”.`);
      return token;
    }

    parse() {
      if (!this.tokens.length) throw calculatorError('Enter a calculation first.');
      const result = this.expression();
      if (this.position !== this.tokens.length) throw calculatorError('Check the order of the calculation.');
      return finite(result);
    }

    expression() {
      let result = this.term();
      while (this.peek('+') || this.peek('-')) {
        const operator = this.tokens[this.position++].type;
        const right = this.term();
        result = operator === '+' ? result + right : result - right;
      }
      return finite(result);
    }

    term() {
      let result = this.unary();
      while (this.peek('*') || this.peek('/') || this.peek('%')) {
        const operator = this.tokens[this.position++].type;
        const right = this.unary();
        if ((operator === '/' || operator === '%') && right === 0) throw calculatorError('You cannot divide by zero.');
        if (operator === '*') result *= right;
        if (operator === '/') result /= right;
        if (operator === '%') result %= right;
      }
      return finite(result);
    }

    unary() {
      if (this.take('+')) return this.unary();
      if (this.take('-')) return finite(-this.unary());
      return this.power();
    }

    power() {
      let result = this.postfix();
      if (this.take('^')) result = Math.pow(result, this.unary());
      return finite(result);
    }

    postfix() {
      let result = this.primary();
      while (this.take('!')) result = factorial(result);
      return finite(result);
    }

    primary() {
      const number = this.take('number');
      if (number) return number.value;

      if (this.take('(')) {
        const result = this.expression();
        this.expect(')', 'Close the bracket before continuing.');
        return result;
      }

      const identifier = this.take('identifier');
      if (!identifier) throw calculatorError('Choose a number, function, or opening bracket.');
      const name = identifier.value;
      if (!this.take('(')) {
        if (name === 'pi') return Math.PI;
        if (name === 'e') return Math.E;
        if (name === 'ans') return this.answer;
        throw calculatorError(`Use brackets after ${name}.`);
      }

      const argumentsList = [];
      if (!this.peek(')')) {
        do {
          argumentsList.push(this.expression());
        } while (this.take(','));
      }
      this.expect(')', 'Close the function bracket before continuing.');
      return this.functionValue(name, argumentsList);
    }

    functionValue(name, values) {
      const exactly = (count) => {
        if (values.length !== count) throw calculatorError(`${name} needs ${count} value${count === 1 ? '' : 's'}.`);
      };
      const radians = (value) => this.degrees ? value * Math.PI / 180 : value;
      const angle = (value) => this.degrees ? value * 180 / Math.PI : value;

      switch (name) {
        case 'sin': exactly(1); return finite(Math.sin(radians(values[0])));
        case 'cos': exactly(1); return finite(Math.cos(radians(values[0])));
        case 'tan': exactly(1); return finite(Math.tan(radians(values[0])));
        case 'asin': exactly(1); return finite(angle(Math.asin(values[0])));
        case 'acos': exactly(1); return finite(angle(Math.acos(values[0])));
        case 'atan': exactly(1); return finite(angle(Math.atan(values[0])));
        case 'sinh': exactly(1); return finite(Math.sinh(values[0]));
        case 'cosh': exactly(1); return finite(Math.cosh(values[0]));
        case 'tanh': exactly(1); return finite(Math.tanh(values[0]));
        case 'asinh': exactly(1); return finite(Math.asinh(values[0]));
        case 'acosh': exactly(1); return finite(Math.acosh(values[0]));
        case 'atanh': exactly(1); return finite(Math.atanh(values[0]));
        case 'ln': exactly(1); return finite(Math.log(values[0]));
        case 'log': exactly(1); return finite(Math.log10(values[0]));
        case 'sqrt': exactly(1); return finite(Math.sqrt(values[0]));
        case 'cbrt': exactly(1); return finite(Math.cbrt(values[0]));
        case 'abs': exactly(1); return Math.abs(values[0]);
        case 'exp': exactly(1); return finite(Math.exp(values[0]));
        case 'pow10': exactly(1); return finite(Math.pow(10, values[0]));
        case 'floor': exactly(1); return Math.floor(values[0]);
        case 'ceil': exactly(1); return Math.ceil(values[0]);
        case 'round': exactly(1); return Math.round(values[0]);
        case 'root': exactly(2); return finite(Math.pow(values[0], 1 / values[1]));
        case 'mod': exactly(2); if (values[1] === 0) throw calculatorError('You cannot divide by zero.'); return values[0] % values[1];
        case 'ncr': exactly(2); return combinations(values[0], values[1]);
        case 'npr': exactly(2); return permutations(values[0], values[1]);
        case 'gcd': exactly(2); return greatestCommonDivisor(values[0], values[1]);
        case 'lcm': exactly(2); return leastCommonMultiple(values[0], values[1]);
        case 'min': if (!values.length) throw calculatorError('min needs at least one value.'); return Math.min(...values);
        case 'max': if (!values.length) throw calculatorError('max needs at least one value.'); return Math.max(...values);
        default: throw calculatorError(`I do not recognise the function ${name}.`);
      }
    }
  }

  function evaluate(expression, options) {
    return new ExpressionParser(tokenize(expression), options).parse();
  }

  function formatNumber(value) {
    finite(value);
    if (Object.is(value, -0)) return '0';
    const magnitude = Math.abs(value);
    if (magnitude && (magnitude >= 1e12 || magnitude < 1e-9)) {
      return value.toExponential(10).replace(/(\.\d*?[1-9])0+e/i, '$1e').replace(/\.0+e/i, 'e');
    }
    return String(Number(value.toPrecision(12)));
  }

  function createButton(label, action, value, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `sad-scientific-calculator-key ${extraClass}`.trim();
    button.textContent = label;
    button.dataset.calculatorAction = action;
    if (typeof value === 'string') button.dataset.calculatorValue = value;
    return button;
  }

  function mount(host) {
    if (!(host instanceof HTMLElement)) throw new TypeError('A calculator host is required.');
    if (instances.has(host)) return instances.get(host);

    const state = {
      expression: '',
      answer: 0,
      memory: 0,
      degrees: true,
      justEvaluated: false,
      status: 'Ready'
    };

    host.replaceChildren();
    host.classList.add('sad-scientific-calculator');

    const displayArea = document.createElement('div');
    displayArea.className = 'sad-scientific-calculator-display-area';
    const status = document.createElement('output');
    status.className = 'sad-scientific-calculator-status';
    status.setAttribute('aria-live', 'polite');
    const display = document.createElement('input');
    display.className = 'sad-scientific-calculator-display';
    display.type = 'text';
    display.readOnly = true;
    display.autocomplete = 'off';
    display.spellcheck = false;
    display.setAttribute('aria-label', 'Calculator expression');
    displayArea.append(status, display);

    const grid = document.createElement('div');
    grid.className = 'sad-scientific-calculator-grid';
    const keys = [
      ['DEG', 'angle', '', 'sad-calculator-mode'], ['MC', 'memory-clear'], ['MR', 'memory-recall'], ['M+', 'memory-add'], ['M−', 'memory-subtract'], ['⌫', 'backspace', '', 'sad-calculator-utility'],
      ['sin', 'function', 'sin'], ['cos', 'function', 'cos'], ['tan', 'function', 'tan'], ['ln', 'function', 'ln'], ['log', 'function', 'log'], ['√', 'function', 'sqrt'],
      ['sin⁻¹', 'function', 'asin'], ['cos⁻¹', 'function', 'acos'], ['tan⁻¹', 'function', 'atan'], ['sinh', 'function', 'sinh'], ['cosh', 'function', 'cosh'], ['∛', 'function', 'cbrt'],
      ['x²', 'square'], ['x³', 'cube'], ['xʸ', 'operator', '^'], ['10ˣ', 'function', 'pow10'], ['eˣ', 'function', 'exp'], ['1/x', 'reciprocal'],
      ['(', 'value', '('], [')', 'value', ')'], ['π', 'value', 'pi'], ['e', 'value', 'e'], ['Ans', 'value', 'ans'], ['!', 'value', '!'],
      ['7', 'number', '7'], ['8', 'number', '8'], ['9', 'number', '9'], ['÷', 'operator', '/'], ['mod', 'function', 'mod'], ['nCr', 'function', 'ncr'],
      ['4', 'number', '4'], ['5', 'number', '5'], ['6', 'number', '6'], ['×', 'operator', '*'], ['nPr', 'function', 'npr'], ['root', 'function', 'root'],
      ['1', 'number', '1'], ['2', 'number', '2'], ['3', 'number', '3'], ['−', 'operator', '-'], ['+', 'operator', '+'], ['EXP', 'scientific'],
      ['0', 'number', '0'], ['.', 'number', '.'], [',', 'value', ','], ['±', 'negate'], ['=', 'evaluate', '', 'sad-calculator-equals'], ['AC', 'clear', '', 'sad-calculator-clear']
    ];
    keys.forEach(([label, action, value, extraClass]) => grid.append(createButton(label, action, value, extraClass)));
    host.append(displayArea, grid);

    function refresh() {
      display.value = state.expression || '0';
      display.setAttribute('aria-label', state.expression ? `Calculator expression: ${state.expression}` : 'Calculator expression: 0');
      status.textContent = state.status;
      status.dataset.error = String(state.status.startsWith('Error:'));
      const modeButton = grid.querySelector('[data-calculator-action="angle"]');
      if (modeButton) modeButton.textContent = state.degrees ? 'DEG' : 'RAD';
    }

    function beginNewValue(kind) {
      if (!state.justEvaluated || kind === 'operator' || kind === 'scientific') return;
      state.expression = '';
      state.justEvaluated = false;
    }

    function append(value, kind = 'value') {
      beginNewValue(kind);
      const source = state.expression;
      const isFunction = kind === 'function';
      const startsOperand = kind === 'function' || (kind === 'value' && ['(', 'pi', 'e', 'ans'].includes(value));
      const endsOperand = /(?:\d|\)|!|pi|ans|e)$/i.test(source);
      if (source && startsOperand && endsOperand) state.expression += '*';
      state.expression += isFunction ? `${value}(` : value;
      state.status = 'Ready';
      state.justEvaluated = false;
    }

    function currentValue() {
      return state.expression ? evaluate(state.expression, state) : state.answer;
    }

    function showError(error) {
      state.status = `Error: ${error instanceof Error ? error.message : 'Check the calculation.'}`;
      state.justEvaluated = false;
    }

    function press(action, value) {
      try {
        if (action === 'number' || action === 'value' || action === 'operator' || action === 'function') append(value, action);
        if (action === 'scientific') append('e', 'scientific');
        if (action === 'angle') {
          state.degrees = !state.degrees;
          state.status = state.degrees ? 'Degrees mode' : 'Radians mode';
        }
        if (action === 'backspace') {
          state.expression = state.justEvaluated ? '' : state.expression.slice(0, -1);
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'clear') {
          state.expression = '';
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'negate') {
          state.expression = state.expression ? `-(${state.expression})` : '-';
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'square') {
          if (!state.expression) throw calculatorError('Enter a value first.');
          state.expression = `(${state.expression})^2`;
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'cube') {
          if (!state.expression) throw calculatorError('Enter a value first.');
          state.expression = `(${state.expression})^3`;
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'reciprocal') {
          if (!state.expression) throw calculatorError('Enter a value first.');
          state.expression = `1/(${state.expression})`;
          state.status = 'Ready';
          state.justEvaluated = false;
        }
        if (action === 'memory-clear') {
          state.memory = 0;
          state.status = 'Memory cleared';
        }
        if (action === 'memory-recall') {
          append(formatNumber(state.memory), 'value');
          state.status = 'Memory recalled';
        }
        if (action === 'memory-add' || action === 'memory-subtract') {
          const amount = currentValue();
          state.memory = finite(state.memory + (action === 'memory-add' ? amount : -amount));
          state.status = action === 'memory-add' ? 'Added to memory' : 'Subtracted from memory';
        }
        if (action === 'evaluate') {
          const result = currentValue();
          state.answer = result;
          state.expression = formatNumber(result);
          state.status = `Ans = ${formatNumber(result)}`;
          state.justEvaluated = true;
        }
      } catch (error) {
        showError(error);
      }
      refresh();
      display.focus({ preventScroll: true });
    }

    grid.addEventListener('click', (event) => {
      const button = event.target instanceof Element ? event.target.closest('[data-calculator-action]') : null;
      if (!(button instanceof HTMLElement)) return;
      press(button.dataset.calculatorAction, button.dataset.calculatorValue || '');
    });

    display.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const key = event.key;
      if (/^[0-9.]$/.test(key)) {
        event.preventDefault();
        press('number', key);
      } else if ('+-*/^(),!'.includes(key)) {
        event.preventDefault();
        press(key === ',' || key === '(' || key === ')' || key === '!' ? 'value' : 'operator', key);
      } else if (key === 'Enter' || key === '=') {
        event.preventDefault();
        press('evaluate');
      } else if (key === 'Backspace') {
        event.preventDefault();
        press('backspace');
      } else if (key === 'Escape') {
        event.preventDefault();
        press('clear');
      }
    });

    const instance = {
      focus: () => display.focus({ preventScroll: true }),
      destroy: () => {
        instances.delete(host);
        host.replaceChildren();
        host.classList.remove('sad-scientific-calculator');
      }
    };
    instances.set(host, instance);
    refresh();
    return instance;
  }

  globalThis.SparxAfterDarkScientificCalculator = { mount, evaluate };
})();
