const THEME_DEFAULTS = {
  accent: '#e2b714', background: '#323437', surface: '#2c2e31', text: '#d1d0c5',
  ribbon: '#202124', action: '#2f76d6', correct: '#31cd8c', incorrect: '#c86a70',
  radius: 14, font: 'Nunito Sans, ui-rounded, system-ui, sans-serif', reduceMotion: false
};

const PRACTICE_DEFAULTS = {
  qualification: 'foundation',
  calculator: 'either',
  topics: ['number', 'algebra', 'ratio', 'geometry', 'statistics', 'probability']
};

const topicLabels = {
  number: 'Number', algebra: 'Algebra', ratio: 'Ratio', geometry: 'Geometry',
  statistics: 'Statistics', probability: 'Probability'
};

const $ = id => document.getElementById(id);
const state = { question: null, completed: false, attempts: 0 };

function integer(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(items) {
  return items[integer(0, items.length - 1)];
}

function gcd(a, b) {
  let first = Math.abs(a);
  let second = Math.abs(b);
  while (second) [first, second] = [second, first % second];
  return first || 1;
}

function fraction(numerator, denominator) {
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function fractionText(numerator, denominator) {
  const reduced = fraction(numerator, denominator);
  return `${reduced.numerator}/${reduced.denominator}`;
}

function numericQuestion(prompt, answer, displayAnswer, explanation, hint = 'Enter a number', tolerance = 0.000001) {
  return { prompt, answer, displayAnswer, explanation, hint, tolerance };
}

function generateNumber(qualification, calculator) {
  if (qualification === 'foundation') {
    if (calculator === 'non-calculator') {
      if (Math.random() < 0.5) {
        const first = integer(12, 49);
        const second = integer(3, 9);
        const answer = first * second;
        return numericQuestion(`Work out ${first} × ${second}.`, answer, String(answer), `${first} × ${second} = ${answer}.`);
      }
      const denominator = pick([8, 10, 12, 14, 15, 18, 20]);
      const numerator = integer(2, denominator - 2);
      const answer = fraction(numerator, denominator);
      return numericQuestion(`Write ${numerator}/${denominator} in its simplest form.`, numerator / denominator, `${answer.numerator}/${answer.denominator}`, `Divide the numerator and denominator by ${gcd(numerator, denominator)}.`, 'Enter a fraction, for example 3/4');
    }
    const amount = integer(12, 80) * 10;
    const percentage = pick([5, 10, 15, 20, 25, 30]);
    const answer = amount * percentage / 100;
    return numericQuestion(`Find ${percentage}% of ${amount}.`, answer, String(answer), `${percentage}% means multiply by ${percentage}/100. ${amount} × ${percentage}/100 = ${answer}.`);
  }

  if (calculator === 'non-calculator') {
    const original = integer(4, 18);
    const increase = pick([10, 20, 25, 50]);
    const newValue = original * (1 + increase / 100);
    return numericQuestion(`A number is increased by ${increase}% to give ${newValue}. Find the original number.`, original, String(original), `An increase of ${increase}% uses a multiplier of ${1 + increase / 100}. ${newValue} ÷ ${1 + increase / 100} = ${original}.`);
  }

  const price = integer(250, 950) / 10;
  const reduction = pick([12, 15, 18, 22, 35]);
  const answer = Math.round(price * (1 - reduction / 100) * 100) / 100;
  return numericQuestion(`A price of £${price.toFixed(2)} is reduced by ${reduction}%. What is the new price? Give your answer to 2 decimal places.`, answer, answer.toFixed(2), `A reduction of ${reduction}% leaves ${100 - reduction}%. ${price.toFixed(2)} × ${(1 - reduction / 100).toFixed(2)} = ${answer.toFixed(2)}.`, 'Enter a number, for example 64.50', 0.01);
}

function generateAlgebra(qualification, calculator) {
  if (qualification === 'foundation') {
    if (Math.random() < 0.5) {
      const answer = integer(3, 14);
      const addend = integer(4, 16);
      return numericQuestion(`Solve: x + ${addend} = ${answer + addend}.`, answer, String(answer), `Subtract ${addend} from both sides: x = ${answer + addend} − ${addend} = ${answer}.`);
    }
    const answer = integer(2, calculator === 'calculator' ? 24 : 12);
    const coefficient = integer(2, 9);
    return numericQuestion(`Solve: ${coefficient}x = ${coefficient * answer}.`, answer, String(answer), `Divide both sides by ${coefficient}: x = ${coefficient * answer} ÷ ${coefficient} = ${answer}.`);
  }

  if (Math.random() < 0.5) {
    const answer = integer(3, calculator === 'calculator' ? 18 : 12);
    const leftCoefficient = integer(4, 9);
    const rightCoefficient = integer(1, leftCoefficient - 2);
    const leftConstant = integer(2, 15);
    const rightConstant = (leftCoefficient - rightCoefficient) * answer + leftConstant;
    return numericQuestion(`Solve: ${leftCoefficient}x + ${leftConstant} = ${rightCoefficient}x + ${rightConstant}.`, answer, String(answer), `Move the x terms together: ${leftCoefficient - rightCoefficient}x = ${rightConstant - leftConstant}. Divide by ${leftCoefficient - rightCoefficient}: x = ${answer}.`);
  }

  const answer = integer(2, calculator === 'calculator' ? 18 : 12);
  const coefficient = integer(2, 7);
  const constant = integer(2, 10);
  const total = coefficient * (answer + constant);
  return numericQuestion(`Solve: ${coefficient}(x + ${constant}) = ${total}.`, answer, String(answer), `First divide by ${coefficient}: x + ${constant} = ${total / coefficient}. Then subtract ${constant}: x = ${answer}.`);
}

function generateRatio(qualification, calculator) {
  if (qualification === 'foundation') {
    const firstPart = integer(1, 5);
    const secondPart = integer(2, 7);
    const unit = integer(3, calculator === 'calculator' ? 20 : 12);
    const total = (firstPart + secondPart) * unit;
    const answer = firstPart * unit;
    return numericQuestion(`${total} sweets are shared in the ratio ${firstPart}:${secondPart}. How many sweets does the first person receive?`, answer, String(answer), `There are ${firstPart + secondPart} parts altogether. One part is ${total} ÷ ${firstPart + secondPart} = ${unit}. The first person gets ${firstPart} × ${unit} = ${answer}.`);
  }

  const baseX = calculator === 'calculator' ? integer(12, 40) / 2 : integer(2, 12);
  const multiplier = calculator === 'calculator' ? integer(12, 36) / 10 : integer(2, 8);
  const baseY = baseX * multiplier;
  const targetX = calculator === 'calculator' ? integer(15, 55) / 2 : integer(13, 28);
  const answer = Math.round(targetX * multiplier * 100) / 100;
  return numericQuestion(`y is directly proportional to x. When x = ${baseX}, y = ${baseY}. Find y when x = ${targetX}.`, answer, String(answer), `The constant of proportionality is ${baseY} ÷ ${baseX} = ${multiplier}. So y = ${multiplier} × ${targetX} = ${answer}.`, 'Enter a number', 0.01);
}

function generateGeometry(qualification, calculator) {
  if (qualification === 'foundation') {
    if (Math.random() < 0.5) {
      const width = integer(3, 14);
      const height = integer(4, 18);
      const answer = width * height;
      return numericQuestion(`A rectangle is ${width} cm by ${height} cm. Find its area in cm².`, answer, String(answer), `Area of a rectangle = width × height = ${width} × ${height} = ${answer} cm².`);
    }
    const base = integer(3, 12) * 2;
    const height = integer(3, 15);
    const answer = base * height / 2;
    return numericQuestion(`A triangle has a base of ${base} cm and a perpendicular height of ${height} cm. Find its area in cm².`, answer, String(answer), `Area of a triangle = base × height ÷ 2 = ${base} × ${height} ÷ 2 = ${answer} cm².`);
  }

  if (calculator === 'non-calculator') {
    const triple = pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]]);
    return numericQuestion(`A right-angled triangle has shorter sides of ${triple[0]} cm and ${triple[1]} cm. Find the hypotenuse.`, triple[2], String(triple[2]), `Use Pythagoras: √(${triple[0]}² + ${triple[1]}²) = √${triple[2] ** 2} = ${triple[2]} cm.`);
  }

  const first = integer(5, 13);
  const second = integer(7, 17);
  const answer = Math.round(Math.hypot(first, second) * 10) / 10;
  return numericQuestion(`A right-angled triangle has shorter sides of ${first} cm and ${second} cm. Find the hypotenuse, correct to 1 decimal place.`, answer, answer.toFixed(1), `Use Pythagoras: √(${first}² + ${second}²) = √${first ** 2 + second ** 2} ≈ ${answer.toFixed(1)} cm.`, 'Enter a number to 1 decimal place', 0.05);
}

