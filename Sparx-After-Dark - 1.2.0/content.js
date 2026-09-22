const DEFAULTS = {
  enabled: true,
  accent: "#e2b714",
  background: "#323437",
  surface: "#2c2e31",
  text: "#d1d0c5",
  ribbon: "#202124",
  action: "#2f76d6",
  correct: "#31cd8c",
  incorrect: "#c86a70",
  radius: 14,
  font: "Nunito Sans, ui-rounded, system-ui, sans-serif",
  compact: false,
  shadows: true,
  reduceMotion: false,
  calmErrors: false,
  dimImages: true,
  showCalculatorBadges: false,
  scientificCalculator: false,
  scientificCalculatorOnNonCalculator: false,
  studyGuide: false,
  answerJournal: false
};

let currentSettings;
let lastUrl = location.href;
let focusEventsBound = false;
const dialogBackdropState = new Map();
const calculatorModesByPath = new Map();
const ANSWER_JOURNAL_KEY = 'sadAnswerJournal';
const ANSWER_JOURNAL_LIMIT = 120;
let answerJournalEntries = [];
let answerJournalOpen = false;
let answerJournalEventsBound = false;
let pendingJournalAttempt = null;
let studyGuideOpen = false;
let studyGuideRoute = null;
let studyGuideManualTopic = null;
let studyGuideAutoTopic = null;
let studyGuideSourceSignature = '';
let answerChoiceEventsBound = false;
const answerChoiceMarkersByRoute = new Map();
let scientificCalculatorOpen = false;
let scientificCalculatorRoute = null;

const ANSWER_CHOICE_CONTAINER_SELECTOR = [
  '[class^="_InlineSlotOptions_"]',
  '[class*=" _InlineSlotOptions_"]',
  '[class^="_SlotOptionsContainer_"]',
  '[class*=" _SlotOptionsContainer_"]',
  '[class*="MultipleChoice" i]',
  '[class*="AnswerOptions" i]',
  '[class*="ChoiceOptions" i]'
].join(', ');

