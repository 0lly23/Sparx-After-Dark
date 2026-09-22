const defaults = { enabled:true, accent:'#e2b714', background:'#323437', surface:'#2c2e31', text:'#d1d0c5', ribbon:'#202124', action:'#2f76d6', correct:'#31cd8c', incorrect:'#c86a70', radius:14, font:'Nunito Sans, ui-rounded, system-ui, sans-serif', compact:false, shadows:true, reduceMotion:false, calmErrors:false, dimImages:true, showCalculatorBadges:false, scientificCalculator:false, scientificCalculatorOnNonCalculator:false, studyGuide:false, answerJournal:false };
const ids = Object.keys(defaults);
const el = id => document.getElementById(id);
// The journal is deliberately local-only, so it is never included in a theme link.
const shareableIds = ids.filter(id => !['enabled', 'scientificCalculator', 'scientificCalculatorOnNonCalculator', 'studyGuide', 'answerJournal'].includes(id));
const presets = {
  monkeytype: { accent:'#e2b714', background:'#323437', surface:'#2c2e31', text:'#d1d0c5', ribbon:'#202124', action:'#2f76d6' },
  navyGold: { accent:'#e2b714', background:'#0f172a', surface:'#172554', text:'#e5e7eb', ribbon:'#0b1120', action:'#3b82f6' },
  ocean: { accent:'#22c55e', background:'#0b1720', surface:'#102a35', text:'#d9f3ee', ribbon:'#071218', action:'#38bdf8' },
  aurora: { accent:'#7dd3fc', background:'#101827', surface:'#172033', text:'#e6edf7', ribbon:'#0a101c', action:'#8b5cf6' },
  amethyst: { accent:'#c084fc', background:'#211a2d', surface:'#2b223b', text:'#f0e8f7', ribbon:'#17111f', action:'#ec4899' }
};

function paint(values) {
  ids.forEach(id => { if (id in values) el(id).type === 'checkbox' ? el(id).checked = values[id] : el(id).value = values[id]; });
  el('radiusValue').textContent = `${el('radius').value}px`;
}
function save(values) {
  chrome.storage.local.set(values, () => {
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
  });
}
chrome.storage.local.get({ ...defaults, preset: 'monkeytype' }, values => {
  paint(values);
  el('preset').value = presets[values.preset] ? values.preset : 'custom';
});
// Saving once when a control is finished avoids Chrome's storage write quota.
ids.forEach(id => el(id).addEventListener('change', () => {
  const value = el(id).type === 'checkbox' ? el(id).checked : (id === 'radius' ? Number(el(id).value) : el(id).value);
  el('preset').value = 'custom';
  save({[id]:value, preset:'custom'});
  if (id === 'radius') el('radiusValue').textContent = `${value}px`;
}));
el('radius').addEventListener('input', () => { el('radiusValue').textContent = `${el('radius').value}px`; });
el('preset').addEventListener('change', () => {
  const name = el('preset').value;
  if (name === 'custom') { save({ preset:'custom' }); return; }
  save({ ...presets[name], preset:name });
  paint(presets[name]);
});
el('reset').addEventListener('click', () => { save({ ...defaults, preset:'monkeytype' }); paint(defaults); el('preset').value = 'monkeytype'; });

function encodeShareCode(values) {
  const theme = Object.fromEntries(shareableIds.map(id => [id, values[id]]));
  const json = JSON.stringify({ v: 1, theme });
  return `SAD1:${btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function decodeShareCode(code) {
  if (!code.startsWith('SAD1:')) throw new Error('That is not a Sparx After Dark code.');
  const raw = code.slice(5).replace(/-/g, '+').replace(/_/g, '/');
  const padded = raw + '='.repeat((4 - raw.length % 4) % 4);
  const payload = JSON.parse(decodeURIComponent(escape(atob(padded))));
  if (payload.v !== 1 || !payload.theme || typeof payload.theme !== 'object') throw new Error('This share code is not supported.');
  return payload.theme;
}

function validatedTheme(theme) {
  const result = {};
  for (const id of shareableIds) {
    const value = theme[id];
    if (typeof value === 'undefined') continue;
    if (['accent', 'background', 'surface', 'text', 'ribbon', 'action', 'correct', 'incorrect'].includes(id)) {
      if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('The colour values in this code are invalid.');
    } else if (id === 'radius') {
      if (!Number.isInteger(value) || value < 4 || value > 28) throw new Error('The roundness value in this code is invalid.');
    } else if (['compact', 'shadows', 'reduceMotion', 'calmErrors', 'dimImages', 'showCalculatorBadges'].includes(id)) {
      if (typeof value !== 'boolean') throw new Error('The toggle values in this code are invalid.');
    } else if (id === 'font' && !Array.from(el('font').options).some(option => option.value === value)) {
      throw new Error('The font in this code is not supported.');
    }
    result[id] = value;
  }
  return result;
}

function setShareStatus(message, isError = false) {
  const status = el('shareStatus');
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    el('shareCode').select();
    return document.execCommand('copy');
  }
}

el('generateCode').addEventListener('click', async () => {
  chrome.storage.local.get(defaults, async values => {
    const code = encodeShareCode(values);
    el('shareCode').value = code;
    setShareStatus(await copyCode(code) ? 'Code copied — send it to a friend.' : 'Code generated — copy it from the box.');
  });
});

el('applyCode').addEventListener('click', () => {
  try {
    const imported = validatedTheme(decodeShareCode(el('shareCode').value.trim()));
    if (!Object.keys(imported).length) throw new Error('This code contains no theme settings.');
    save({ ...imported, preset:'custom' });
    chrome.storage.local.get(defaults, values => paint({ ...values, ...imported }));
    el('preset').value = 'custom';
    setShareStatus('Theme code applied.');
  } catch (error) {
    setShareStatus(error.message || 'Could not apply that code.', true);
  }
});