function generateStatistics(qualification, calculator) {
  if (qualification === 'foundation') {
    const count = 5;
    const mean = integer(4, calculator === 'calculator' ? 22 : 14);
    const values = Array.from({ length: count - 1 }, () => integer(1, mean * 2 - 1));
    const finalValue = mean * count - values.reduce((total, value) => total + value, 0);
    if (finalValue < 1 || finalValue > mean * 3) return generateStatistics(qualification, calculator);
    values.push(finalValue);
    values.sort((first, second) => first - second);
    return numericQuestion(`Find the mean of: ${values.join(', ')}.`, mean, String(mean), `Add the values to get ${mean * count}, then divide by ${count}: ${mean * count} ÷ ${count} = ${mean}.`);
  }

  const scores = [integer(1, 4), integer(5, 8), integer(9, 13)];
  const frequencies = [integer(2, 5), integer(2, 5), integer(2, 5)];
  const totalFrequency = frequencies.reduce((total, value) => total + value, 0);
  const weightedTotal = scores.reduce((total, score, index) => total + score * frequencies[index], 0);
  const answer = weightedTotal / totalFrequency;
  const displayAnswer = Number.isInteger(answer) ? String(answer) : answer.toFixed(2);
  return numericQuestion(`The scores ${scores[0]}, ${scores[1]}, and ${scores[2]} have frequencies ${frequencies[0]}, ${frequencies[1]}, and ${frequencies[2]} respectively. Find the mean score.`, answer, displayAnswer, `Multiply each score by its frequency: ${scores[0]}×${frequencies[0]} + ${scores[1]}×${frequencies[1]} + ${scores[2]}×${frequencies[2]} = ${weightedTotal}. Divide by the total frequency ${totalFrequency}: ${weightedTotal} ÷ ${totalFrequency} = ${displayAnswer}.`, 'Enter a number, rounded to 2 decimal places if needed', 0.01);
}