// These are deliberately broad, bundled revision cards rather than a lookup
// of Sparx's opaque question IDs.  A route ID cannot reliably identify a
// topic, while visible wording can make a useful local suggestion.  The text
// is never sent anywhere or stored.
const LOCAL_STUDY_GUIDES = [
  {
    id: 'general',
    title: 'General study moves',
    strapline: 'A calm way to start any question',
    patterns: [],
    minScore: Infinity,
    idea: 'Do not try to see the whole answer at once. Find one fact, choose one rule, then take one small step.',
    steps: [
      'Read the command word: calculate, show, estimate, prove, simplify, or solve.',
      'Underline the numbers, units, or algebra that the question gives you.',
      'Name one rule or formula that might help, then do just its first step.'
    ],
    facts: ['Keep working neat: one operation per line is easier to check.', 'Estimate or substitute back at the end to spot a sign, unit, or arithmetic slip.'],
    trap: 'Do not guess a long answer before you know which rule the question is testing.'
  },
  {
    id: 'bounds',
    title: 'Bounds & accuracy',
    strapline: 'Turn a rounded value into a range',
    patterns: [/\b(?:upper|lower)\s+bounds?\b/i, /\berror interval\b/i, /\btruncat(?:e|ed|ing|ion)?\b/i, /\bround(?:ed|ing)?\b/i, /\bsignificant figures?\b/i, /\bdecimal places?\b/i],
    minScore: 1,
    idea: 'A rounded or truncated value stands for a small interval, not one exact number.',
    steps: [
      'Find the place value of the final stated digit.',
      'Move half of that unit down for the lower bound and up for the upper bound.',
      'Write the range carefully: the lower end is included (≤), but the upper end is not (<).'
    ],
    facts: ['For a value rounded to the nearest unit, the interval is half a unit either side.', 'For truncation, the stated value is the lower end of the interval.'],
    trap: 'The two ends of a rounding interval are not both included.'
  },
  {
    id: 'factorise-expand',
    title: 'Expanding & factorising',
    strapline: 'Build or unpick algebra one part at a time',
    patterns: [/\bfactoris(?:e|ed|ing|ation)\b/i, /\bexpand(?:ed|ing)?\b/i, /\bbrackets?\b/i, /\bcommon factor\b/i, /\bquadratic\b/i, /\bproduct of\b/i],
    minScore: 1,
    idea: 'Expanding multiplies every term through; factorising reverses that process by finding shared structure.',
    steps: [
      'For expanding, multiply each term in the first bracket by every term in the second.',
      'For factorising, first take out any common numerical or algebraic factor.',
      'Check by expanding your final factors back out.'
    ],
    facts: ['Keep powers in descending order so patterns are easier to spot.', 'For a quadratic, the middle term is often checked using the sum and product of two numbers.'],
    trap: 'A factor outside a bracket must multiply every term inside it.'
  },
  {
    id: 'equations',
    title: 'Equations & inequalities',
    strapline: 'Keep both sides balanced',
    patterns: [/\bsolve\b/i, /\bequations?\b/i, /\binequalit(?:y|ies)\b/i, /\brearrang(?:e|ing)\b/i, /\bsubstitut(?:e|ing|ion)\b/i, /\bmake\s+.+\s+the subject\b/i],
    minScore: 1,
    idea: 'An equation says both sides have the same value. Whatever you do to one side, do to the other.',
    steps: [
      'Simplify each side first if you can.',
      'Undo operations in reverse order to isolate the unknown.',
      'Substitute your result back into the original equation to check it.'
    ],
    facts: ['Multiplying or dividing an inequality by a negative reverses its sign.', 'Writing the same operation on both sides prevents hidden mistakes.'],
    trap: 'Do not move a term across the equals sign without changing it by an actual operation.'
  },
  {
    id: 'fractions',
    title: 'Fractions & algebraic fractions',
    strapline: 'Work with the whole fraction, not separate pieces',
    patterns: [/\bfractions?\b/i, /\bnumerator\b/i, /\bdenominator\b/i, /\bsimplif(?:y|ied|ying)\b/i, /\bequivalent fractions?\b/i, /\bcancel(?:ling|led)?\b/i],
    minScore: 1,
    idea: 'A fraction is one value. Keep its numerator and denominator grouped until you have a valid reason to simplify.',
    steps: [
      'For addition or subtraction, make denominators match first.',
      'For multiplication, multiply across then cancel common factors.',
      'For division, multiply by the reciprocal of the second fraction.'
    ],
    facts: ['You can cancel factors, not terms joined by + or −.', 'Factorise algebraic numerators and denominators before looking to cancel.'],
    trap: 'Never cancel across an addition or subtraction sign.'
  },
  {
    id: 'indices',
    title: 'Indices, roots & standard form',
    strapline: 'Use the rule that matches the operation',
    patterns: [/\bindex\b/i, /\bindices\b/i, /\bpowers?\b/i, /\bexponents?\b/i, /\bstandard form\b/i, /\bsurds?\b/i, /\bsquare root\b/i],
    minScore: 1,
    idea: 'Index laws depend on the operation: multiplication, division, and powers of powers each have their own rule.',
    steps: [
      'Write the bases clearly and make sure they match before combining powers.',
      'Choose the matching law: add powers when multiplying, subtract when dividing.',
      'For roots or fractional powers, translate slowly between root and power notation.'
    ],
    facts: ['A negative power means reciprocal, not a negative answer.', 'In standard form, the first number is at least 1 and less than 10.'],
    trap: 'Do not add powers when adding ordinary terms.'
  },
  {
    id: 'ratio-percentages',
    title: 'Ratio, proportion & percentages',
    strapline: 'Keep the multiplier and units visible',
    patterns: [/\bratio\b/i, /\bproportion(?:al)?\b/i, /\bdirectly proportional\b/i, /\binverse(?:ly)? proportional\b/i, /\bpercent(?:age)?\b/i, /\bdiscount\b/i, /\bincrease\b/i, /\bdecrease\b/i, /\bshare\b/i],
    minScore: 1,
    idea: 'Most ratio and percentage questions are about one consistent scale factor or multiplier.',
    steps: [
      'Write what one part, 1%, or one unit is worth before scaling up.',
      'Use a multiplier for percentage change rather than adding a percentage number directly.',
      'Check the direction: an increase should make the value larger; a decrease should make it smaller.'
    ],
    facts: ['For reverse percentages, divide by the change multiplier to find the original.', 'Ratios must compare quantities in the same units.'],
    trap: 'A percentage decrease followed by the same percentage increase does not usually return to the start.'
  },
  {
    id: 'angles',
    title: 'Angles & circle theorems',
    strapline: 'Name the rule before calculating',
    patterns: [/\bangles?\b/i, /\bparallel\b/i, /\bpolygon\b/i, /\bcircle\b/i, /\btangent\b/i, /\bchord\b/i, /\bcircumference\b/i, /\bcyclic\b/i],
    minScore: 1,
    idea: 'Geometry is easier when every known angle is labelled and each step names one reason.',
    steps: [
      'Mark all given angles and any equal angles you can see.',
      'Choose one matching rule: straight line, around a point, parallel lines, or a circle theorem.',
      'Write the rule beside your calculation before moving on.'
    ],
    facts: ['A radius meets a tangent at 90°.', 'Opposite angles in a cyclic quadrilateral add to 180°.'],
    trap: 'Do not use a circle theorem until you have checked its diagram condition is present.'
  },
  {
    id: 'measures',
    title: 'Area, surface area & volume',
    strapline: 'Match the formula to the shape and units',
    patterns: [/\barea\b/i, /\bperimeter\b/i, /\bvolume\b/i, /\bsurface area\b/i, /\bcube\b/i, /\bcylinder\b/i, /\bprism\b/i, /\bcone\b/i],
    minScore: 1,
    idea: 'Choose the quantity first: length, area, surface area, or volume. Their units tell you if the result makes sense.',
    steps: [
      'Sketch or label the dimensions you have been given.',
      'Write the formula before putting in numbers.',
      'Keep the correct units and make a quick size check at the end.'
    ],
    facts: ['Area uses square units; volume uses cubic units.', 'For compound shapes, split into familiar pieces and add or subtract their measures.'],
    trap: 'Do not mix a sloping length with a perpendicular height unless the formula asks for it.'
  },
  {
    id: 'graphs',
    title: 'Graphs & estimating area',
    strapline: 'Read axes carefully, then use the graph’s meaning',
    patterns: [/\bgradient\b/i, /\bintercept\b/i, /\bgraph\b/i, /\bvelocity\b/i, /\bdistance.?time\b/i, /\bline of best fit\b/i, /\bestimate.*area\b/i],
    minScore: 1,
    idea: 'A graph is a relationship. Start by checking both axes and what an area or gradient represents in context.',
    steps: [
      'Read the scale on each axis before taking any values.',
      'For area estimates, split the region into simple strips or shapes.',
      'State whether your estimate is likely high or low by comparing the shapes with the curve.'
    ],
    facts: ['On a velocity–time graph, area represents distance travelled.', 'Gradient means change in vertical value divided by change in horizontal value.'],
    trap: 'Do not assume every graph’s area or gradient means the same thing without reading the axis labels.'
  },
  {
    id: 'pythagoras-trig',
    title: 'Pythagoras & trigonometry',
    strapline: 'Label the triangle before choosing a formula',
    patterns: [/\bpythagoras\b/i, /\bhypotenuse\b/i, /\bright.?angled\b/i, /\bsine\b/i, /\bcosine\b/i, /\btangent\b/i, /\bsohcahtoa\b/i],
    minScore: 1,
    idea: 'The right formula comes from the sides you know and the side or angle you need.',
    steps: [
      'Mark the right angle and the hypotenuse first.',
      'Label the other sides relative to the angle you are using: opposite and adjacent.',
      'Choose Pythagoras or SOHCAHTOA, then substitute with units.'
    ],
    facts: ['The hypotenuse is always opposite the right angle and is the longest side.', 'Check calculator angle mode when a trigonometry question expects degrees.'],
    trap: 'Opposite and adjacent change when you change the chosen angle.'
  },
  {
    id: 'sequences',
    title: 'Sequences',
    strapline: 'Describe the pattern, then test the rule',
    patterns: [/\bsequences?\b/i, /\bnth\b/i, /\bterm\b/i, /\barithmetic\b/i, /\bgeometric\b/i, /\bnext number\b/i],
    minScore: 1,
    idea: 'A sequence rule must work for every term, not just the first two.',
    steps: [
      'Find the difference or multiplier between consecutive terms.',
      'Use the term number n in your rule and keep the order of operations clear.',
      'Test your rule with an early term and a later term.'
    ],
    facts: ['Arithmetic sequences have a constant difference.', 'Geometric sequences have a constant multiplier.'],
    trap: 'A rule that fits only one term is not enough evidence.'
  },
  {
    id: 'statistics',
    title: 'Statistics & data',
    strapline: 'Use the right summary for the data',
    patterns: [/\bmean\b/i, /\bmedian\b/i, /\bmode\b/i, /\brange\b/i, /\bfrequency\b/i, /\bhistogram\b/i, /\bquartile\b/i, /\bscatter\b/i],
    minScore: 1,
    idea: 'First identify the data type and what the question wants you to describe: centre, spread, comparison, or trend.',
    steps: [
      'Organise the values or table before calculating.',
      'Use the definition of the requested measure exactly.',
      'Check whether an outlier changes what a fair conclusion should say.'
    ],
    facts: ['The median needs data in order.', 'For grouped data, estimates use class midpoints or interpolation as appropriate.'],
    trap: 'Do not confuse frequency density with frequency on a histogram.'
  },
  {
    id: 'probability',
    title: 'Probability',
    strapline: 'List outcomes before doing the arithmetic',
    patterns: [/\bprobability\b/i, /\brandom\b/i, /\blikely\b/i, /\boutcomes?\b/i, /\btree diagram\b/i, /\bsample space\b/i],
    minScore: 1,
    idea: 'Probability works best when the possible outcomes are clear and the events are labelled.',
    steps: [
      'List or draw the possible outcomes first.',
      'Use multiply along branches and add across separate outcomes.',
      'Check that a single probability is between 0 and 1.'
    ],
    facts: ['For mutually exclusive events, add probabilities.', 'For independent events, multiply probabilities.'],
    trap: 'Do not add probabilities for outcomes that must happen together.'
  }
];

const LOCAL_STUDY_GUIDES_BY_ID = new Map(LOCAL_STUDY_GUIDES.map((guide) => [guide.id, guide]));

const STUDY_GUIDE_QUESTION_SELECTOR = [
  '[class^="_QuestionScrollableContent_"]',
  '[class*=" _QuestionScrollableContent_"]',
  '[class^="_QuestionContent_"]',
  '[class*=" _QuestionContent_"]',
  '[class^="_QuestionContainer_"]',
  '[class*=" _QuestionContainer_"]'
].join(', ');

function restoreDialogBackdrop(element, snapshot) {
  for (const [property, previous] of Object.entries(snapshot.styles)) {
    if (previous.value) {
      element.style.setProperty(property, previous.value, previous.priority);
    } else {
      element.style.removeProperty(property);
    }
  }
  if (!snapshot.hadBackdropClass) element.classList.remove('sad-dialog-backdrop');
}

function clearDialogBackdrops(keep = new Set()) {
  dialogBackdropState.forEach((snapshot, element) => {
    if (keep.has(element) && element.isConnected) return;
    restoreDialogBackdrop(element, snapshot);
    dialogBackdropState.delete(element);
  });

  // Recover gracefully from the earlier version, which could leave its
  // generated class and inline styles on a closed overlay after an extension
  // reload.  The class is ours, so it is safe to remove these old values.
  if (!keep.size) {
    document.querySelectorAll('.sad-dialog-backdrop').forEach((element) => {
      if (dialogBackdropState.has(element)) return;
      ['background', 'background-color', 'background-image', 'opacity'].forEach((property) => {
        element.style.removeProperty(property);
      });
      element.classList.remove('sad-dialog-backdrop');
    });
  }
}

