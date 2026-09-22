const calculatorDefaults = {
  accent: '#e2b714',
  background: '#323437',
  surface: '#2c2e31',
  text: '#d1d0c5',
  ribbon: '#202124',
  action: '#2f76d6',
  incorrect: '#c86a70',
  radius: 14,
  font: 'Nunito Sans, ui-rounded, system-ui, sans-serif'
};

function applyCalculatorTheme(values) {
  const root = document.documentElement;
  root.style.setProperty('--sad-accent', values.accent);
  root.style.setProperty('--sad-bg', values.background);
  root.style.setProperty('--sad-surface', values.surface);
  root.style.setProperty('--sad-text', values.text);
  root.style.setProperty('--sad-ribbon', values.ribbon);
  root.style.setProperty('--sad-action', values.action);
  root.style.setProperty('--sad-incorrect', values.incorrect);
  root.style.setProperty('--sad-radius', `${values.radius}px`);
  root.style.setProperty('--sad-font', values.font);
}

chrome.storage.local.get(calculatorDefaults, (values) => {
  applyCalculatorTheme(values);
  const host = document.getElementById('sad-study-calculator');
  globalThis.SparxAfterDarkScientificCalculator?.mount(host);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  chrome.storage.local.get(calculatorDefaults, applyCalculatorTheme);
});