function generateProbability(qualification) {
  const red = integer(1, qualification === 'foundation' ? 6 : 8);
  const blue = integer(1, qualification === 'foundation' ? 6 : 8);
  const total = red + blue;
  if (qualification === 'foundation') {
    return numericQuestion(`A bag contains ${red} red counters and ${blue} blue counters. One counter is chosen at random. What is the probability it is red?`, red / total, fractionText(red, total), `There are ${total} counters altogether. Probability = favourable outcomes ÷ total outcomes = ${red}/${total} = ${fractionText(red, total)}.`, 'Enter a fraction, for example 3/4');
  }
  const numerator = red * red;
  const denominator = total * total;
  return numericQuestion(`A bag contains ${red} red counters and ${blue} blue counters. A counter is chosen, replaced, then another counter is chosen. What is the probability both counters are red?`, numerator / denominator, fractionText(numerator, denominator), `The probability of red on each draw is ${red}/${total}. With replacement, multiply: ${red}/${total} × ${red}/${total} = ${fractionText(numerator, denominator)}.`, 'Enter a fraction, for example 3/4');
}

const generators = {
  number: generateNumber,
  algebra: generateAlgebra,
  ratio: generateRatio,
  geometry: generateGeometry,
  statistics: generateStatistics,
  probability: generateProbability
};

function calculatorLabel(value) {
  return value === 'calculator' ? 'Calculator' : 'Non-calculator';
}

function qualificationLabel(value) {
  return value === 'higher' ? 'GCSE Higher' : 'GCSE Foundation';
}

function selectedSettings() {
  return {
    qualification: document.querySelector('input[name="qualification"]:checked').value,
    calculator: document.querySelector('input[name="calculator"]:checked').value,
    topics: Array.from(document.querySelectorAll('input[name="topic"]:checked'), input => input.value)
  };
}

function saveSettings(settings) {
  chrome.storage.local.set({ sadPracticeSettings: settings });
}

function applyTheme(settings) {
  const root = document.documentElement;
  root.style.setProperty('--sad-accent', settings.accent);
  root.style.setProperty('--sad-bg', settings.background);
  root.style.setProperty('--sad-surface', settings.surface);
  root.style.setProperty('--sad-text', settings.text);
  root.style.setProperty('--sad-ribbon', settings.ribbon);
  root.style.setProperty('--sad-action', settings.action);
  root.style.setProperty('--sad-correct', settings.correct);
  root.style.setProperty('--sad-incorrect', settings.incorrect);
  root.style.setProperty('--sad-radius', `${settings.radius}px`);
  root.style.setProperty('--sad-font', settings.font);
  document.body.classList.toggle('reduce-motion', Boolean(settings.reduceMotion));
}

function setControls(settings) {
  document.querySelector(`input[name="qualification"][value="${settings.qualification}"]`).checked = true;
  document.querySelector(`input[name="calculator"][value="${settings.calculator}"]`).checked = true;
  document.querySelectorAll('input[name="topic"]').forEach(input => { input.checked = settings.topics.includes(input.value); });
}