function styleDialogBackdrop(element) {
  if (!dialogBackdropState.has(element)) {
    const properties = ['background', 'background-color', 'background-image', 'opacity'];
    dialogBackdropState.set(element, {
      hadBackdropClass: element.classList.contains('sad-dialog-backdrop'),
      styles: Object.fromEntries(properties.map((property) => [property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      }]))
    });
  }

  element.classList.add('sad-dialog-backdrop');
  element.style.setProperty('background', 'rgba(8, 11, 15, .68)', 'important');
  element.style.setProperty('background-color', 'rgba(8, 11, 15, .68)', 'important');
  element.style.setProperty('background-image', 'none', 'important');
  element.style.setProperty('opacity', '1', 'important');
}

function isOpenDialog(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.matches('[aria-hidden="true"], [data-state="closed"]')) return false;
  if (element.closest('[aria-hidden="true"], [data-state="closed"]')) return false;
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && box.width > 0 && box.height > 0;
}

function polishBookworkCheck() {
  const selector = '[role="dialog"], [role="menu"], [class*="DialogContent" i], [class*="PopoverContent" i]';
  document.querySelectorAll(`${selector}, .sad-bookwork-check`).forEach((surface) => {
    if (!(surface instanceof HTMLElement)) return;
    if (!currentSettings?.enabled) {
      surface.classList.remove('sad-bookwork-check');
      return;
    }
    const description = `${surface.getAttribute('aria-label') || ''} ${surface.className || ''} ${surface.textContent || ''}`;
    const isBookworkCheck = /\b(?:bookwork\s*(?:check|code)|check\s+(?:your\s+)?bookwork)\b/i.test(description);
    surface.classList.toggle('sad-bookwork-check', isBookworkCheck);
  });
}

function polishDialogBackdrops() {
  if (!currentSettings?.enabled) {
    clearDialogBackdrops();
    return;
  }
  const dialogs = [...document.querySelectorAll('[role="dialog"], [class*="DialogContent" i]')]
    .filter(isOpenDialog);
  if (!dialogs.length) {
    clearDialogBackdrops();
    return;
  }

  // Sparx has two backdrop implementations.  Video support uses a separate
  // ColourOverlay layer, which can carry an inline white background, while
  // other dialogs use DialogOverlay.  Include both rather than assuming one.
  const candidates = new Set(document.querySelectorAll(
    '[data-radix-dialog-overlay], [class*="DialogOverlay" i], [class*="ColourOverlay" i], [class*="ColorOverlay" i], [id*="ColourOverlay" i], [id*="ColorOverlay" i]'
  ));
  dialogs.forEach((dialog) => {
    if (dialog.previousElementSibling) candidates.add(dialog.previousElementSibling);
    if (dialog.parentElement?.previousElementSibling) candidates.add(dialog.parentElement.previousElementSibling);
  });

  const activeBackdrops = new Set();
  candidates.forEach((candidate) => {
    if (!(candidate instanceof HTMLElement) || candidate.matches('[role="dialog"]')) return;
    const box = candidate.getBoundingClientRect();
    if (box.width < innerWidth * .8 || box.height < innerHeight * .8) return;
    activeBackdrops.add(candidate);
    styleDialogBackdrop(candidate);
  });
  clearDialogBackdrops(activeBackdrops);

  // The support preview sometimes uses a white play circle baked into its
  // thumbnail.  Mark just its large preview wrapper so CSS can place a small,
  // consistent control above it without affecting normal images or buttons.
  dialogs.forEach((dialog) => {
    dialog.querySelectorAll('img, video').forEach((media) => {
      const box = media.getBoundingClientRect();
      if (box.width < 140 || box.height < 80) return;
      const wrapper = media.parentElement;
      if (!(wrapper instanceof HTMLElement)) return;
      const wrapperBox = wrapper.getBoundingClientRect();
      if (wrapperBox.width < box.width * .9 || wrapperBox.height < box.height * .9) return;
      wrapper.classList.add('sad-video-preview');
    });
  });
}

function isQuestionPage() {
  // Homework uses /student/package/... while Personal Practice and Independent
  // Learning add route segments before /package/.
  return /^\/student\/(?:[^/]+\/)*package\/[^/]+\/task\/[^/]+\/item\/[^/]+\/?$/i.test(location.pathname);
}

function isVisibleOnPage(element) {
  if (!(element instanceof Element)) return false;
  if (element.closest('[aria-hidden="true"], [data-state="closed"]')) return false;
  const style = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && box.width > 0 && box.height > 0;
}

function readVisibleCalculatorMode() {
  if (!isQuestionPage()) return null;
  const candidates = document.querySelectorAll(
    '[class*="calculator" i], [aria-label*="calculator" i], [title*="calculator" i], [alt*="calculator" i]'
  );

  for (const candidate of candidates) {
    // A badge we added also contains "calculator" in its class, title, and
    // accessible label. Never allow it to become the source of truth on the
    // next React mutation, otherwise one old badge can label every tab.
    if (candidate.closest('.sad-calculator-badge, #sad-answer-journal-panel, #sad-question-focus-button, #sad-scientific-calculator-panel, #sad-scientific-calculator-toggle, #sad-study-guide-panel, #sad-study-guide-button')) continue;
    if (!isVisibleOnPage(candidate)) continue;
    const parent = candidate.parentElement;
    const description = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.getAttribute('alt'),
      candidate.textContent,
      parent?.getAttribute('aria-label'),
      parent?.textContent
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

    if (/\bcalculator\b[\s:-]*(?:is\s*)?not\s*(?:allowed|permitted)\b/i.test(description)) return 'non-calculator';
    if (/\bcalculator\b[\s:-]*(?:is\s*)?(?:allowed|permitted)\b/i.test(description)) return 'calculator';
  }
  return null;
}