function questionFrom(settings) {
  const topic = pick(settings.topics);
  const calculator = settings.calculator === 'either' ? pick(['non-calculator', 'calculator']) : settings.calculator;
  return { ...generators[topic](settings.qualification, calculator), topic, calculator, qualification: settings.qualification };
}

function clearFeedback() {
  const feedback = $('feedback');
  feedback.hidden = true;
  feedback.className = 'feedback';
  feedback.textContent = '';
  $('solution').hidden = true;
  $('explanation').textContent = '';
}

function renderQuestion(question) {
  state.question = question;
  state.completed = false;
  state.attempts = 0;
  $('questionTopic').textContent = topicLabels[question.topic];
  $('questionMode').textContent = calculatorLabel(question.calculator);
  $('questionLevel').textContent = qualificationLabel(question.qualification);
  $('questionText').textContent = question.prompt;
  $('answerHint').textContent = question.hint;
  $('answer').value = '';
  $('answer').disabled = false;
  $('checkAnswer').disabled = false;
  $('revealAnswer').hidden = false;
  clearFeedback();
  $('answer').focus();
}

function createQuestion() {
  const settings = selectedSettings();
  if (!settings.topics.length) {
    $('settingsNotice').textContent = 'Choose at least one topic first.';
    return;
  }
  $('settingsNotice').textContent = '';
  saveSettings(settings);
  renderQuestion(questionFrom(settings));
}

function parseAnswer(value) {
  const clean = value.trim().replace(/[\s,£]/g, '');
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  const fractionMatch = /^(-?\d+)\/(-?\d+)$/.exec(clean);
  if (!fractionMatch || Number(fractionMatch[2]) === 0) return null;
  return Number(fractionMatch[1]) / Number(fractionMatch[2]);
}

function showFeedback(kind, message) {
  const feedback = $('feedback');
  feedback.className = `feedback ${kind}`;
  feedback.textContent = message;
  feedback.hidden = false;
}

function showSolution(prefix) {
  const question = state.question;
  state.completed = true;
  $('answer').disabled = true;
  $('checkAnswer').disabled = true;
  $('revealAnswer').hidden = true;
  showFeedback('incorrect', `${prefix} ${question.displayAnswer}.`);
  $('explanation').textContent = question.explanation;
  $('solution').hidden = false;
}

function checkAnswer() {
  const given = parseAnswer($('answer').value);
  if (given === null || !Number.isFinite(given)) {
    showFeedback('incorrect', 'Enter a number or fraction first, for example 3/4.');
    return;
  }
  if (Math.abs(given - state.question.answer) <= state.question.tolerance) {
    state.completed = true;
    $('answer').disabled = true;
    $('checkAnswer').disabled = true;
    $('revealAnswer').hidden = true;
    showFeedback('correct', 'Correct — nice work.');
    $('explanation').textContent = state.question.explanation;
    $('solution').hidden = false;
    return;
  }
  state.attempts += 1;
  showFeedback('incorrect', state.attempts > 1 ? 'Not quite. Try again, or show the answer when you are ready.' : 'Not quite — have another go, or show the answer.');
}

function restoreSettings(stored) {
  const safeQualification = stored.qualification === 'higher' ? 'higher' : 'foundation';
  const safeCalculator = ['non-calculator', 'calculator', 'either'].includes(stored.calculator) ? stored.calculator : 'either';
  const safeTopics = Array.isArray(stored.topics) ? stored.topics.filter(topic => Object.hasOwn(generators, topic)) : PRACTICE_DEFAULTS.topics;
  return { qualification: safeQualification, calculator: safeCalculator, topics: safeTopics.length ? safeTopics : PRACTICE_DEFAULTS.topics };
}

$('settings').addEventListener('submit', event => {
  event.preventDefault();
  createQuestion();
});

$('settings').addEventListener('change', () => {
  const settings = selectedSettings();
  saveSettings(settings);
  $('settingsNotice').textContent = '';
});

$('answerForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!state.completed) checkAnswer();
});

$('revealAnswer').addEventListener('click', () => showSolution('The answer is'));
$('nextQuestion').addEventListener('click', createQuestion);

chrome.storage.local.get({ ...THEME_DEFAULTS, sadPracticeSettings: PRACTICE_DEFAULTS }, settings => {
  applyTheme(settings);
  setControls(restoreSettings(settings.sadPracticeSettings));
  createQuestion();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const themeKeys = Object.keys(THEME_DEFAULTS);
  if (!themeKeys.some(key => key in changes)) return;
  chrome.storage.local.get(THEME_DEFAULTS, applyTheme);
});