function questionRouteKey(href = location.href) {
  try {
    const url = new URL(href, location.href);
    return `${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function taskItemPath(link) {
  const href = link.getAttribute('href');
  const key = href ? questionRouteKey(href) : null;
  return key && /^\/student\/(?:[^/]+\/)*package\/[^/]+\/task\/[^/]+\/item\/[^/?#]+(?:[?#].*)?$/i.test(key) ? key : null;
}

function clearCalculatorBadges() {
  document.querySelectorAll('.sad-calculator-badge').forEach((badge) => badge.remove());
}

function setCalculatorBadge(link, mode) {
  const existing = link.querySelector(':scope > .sad-calculator-badge');
  if (!mode) {
    existing?.remove();
    return;
  }

  const label = mode === 'calculator' ? 'Calculator allowed' : 'Calculator not allowed';
  const badge = existing || document.createElement('span');
  if (!existing) {
    badge.className = 'sad-calculator-badge';
    badge.setAttribute('role', 'img');
    link.append(badge);
  }
  badge.dataset.mode = mode;
  badge.setAttribute('aria-label', label);
  badge.title = label;
}

function syncCalculatorBadges() {
  const root = document.documentElement;
  const available = Boolean(currentSettings?.enabled && currentSettings?.showCalculatorBadges && isQuestionPage());
  root.classList.toggle('sad-show-calculator-badges', available);
  if (!available) {
    calculatorModesByPath.clear();
    clearCalculatorBadges();
    return;
  }

  const currentPath = questionRouteKey();
  const currentMode = readVisibleCalculatorMode();
  if (currentMode) calculatorModesByPath.set(currentPath, currentMode);
  else calculatorModesByPath.delete(currentPath);

  document.querySelectorAll('[class^="_TaskItemLink_"], [class*=" _TaskItemLink_"]').forEach((link) => {
    const path = taskItemPath(link);
    setCalculatorBadge(link, path && calculatorModesByPath.has(path) ? calculatorModesByPath.get(path) : null);
  });
}

function normaliseJournalText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function localTextSignature(value) {
  // Keep only a short checksum in memory, never the page wording itself.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${hash >>> 0}`;
}

function getLocalStudyGuideQuestionText() {
  const candidates = [...document.querySelectorAll(STUDY_GUIDE_QUESTION_SELECTOR)].filter(isVisibleOnPage);
  for (const candidate of candidates) {
    const copy = candidate.cloneNode(true);
    copy.querySelectorAll([
      ANSWER_CHOICE_CONTAINER_SELECTOR,
      '[class*="AnswerScreen" i]',
      '[class*="AnswerPart" i]',
      '[class*="AnswerArea" i]',
      'input, textarea, select, math-field, [contenteditable="true"], button',
      '[id^="sad-"]'
    ].join(', ')).forEach((element) => element.remove());
    const text = normaliseJournalText(copy.textContent, 1200);
    if (text) return text;
  }
  return '';
}

function detectLocalStudyGuideTopic() {
  const sourceText = getLocalStudyGuideQuestionText();
  const signature = sourceText ? localTextSignature(sourceText) : '';
  if (signature === studyGuideSourceSignature) return studyGuideAutoTopic;

  studyGuideSourceSignature = signature;
  let bestGuide = null;
  let bestScore = 0;
  for (const guide of LOCAL_STUDY_GUIDES) {
    if (guide.id === 'general') continue;
    const score = guide.patterns.reduce((total, pattern) => total + Number(pattern.test(sourceText)), 0);
    if (score >= guide.minScore && score > bestScore) {
      bestGuide = guide;
      bestScore = score;
    }
  }
  studyGuideAutoTopic = bestGuide?.id || null;
  return studyGuideAutoTopic;
}

function createStudyGuideTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderLocalStudyGuide(panel, { rescan = false } = {}) {
  if (!(panel instanceof HTMLElement)) return;
  if (rescan) detectLocalStudyGuideTopic();

  const suggestedGuide = studyGuideAutoTopic ? LOCAL_STUDY_GUIDES_BY_ID.get(studyGuideAutoTopic) : null;
  const selectedGuide = studyGuideManualTopic ? LOCAL_STUDY_GUIDES_BY_ID.get(studyGuideManualTopic) : null;
  const guide = selectedGuide || suggestedGuide || LOCAL_STUDY_GUIDES_BY_ID.get('general');
  const hasVisibleQuestionText = Boolean(studyGuideSourceSignature);
  const stateKey = [
    studyGuideRoute || '',
    studyGuideManualTopic || '',
    studyGuideAutoTopic || '',
    hasVisibleQuestionText ? 'source' : 'empty'
  ].join('|');
  if (panel.dataset.guideState === stateKey) return;
  panel.dataset.guideState = stateKey;
  panel.replaceChildren();

  const header = createStudyGuideTextElement('div', 'sad-study-guide-header');
  const headingWrap = createStudyGuideTextElement('div');
  const title = createStudyGuideTextElement('h2', '', 'Study guide');
  const privacy = createStudyGuideTextElement('p', 'sad-study-guide-privacy', 'Local hints only · nothing leaves your browser');
  headingWrap.append(title, privacy);
  const close = createStudyGuideTextElement('button', 'sad-study-guide-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close study guide');
  close.addEventListener('click', () => setLocalStudyGuideOpen(false));
  header.append(headingWrap, close);

  const line = createStudyGuideTextElement('div', 'sad-study-guide-line');
  const match = createStudyGuideTextElement('p', 'sad-study-guide-match');
  if (selectedGuide) {
    match.textContent = `Your topic: ${selectedGuide.title}`;
  } else if (suggestedGuide) {
    match.textContent = `Suggested from the wording: ${suggestedGuide.title}`;
  } else if (hasVisibleQuestionText) {
    match.textContent = 'Choose a topic for a focused guide.';
  } else {
    match.textContent = 'Question wording is still loading — choose a topic or try again.';
  }

  const topicLabel = createStudyGuideTextElement('label', 'sad-study-guide-topic-label', 'Topic');
  const topicSelect = document.createElement('select');
  topicSelect.className = 'sad-study-guide-topic-select';
  topicSelect.setAttribute('aria-label', 'Choose a study guide topic');
  const automatic = document.createElement('option');
  automatic.value = '';
  automatic.textContent = suggestedGuide ? `Suggested: ${suggestedGuide.title}` : 'Choose a topic';
  topicSelect.append(automatic);
  LOCAL_STUDY_GUIDES.filter((item) => item.id !== 'general').forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.title;
    topicSelect.append(option);
  });
  topicSelect.value = selectedGuide?.id || '';
  topicSelect.addEventListener('change', () => {
    studyGuideManualTopic = topicSelect.value || null;
    renderLocalStudyGuide(panel, { rescan: !studyGuideManualTopic });
  });
  topicLabel.append(topicSelect);

  const card = createStudyGuideTextElement('article', 'sad-study-guide-card');
  const cardTitle = createStudyGuideTextElement('h3', '', guide.title);
  const strapline = createStudyGuideTextElement('p', 'sad-study-guide-strapline', guide.strapline);
  const ideaTitle = createStudyGuideTextElement('h4', '', 'The big idea');
  const idea = createStudyGuideTextElement('p', 'sad-study-guide-idea', guide.idea);
  const stepsTitle = createStudyGuideTextElement('h4', '', 'Try this first');
  const steps = createStudyGuideTextElement('ol', 'sad-study-guide-steps');
  guide.steps.forEach((step) => steps.append(createStudyGuideTextElement('li', '', step)));
  card.append(cardTitle, strapline, ideaTitle, idea, stepsTitle, steps);

  const details = document.createElement('details');
  details.className = 'sad-study-guide-details';
  const summary = createStudyGuideTextElement('summary', '', 'Useful facts & a common trap');
  const facts = createStudyGuideTextElement('ul', 'sad-study-guide-facts');
  guide.facts.forEach((fact) => facts.append(createStudyGuideTextElement('li', '', fact)));
  const trap = createStudyGuideTextElement('p', 'sad-study-guide-trap');
  const trapLabel = createStudyGuideTextElement('strong', '', 'Watch out: ');
  trap.append(trapLabel, document.createTextNode(guide.trap));
  details.append(summary, facts, trap);
  card.append(details);

  const footer = createStudyGuideTextElement('p', 'sad-study-guide-footer', 'Use this to choose your next step — it does not read, fill, or submit an answer.');
  panel.append(header, line, match, topicLabel, card, footer);
}

function setLocalStudyGuideOpen(open) {
  const root = document.documentElement;
  const button = document.getElementById('sad-study-guide-button');
  const panel = document.getElementById('sad-study-guide-panel');
  const available = Boolean(panel && root.classList.contains('sad-study-guide-available'));
  studyGuideOpen = Boolean(open && available);
  root.classList.toggle('sad-study-guide-open', studyGuideOpen);
  if (panel) panel.hidden = !studyGuideOpen;
  if (button) {
    button.setAttribute('aria-expanded', String(studyGuideOpen));
    button.setAttribute('aria-label', studyGuideOpen ? 'Close study guide' : 'Open study guide');
    button.title = studyGuideOpen ? 'Close study guide' : 'Open study guide';
  }
  if (!studyGuideOpen) return;

  if (answerJournalOpen) setAnswerJournalOpen(false);
  renderLocalStudyGuide(panel, { rescan: true });
  // A question can finish rendering just after the learner opens the guide.
  // Refresh twice while it is open, without observing or storing its content.
  [250, 900].forEach((delay) => setTimeout(() => {
    if (!studyGuideOpen || questionRouteKey() !== studyGuideRoute) return;
    renderLocalStudyGuide(panel, { rescan: true });
  }, delay));
}

function mountLocalStudyGuide() {
  const root = document.documentElement;
  const existingButton = document.getElementById('sad-study-guide-button');
  const existingPanel = document.getElementById('sad-study-guide-panel');
  const route = questionRouteKey();
  if (route !== studyGuideRoute) {
    studyGuideRoute = route;
    studyGuideOpen = false;
    studyGuideManualTopic = null;
    studyGuideAutoTopic = null;
    studyGuideSourceSignature = '';
  }

  const available = Boolean(root.classList.contains('sad-enabled') && currentSettings?.studyGuide && isQuestionPage());
  root.classList.toggle('sad-study-guide-available', available);
  if (available && !document.body) {
    setTimeout(mountLocalStudyGuide, 50);
    return;
  }
  if (!available) {
    studyGuideOpen = false;
    root.classList.remove('sad-study-guide-open');
    existingButton?.remove();
    existingPanel?.remove();
    return;
  }

  let button = existingButton;
  let panel = existingPanel;
  if (!button) {
    button = document.createElement('button');
    button.id = 'sad-study-guide-button';
    button.type = 'button';
    button.setAttribute('aria-controls', 'sad-study-guide-panel');
    button.addEventListener('click', () => setLocalStudyGuideOpen(!studyGuideOpen));
    document.body.append(button);
  }
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'sad-study-guide-panel';
    panel.setAttribute('aria-label', 'Local study guide');
    document.body.append(panel);
  }
  renderLocalStudyGuide(panel);
  setLocalStudyGuideOpen(studyGuideOpen);
}

function currentQuestionLabel() {
  const currentPath = questionRouteKey();
  const link = [...document.querySelectorAll('[class^="_TaskItemLink_"], [class*=" _TaskItemLink_"]')]
    .find((item) => taskItemPath(item) === currentPath);
  if (link) {
    const copy = link.cloneNode(true);
    copy.querySelectorAll('svg, .sad-calculator-badge, [aria-hidden="true"]').forEach((element) => element.remove());
    const label = normaliseJournalText(copy.textContent, 40);
    if (label) return label;
  }
  const item = location.pathname.match(/\/item\/([^/]+)\/?$/i)?.[1];
  return item ? `Item ${item}` : 'Question';
}

function answerControlRoot() {
  const roots = [...document.querySelectorAll(
    '[class*="AnswerScreen" i], [class*="AnswerPart" i], [class*="AnswerArea" i]'
  )].filter(isVisibleOnPage);
  return roots.find((root) => root.querySelector('input, textarea, select, [contenteditable="true"], math-field')) || roots[0] || null;
}

function answerLabelFor(control) {
  const id = control.getAttribute('id');
  const associatedLabel = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
  return normaliseJournalText(
    associatedLabel?.textContent || control.closest('label')?.textContent || control.getAttribute('aria-label') || '',
    96
  );
}

function snapshotAnswerSummary() {
  const root = answerControlRoot();
  if (!root) {
    return { answerSummary: 'Visual or interactive answer — not stored', answerType: 'complex' };
  }

  const entries = [];
  const controls = root.querySelectorAll('input, textarea, select, [contenteditable="true"], math-field');
  controls.forEach((control) => {
    if (!isVisibleOnPage(control) || control.matches('[type="hidden"], [type="password"], [type="button"], [type="submit"], [type="reset"], [type="file"], [type="image"]')) return;
    if (control instanceof HTMLInputElement && ['radio', 'checkbox'].includes(control.type)) {
      if (!control.checked) return;
      const label = answerLabelFor(control);
      entries.push(label ? `Selected: ${label}` : 'Selected option');
      return;
    }

    const value = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement
      ? control.value
      : control instanceof HTMLElement && control.isContentEditable
        ? control.textContent
        : control.value;
    const text = normaliseJournalText(value, 120);
    if (text) entries.push(text);
  });

  const uniqueEntries = [...new Set(entries)];
  if (uniqueEntries.length) {
    return { answerSummary: normaliseJournalText(uniqueEntries.join(' · ')), answerType: 'text' };
  }
  return { answerSummary: 'Visual or interactive answer — not stored', answerType: 'complex' };
}

function readVisibleResult() {
  const candidates = document.querySelectorAll(
    '#RESULT-POPOVER, [id*="RESULT-POPOVER" i], [class*="ResultInfoWrapper" i], [class*="ResultInfo" i], [class*="Messages" i][class*="Correct" i], [class*="Messages" i][class*="Incorrect" i]'
  );
  for (const candidate of candidates) {
    if (candidate.closest('#sad-answer-journal-panel')) continue;
    if (!isVisibleOnPage(candidate)) continue;
    const text = normaliseJournalText(candidate.textContent, 240);
    if (/\b(?:incorrect|not\s+quite|try\s+again)\b/i.test(text)) {
      return { element: candidate, result: 'incorrect', signature: `incorrect:${text}` };
    }
    if (/\b(?:correct|well\s+done|good\s+work)\b/i.test(text)) {
      return { element: candidate, result: 'correct', signature: `correct:${text}` };
    }
  }
  return null;
}

function journalStorageEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const timestamp = Number(value.timestamp);
  const result = value.result === 'correct' || value.result === 'incorrect' ? value.result : null;
  const question = normaliseJournalText(value.question, 40);
  const answerSummary = normaliseJournalText(value.answerSummary, 180);
  const path = typeof value.path === 'string' ? value.path : '';
  if (!Number.isFinite(timestamp) || !result || !question || !answerSummary || !path) return null;
  return {
    id: typeof value.id === 'string' ? value.id : `${timestamp}-${path}`,
    timestamp,
    result,
    question,
    answerSummary,
    answerType: value.answerType === 'text' ? 'text' : 'complex',
    path
  };
}

function loadAnswerJournal(value) {
  answerJournalEntries = Array.isArray(value)
    ? value.map(journalStorageEntry).filter(Boolean).slice(0, ANSWER_JOURNAL_LIMIT)
    : [];
  renderAnswerJournal();
}

function saveAnswerJournalEntry(entry) {
  answerJournalEntries = [entry, ...answerJournalEntries].slice(0, ANSWER_JOURNAL_LIMIT);
  chrome.storage.local.set({ [ANSWER_JOURNAL_KEY]: answerJournalEntries }, () => {
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
  });
  renderAnswerJournal();
}

function schedulePendingJournalChecks(attempt) {
  [0, 100, 300, 800, 1600, 3200, 6500, 10000, 14000].forEach((delay) => {
    setTimeout(() => {
      if (pendingJournalAttempt === attempt) processPendingJournalAttempt();
    }, delay);
  });
}

function isJournalAnswerSubmitLabel(label) {
  const compact = normaliseJournalText(label, 160).toLowerCase();
  return /\b(?:submit|check|mark)\s+(?:your\s+)?answer\b/.test(compact) ||
    /^(?:answer\s*)+$/.test(compact) ||
    /\banswer\s+(?:question|now)\b/.test(compact);
}

function refreshPendingJournalAnswer() {
  if (!pendingJournalAttempt || pendingJournalAttempt.path !== questionRouteKey()) return;
  Object.assign(pendingJournalAttempt, snapshotAnswerSummary());
}

function startJournalAttempt(trigger) {
  if (!currentSettings?.enabled || !currentSettings?.answerJournal || !isQuestionPage() || !isVisibleOnPage(trigger)) return;
  if (trigger.hasAttribute('disabled') || trigger.getAttribute('aria-disabled') === 'true') return;
  const label = normaliseJournalText(`${trigger.getAttribute('aria-label') || ''} ${trigger.getAttribute('title') || ''} ${trigger.textContent || ''}`, 100);
  const isAnswerSubmit = isJournalAnswerSubmitLabel(label);
  if (!isAnswerSubmit) return;
  // Bookwork code and other dialogs are deliberately excluded: the journal is
  // for marked question responses, not for private access codes.
  const dialogSurface = trigger.closest('[role="dialog"], [role="menu"], [class*="DialogContent" i], [class*="PopoverContent" i], .sad-bookwork-check');
  if (dialogSurface || /\bbookwork\s*(?:check|code)\b/i.test(trigger.parentElement?.textContent || '')) return;

  const currentPath = questionRouteKey();
  if (pendingJournalAttempt && pendingJournalAttempt.path === currentPath && Date.now() - pendingJournalAttempt.timestamp < 350) return;
  const previousResult = readVisibleResult();
  pendingJournalAttempt = {
    path: currentPath,
    question: currentQuestionLabel(),
    timestamp: Date.now(),
    ...snapshotAnswerSummary(),
    resultElement: previousResult?.element || null,
    resultSignature: previousResult?.signature || '',
    sawNoResult: !previousResult,
    resultMutated: false
  };
  schedulePendingJournalChecks(pendingJournalAttempt);

  setTimeout(() => {
    if (pendingJournalAttempt?.path === currentPath && Date.now() - pendingJournalAttempt.timestamp >= 16000) {
      pendingJournalAttempt = null;
    }
  }, 16200);
}

function markPendingResultMutation(mutations) {
  const resultElement = pendingJournalAttempt?.resultElement;
  if (!resultElement) return;
  for (const mutation of mutations) {
    const target = mutation.target;
    if (target === resultElement || resultElement.contains(target)) {
      pendingJournalAttempt.resultMutated = true;
      return;
    }
    for (const node of [...mutation.addedNodes, ...mutation.removedNodes]) {
      if (node === resultElement || resultElement.contains(node) || (node instanceof Element && node.contains(resultElement))) {
        pendingJournalAttempt.resultMutated = true;
        return;
      }
    }
  }
}

function processPendingJournalAttempt() {
  if (!pendingJournalAttempt || !isQuestionPage()) return;
  if (pendingJournalAttempt.path !== questionRouteKey()) {
    pendingJournalAttempt = null;
    return;
  }

  const outcome = readVisibleResult();
  if (!outcome) {
    pendingJournalAttempt.sawNoResult = true;
    return;
  }
  if (!pendingJournalAttempt.sawNoResult && !pendingJournalAttempt.resultMutated && outcome.element === pendingJournalAttempt.resultElement && outcome.signature === pendingJournalAttempt.resultSignature) return;

  const attempt = pendingJournalAttempt;
  pendingJournalAttempt = null;
  saveAnswerJournalEntry({
    id: `${attempt.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: attempt.timestamp,
    result: outcome.result,
    question: attempt.question,
    answerSummary: attempt.answerSummary,
    answerType: attempt.answerType,
    path: attempt.path
  });
}

function formatJournalTimestamp(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
}

function renderAnswerJournal() {
  const list = document.getElementById('sad-answer-journal-list');
  if (!list) return;
  list.replaceChildren();
  if (!answerJournalEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'sad-answer-journal-empty';
    empty.textContent = 'Nothing saved yet. Submitted answers will appear here.';
    list.append(empty);
    return;
  }

  answerJournalEntries.forEach((entry) => {
    const item = document.createElement('article');
    item.className = 'sad-answer-journal-entry';

    const top = document.createElement('div');
    top.className = 'sad-answer-journal-entry-top';
    const question = document.createElement('strong');
    question.textContent = entry.question;
    const result = document.createElement('span');
    result.className = 'sad-answer-journal-result';
    result.dataset.result = entry.result;
    result.textContent = entry.result === 'correct' ? 'Correct' : 'Incorrect';
    top.append(question, result);

    const time = document.createElement('time');
    time.dateTime = new Date(entry.timestamp).toISOString();
    time.textContent = formatJournalTimestamp(entry.timestamp);
    const answer = document.createElement('p');
    answer.className = 'sad-answer-journal-answer';
    answer.textContent = entry.answerSummary;
    item.append(top, time, answer);
    list.append(item);
  });
}

function setAnswerJournalOpen(open) {
  answerJournalOpen = open;
  const button = document.getElementById('sad-answer-journal-button');
  const panel = document.getElementById('sad-answer-journal-panel');
  if (button) {
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close answer journal' : 'Open answer journal');
    button.title = open ? 'Close answer journal' : 'Open answer journal';
  }
  if (panel) panel.hidden = !open;
}

function clearAnswerJournal() {
  if (!confirm('Clear every saved answer journal entry from this browser?')) return;
  pendingJournalAttempt = null;
  answerJournalEntries = [];
  chrome.storage.local.set({ [ANSWER_JOURNAL_KEY]: [] }, () => {
    if (chrome.runtime.lastError) console.warn(chrome.runtime.lastError.message);
  });
  renderAnswerJournal();
}

function mountAnswerJournal() {
  const root = document.documentElement;
  const existingButton = document.getElementById('sad-answer-journal-button');
  const existingPanel = document.getElementById('sad-answer-journal-panel');
  const available = Boolean(root.classList.contains('sad-enabled') && currentSettings?.answerJournal && isQuestionPage());
  root.classList.toggle('sad-answer-journal-available', available);

  if (available && !document.body) {
    setTimeout(mountAnswerJournal, 50);
    return;
  }
  if (!available) {
    pendingJournalAttempt = null;
    answerJournalOpen = false;
    existingButton?.remove();
    existingPanel?.remove();
    return;
  }

  let button = existingButton;
  let panel = existingPanel;
  if (!button) {
    button = document.createElement('button');
    button.id = 'sad-answer-journal-button';
    button.type = 'button';
    button.setAttribute('aria-controls', 'sad-answer-journal-panel');
    button.addEventListener('click', () => {
      setAnswerJournalOpen(!answerJournalOpen);
      if (answerJournalOpen) setLocalStudyGuideOpen(false);
      renderAnswerJournal();
    });
    document.body.append(button);
  }
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'sad-answer-journal-panel';
    panel.setAttribute('aria-label', 'Answer journal');
    const header = document.createElement('div');
    header.className = 'sad-answer-journal-header';
    const heading = document.createElement('h2');
    heading.textContent = 'Answer journal';
    const close = document.createElement('button');
    close.className = 'sad-answer-journal-close';
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close answer journal');
    close.addEventListener('click', () => setAnswerJournalOpen(false));
    header.append(heading, close);

    const note = document.createElement('p');
    note.className = 'sad-answer-journal-note';
    note.textContent = 'Stored only in this browser. Visual answers are not copied.';
    const line = document.createElement('div');
    line.className = 'sad-answer-journal-line';
    const list = document.createElement('div');
    list.id = 'sad-answer-journal-list';
    list.setAttribute('aria-live', 'polite');
    const clear = document.createElement('button');
    clear.className = 'sad-answer-journal-clear';
    clear.type = 'button';
    clear.textContent = 'Clear all';
    clear.addEventListener('click', clearAnswerJournal);
    panel.append(header, note, line, list, clear);
    document.body.append(panel);
  }
  setAnswerJournalOpen(answerJournalOpen);
  renderAnswerJournal();
}

function bindAnswerJournalEvents() {
  if (answerJournalEventsBound) return;
  document.addEventListener('click', (event) => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target.closest('button, [role="button"], [type="submit"], a[href]') : null;
    if (target) startJournalAttempt(target);
  }, true);
  document.addEventListener('submit', (event) => {
    if (!event.isTrusted || !(event.submitter instanceof Element)) return;
    startJournalAttempt(event.submitter);
  }, true);
  document.addEventListener('input', () => refreshPendingJournalAnswer(), true);
  document.addEventListener('change', () => refreshPendingJournalAnswer(), true);
  answerJournalEventsBound = true;
}

// Sparx has several multiple-choice renderers.  Some expose their selected
// state through ARIA/input attributes while others only change a visual layer.
// This small local marker makes a user's selection equally clear in either
// case, without changing the answer or submitting anything.
function clearAnswerChoiceMarkers() {
  document.querySelectorAll('.sad-choice-selected').forEach((choice) => {
    choice.classList.remove('sad-choice-selected');
  });
  answerChoiceMarkersByRoute.clear();
}

function visibleAnswerChoiceContainers() {
  return [...document.querySelectorAll(ANSWER_CHOICE_CONTAINER_SELECTOR)].filter((container) => {
    return isVisibleOnPage(container) && !container.closest('#sad-answer-journal-panel, #sad-scientific-calculator-panel');
  });
}

function answerChoiceSurface(target, container) {
  const interactive = target.closest('button, [role="button"], [role="option"], [role="radio"], label, [tabindex]:not([tabindex="-1"])');
  if (interactive && container.contains(interactive)) return interactive;

  let surface = target;
  while (surface.parentElement && surface.parentElement !== container) surface = surface.parentElement;
  return surface.parentElement === container ? surface : null;
}

function answerChoiceSurfaces(container) {
  return [...container.querySelectorAll('button, [role="button"], [role="option"], [role="radio"], label, [tabindex]:not([tabindex="-1"])')]
    .filter((candidate) => isVisibleOnPage(candidate) && answerChoiceSurface(candidate, container) === candidate);
}

function answerChoiceLocator(choice, container) {
  const containers = visibleAnswerChoiceContainers();
  const choiceIndex = answerChoiceSurfaces(container).indexOf(choice);
  const containerIndex = containers.indexOf(container);
  if (containerIndex < 0 || choiceIndex < 0) return null;
  return {
    containerIndex,
    choiceIndex,
    ref: choice.getAttribute('data-ref') || '',
    text: normaliseJournalText(choice.textContent, 180)
  };
}

function resolveAnswerChoiceLocator(locator, containers = visibleAnswerChoiceContainers()) {
  const container = containers[locator.containerIndex];
  if (!container) return null;
  const choices = answerChoiceSurfaces(container);
  const byRef = locator.ref ? choices.find((choice) => choice.getAttribute('data-ref') === locator.ref) : null;
  const indexed = choices[locator.choiceIndex] || null;
  const byText = locator.text ? choices.find((choice) => normaliseJournalText(choice.textContent, 180) === locator.text) : null;
  const choice = byRef || (indexed && (!locator.text || normaliseJournalText(indexed.textContent, 180) === locator.text) ? indexed : byText) || indexed;
  return choice ? { container, choice } : null;
}

function sameAnswerChoiceLocator(first, second) {
  if (first.ref && second.ref) return first.ref === second.ref;
  return first.containerIndex === second.containerIndex && first.choiceIndex === second.choiceIndex && first.text === second.text;
}

function supportsMultipleAnswerChoices(container) {
  return Boolean(container.querySelector('input[type="checkbox"], [role="checkbox"], [aria-multiselectable="true"]'));
}

function nativeAnswerChoiceState(choice, container) {
  const controls = [choice, ...choice.querySelectorAll('input[type="checkbox"], input[type="radio"], [aria-pressed], [aria-selected], [role="checkbox"], [role="radio"]')];
  let known = false;
  let selected = false;
  let isRadio = false;

  controls.forEach((control) => {
    if (control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)) {
      known = true;
      selected ||= control.checked;
      isRadio ||= control.type === 'radio';
      return;
    }
    const pressed = control.getAttribute('aria-pressed');
    const ariaSelected = control.getAttribute('aria-selected');
    const ariaChecked = control.getAttribute('aria-checked');
    const isRadioControl = control.getAttribute('role') === 'radio';
    const isCheckboxControl = control.getAttribute('role') === 'checkbox';
    const isSelected = pressed === 'true' || ariaSelected === 'true' || ariaChecked === 'true';
    if (isSelected) {
      known = true;
      selected = true;
    }
    // A false ARIA value on a generic role=button is not trustworthy on
    // Sparx's option renderer. Real radios and checkboxes are trustworthy.
    if ((isRadioControl || isCheckboxControl) && ariaChecked !== null) known = true;
    isRadio ||= isRadioControl;
  });
  return { known, selected, isRadio };
}

function storeAnswerChoiceMarker(locator, container, state) {
  const route = questionRouteKey();
  if (!route) return;
  const existing = answerChoiceMarkersByRoute.get(route) || [];
  const isMultiple = supportsMultipleAnswerChoices(container);
  const sameChoice = (marker) => marker.containerIndex === locator.containerIndex && sameAnswerChoiceLocator(marker, locator);
  let next = existing.filter((marker) => !sameChoice(marker));

  if (state.known) {
    if (state.selected) {
      if (state.isRadio || !isMultiple) next = next.filter((marker) => marker.containerIndex !== locator.containerIndex);
      next.push(locator);
    }
  } else if (!isMultiple) {
    next = next.filter((marker) => marker.containerIndex !== locator.containerIndex);
    next.push(locator);
  } else if (!existing.some(sameChoice)) {
    next.push(locator);
  }

  answerChoiceMarkersByRoute.set(route, next);
}

function syncAnswerChoiceMarkers() {
  document.querySelectorAll('.sad-choice-selected').forEach((choice) => choice.classList.remove('sad-choice-selected'));
  const route = questionRouteKey();
  const markers = route && answerChoiceMarkersByRoute.get(route);
  if (!currentSettings?.enabled || !isQuestionPage() || !markers?.length) return;
  const containers = visibleAnswerChoiceContainers();
  markers.forEach((marker) => {
    const resolved = resolveAnswerChoiceLocator(marker, containers);
    resolved?.choice.classList.add('sad-choice-selected');
  });
}

function refreshAnswerChoiceMarker(target) {
  if (!currentSettings?.enabled || !isQuestionPage() || !(target instanceof Element)) return;
  const container = target.closest(ANSWER_CHOICE_CONTAINER_SELECTOR);
  if (!container || container.closest('#sad-answer-journal-panel')) return;
  const choice = answerChoiceSurface(target, container);
  if (!choice) return;
  const locator = answerChoiceLocator(choice, container);
  if (!locator) return;

  requestAnimationFrame(() => {
    setTimeout(() => {
      const resolved = resolveAnswerChoiceLocator(locator);
      if (!resolved) return;
      storeAnswerChoiceMarker(locator, resolved.container, nativeAnswerChoiceState(resolved.choice, resolved.container));
      syncAnswerChoiceMarkers();
      // Sparx can replace the option again just after its click handler.
      setTimeout(syncAnswerChoiceMarkers, 80);
    }, 0);
  });
}

function bindAnswerChoiceEvents() {
  if (answerChoiceEventsBound) return;
  document.addEventListener('click', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    refreshAnswerChoiceMarker(event.target);
  }, true);
  document.addEventListener('change', (event) => {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    refreshAnswerChoiceMarker(event.target);
  }, true);
  answerChoiceEventsBound = true;
}

function setScientificCalculatorOpen(open) {
  const root = document.documentElement;
  const panel = document.getElementById('sad-scientific-calculator-panel');
  const toggle = document.getElementById('sad-scientific-calculator-toggle');
  const available = Boolean(panel && root.classList.contains('sad-scientific-calculator-available'));
  scientificCalculatorOpen = Boolean(open && available);
  root.classList.toggle('sad-scientific-calculator-open', scientificCalculatorOpen);
  if (panel) panel.hidden = !scientificCalculatorOpen;
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(scientificCalculatorOpen));
    toggle.setAttribute('aria-label', scientificCalculatorOpen ? 'Close scientific calculator' : 'Open scientific calculator');
    toggle.title = scientificCalculatorOpen ? 'Close scientific calculator' : 'Open scientific calculator';
  }
}

function updateScientificCalculatorContext(panel, calculatorMode) {
  const subtitle = panel.querySelector('.sad-scientific-calculator-subtitle');
  const warning = panel.querySelector('.sad-scientific-calculator-warning');
  const isSparxAllowed = calculatorMode === 'calculator';
  const isSparxRestricted = calculatorMode === 'non-calculator';
  const subtitleText = isSparxAllowed ? 'Calculator allowed by Sparx' : 'Permission-required support';
  const warningText = isSparxRestricted
    ? 'Sparx marks this question calculator not allowed. Use this only with permission.'
    : '';

  if (subtitle && subtitle.textContent !== subtitleText) subtitle.textContent = subtitleText;

  if (warning) {
    if (warning.hidden !== !isSparxRestricted) warning.hidden = !isSparxRestricted;
    if (warning.textContent !== warningText) warning.textContent = warningText;
  }

  panel.classList.toggle('sad-scientific-calculator-restricted', !isSparxAllowed);
}

function mountScientificCalculator() {
  const root = document.documentElement;
  const existingPanel = document.getElementById('sad-scientific-calculator-panel');
  const existingToggle = document.getElementById('sad-scientific-calculator-toggle');
  const calculatorMode = readVisibleCalculatorMode();
  const route = questionRouteKey();
  if (route !== scientificCalculatorRoute) {
    scientificCalculatorRoute = route;
    scientificCalculatorOpen = false;
  }
  const canUseOnThisQuestion = calculatorMode === 'calculator' || (
    calculatorMode === 'non-calculator' && currentSettings?.scientificCalculatorOnNonCalculator === true
  );
  const available = Boolean(
    root.classList.contains('sad-enabled') &&
    currentSettings?.scientificCalculator &&
    isQuestionPage() &&
    canUseOnThisQuestion
  );

  root.classList.toggle('sad-scientific-calculator-available', available);
  if (available && !document.body) {
    setTimeout(mountScientificCalculator, 50);
    return;
  }
  if (!available) {
    scientificCalculatorOpen = false;
    root.classList.remove('sad-scientific-calculator-open');
    existingPanel?.remove();
    existingToggle?.remove();
    return;
  }

  let panel = existingPanel;
  let toggle = existingToggle;
  if (!panel) {
    panel = document.createElement('aside');
    panel.id = 'sad-scientific-calculator-panel';
    panel.setAttribute('aria-label', 'Scientific calculator');

    const header = document.createElement('div');
    header.className = 'sad-scientific-calculator-header';
    const titleArea = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'Scientific calculator';
    const subtitle = document.createElement('p');
    subtitle.className = 'sad-scientific-calculator-subtitle';
    titleArea.append(title, subtitle);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'sad-scientific-calculator-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Close scientific calculator');
    close.addEventListener('click', () => setScientificCalculatorOpen(false));
    header.append(titleArea, close);

    const line = document.createElement('div');
    line.className = 'sad-scientific-calculator-line';
    const warning = document.createElement('p');
    warning.className = 'sad-scientific-calculator-warning';
    warning.setAttribute('role', 'note');
    const calculator = document.createElement('div');
    calculator.className = 'sad-scientific-calculator-host';
    panel.append(header, line, warning, calculator);
    document.body.append(panel);

    if (globalThis.SparxAfterDarkScientificCalculator?.mount) {
      globalThis.SparxAfterDarkScientificCalculator.mount(calculator);
    } else {
      calculator.textContent = 'The calculator could not start. Reload the extension and try again.';
    }
  }

  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'sad-scientific-calculator-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'sad-scientific-calculator-panel');
    toggle.addEventListener('click', () => setScientificCalculatorOpen(!scientificCalculatorOpen));
    document.body.append(toggle);
  }

  updateScientificCalculatorContext(panel, calculatorMode);
  setScientificCalculatorOpen(scientificCalculatorOpen);
}

function labelFocusControl(button, isActive) {
  button.textContent = "";
  button.setAttribute("aria-label", isActive ? "Exit focus mode" : "Focus question");
  button.title = isActive ? "Exit focus mode" : "Focus question";
}

function mountFocusControl() {
  const root = document.documentElement;
  const existing = document.getElementById("sad-question-focus-button");
  const available = root.classList.contains("sad-enabled") && isQuestionPage();

  if (available && !document.body) {
    setTimeout(mountFocusControl, 50);
    return;
  }

  root.classList.toggle("sad-question-page", available);
  if (!available) {
    root.classList.remove("sad-question-focus");
    existing?.remove();
    return;
  }

  const button = existing || document.createElement("button");
  if (!existing) {
    button.id = "sad-question-focus-button";
    button.type = "button";
    button.addEventListener("click", async () => {
      if (document.fullscreenElement || root.classList.contains("sad-question-focus")) {
        if (document.fullscreenElement) await document.exitFullscreen?.();
        root.classList.remove("sad-question-focus");
        labelFocusControl(button, false);
        return;
      }
      root.classList.add("sad-question-focus");
      labelFocusControl(button, true);
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        // The layout still provides a distraction-free view when fullscreen is blocked.
      }
    });
    document.body.append(button);
  }

  labelFocusControl(button, Boolean(document.fullscreenElement || root.classList.contains("sad-question-focus")));
  if (!focusEventsBound) {
    document.addEventListener("fullscreenchange", () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      root.classList.toggle("sad-question-focus", isFullscreen);
      const control = document.getElementById("sad-question-focus-button");
      if (control) labelFocusControl(control, isFullscreen);
    });
    focusEventsBound = true;
  }
}

function applyTheme(settings) {
  currentSettings = settings;
  const root = document.documentElement;
  const isHomePage = /^\/student\/(personalpractice|home)/i.test(location.pathname);
  const isHomeworkPage = /^\/student\/homework/i.test(location.pathname);
  const isIndependentLearningPage = /^\/student\/independentlearning/i.test(location.pathname);
  const isLearningActivityPage = /^\/student\/independentlearning\/activity\/?$/i.test(location.pathname);
  const isLeaderboardPage = /^\/student\/leaderboard\/?$/i.test(location.pathname);
  root.classList.toggle("sad-enabled", settings.enabled);
  root.classList.toggle("sad-home", settings.enabled && isHomePage);
  root.classList.toggle("sad-homework", settings.enabled && isHomeworkPage);
  root.classList.toggle("sad-independent", settings.enabled && isIndependentLearningPage);
  root.classList.toggle("sad-learning-activity", settings.enabled && isLearningActivityPage);
  root.classList.toggle("sad-leaderboard", settings.enabled && isLeaderboardPage);
  root.classList.toggle("sad-compact", settings.compact);
  root.classList.toggle("sad-no-shadows", !settings.shadows);
  root.classList.toggle("sad-reduce-motion", settings.reduceMotion);
  root.classList.toggle("sad-calm-errors", settings.calmErrors);
  root.classList.toggle("sad-dim-images", settings.dimImages);
  root.style.setProperty("--sad-accent", settings.accent);
  root.style.setProperty("--sad-bg", settings.background);
  root.style.setProperty("--sad-surface", settings.surface);
  root.style.setProperty("--sad-text", settings.text);
  root.style.setProperty("--sad-ribbon", settings.ribbon);
  root.style.setProperty("--sad-action", settings.action);
  root.style.setProperty("--sad-correct", settings.correct);
  root.style.setProperty("--sad-incorrect", settings.incorrect);
  root.style.setProperty("--sad-radius", `${settings.radius}px`);
  root.style.setProperty("--sad-font", settings.font);
  mountFocusControl();
  mountAnswerJournal();
  mountLocalStudyGuide();
  bindAnswerJournalEvents();
  bindAnswerChoiceEvents();
  syncAnswerChoiceMarkers();
  syncCalculatorBadges();
  mountScientificCalculator();
  polishDialogBackdrops();
  polishBookworkCheck();
}

chrome.storage.local.get(DEFAULTS, applyTheme);
chrome.storage.local.get({ [ANSWER_JOURNAL_KEY]: [] }, (values) => {
  loadAnswerJournal(values[ANSWER_JOURNAL_KEY]);
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[ANSWER_JOURNAL_KEY]) loadAnswerJournal(changes[ANSWER_JOURNAL_KEY].newValue);
  chrome.storage.local.get(DEFAULTS, applyTheme);
});

// Sparx is a React app and often changes routes after the initial document load.
// Reapply the page-specific class whenever that happens, without writing to storage.
function refreshRouteTheme() {
  if (currentSettings) applyTheme(currentSettings);
  else mountFocusControl();
}

function watchRouteChange() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  clearAnswerChoiceMarkers();
  if (pendingJournalAttempt && pendingJournalAttempt.path !== questionRouteKey()) {
    pendingJournalAttempt = null;
  }
  refreshRouteTheme();
}

["pushState", "replaceState"].forEach((method) => {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args);
    queueMicrotask(watchRouteChange);
    return result;
  };
});

addEventListener("popstate", watchRouteChange);
addEventListener("pageshow", refreshRouteTheme);
addEventListener("DOMContentLoaded", refreshRouteTheme);

new MutationObserver((mutations) => {
  watchRouteChange();
  markPendingResultMutation(mutations);
  processPendingJournalAttempt();
  syncAnswerChoiceMarkers();
  syncCalculatorBadges();
  mountLocalStudyGuide();
  mountScientificCalculator();
  polishDialogBackdrops();
  polishBookworkCheck();
}).observe(document.documentElement, {
  childList: true,
  subtree: true
});

// Also cover slow initial renders where Sparx replaces its page shell late.
[150, 750, 2000, 5000].forEach((delay) => setTimeout(() => {
  refreshRouteTheme();
  processPendingJournalAttempt();
  syncAnswerChoiceMarkers();
  syncCalculatorBadges();
  mountLocalStudyGuide();
  mountScientificCalculator();
  polishDialogBackdrops();
  polishBookworkCheck();
}, delay));
