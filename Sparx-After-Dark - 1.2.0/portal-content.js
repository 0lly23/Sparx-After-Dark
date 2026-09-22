// Visual-only portal theme for Sparx sign-in and school selection pages.
// It never reads form values or changes login, selection, or redirect logic.
const PORTAL_DEFAULTS = {
  enabled: true,
  accent: "#e2b714",
  background: "#323437",
  surface: "#2c2e31",
  text: "#d1d0c5",
  ribbon: "#202124",
  radius: 14,
  font: "Nunito Sans, ui-rounded, system-ui, sans-serif"
};

function isCredentialForm(form) {
  return Boolean(form.querySelector(
    'input[type="password"], input[autocomplete="username"], input[autocomplete="email"], input[autocomplete="current-password"]'
  ));
}

function normaliseText(value) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
    && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

// The school picker is rendered with build-specific class names.  Instead of
// guessing those names, tag its visible card and result panel from their
// stable content and position.  This is deliberately visual-only: no form
// values, click handlers, or selection behaviour are read or changed.
function polishSchoolPicker() {
  if (!document.documentElement.classList.contains('sad-school-portal')) return;

  const app = document.getElementById('root');
  if (!(app instanceof HTMLElement)) return;

  const appChildren = [...app.children].filter((element) => element instanceof HTMLElement);
  const shell = appChildren
    .filter(isVisible)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0];
  shell?.classList.add('sad-school-page-shell');

  const input = [...app.querySelectorAll('input[aria-autocomplete="list"], input[aria-controls], input[aria-owns], input[type="search"], input[placeholder*="school" i], input:not([type="hidden"]), select')]
    .find((element) => element instanceof HTMLElement && isVisible(element));
  if (!(input instanceof HTMLElement)) return;

  const heading = [...app.querySelectorAll('h1, h2, h3, [role="heading"], div, span')]
    .find((element) => normaliseText(element.textContent) === 'select your school');
  let card = null;

  if (heading instanceof HTMLElement) {
    for (let element = heading.parentElement; element && element !== app; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (element.contains(input) && rect.width >= 240 && rect.height >= 130
        && rect.width <= Math.min(1200, window.innerWidth * .9) && rect.height <= window.innerHeight * .9) {
        card = element;
        break;
      }
    }
  }

  if (!(card instanceof HTMLElement)) {
    for (let element = input.parentElement; element && element !== app; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (rect.width >= 240 && rect.height >= 130 && rect.width <= Math.min(1200, window.innerWidth * .9)) {
        card = element;
        break;
      }
    }
  }

  card?.classList.add('sad-school-picker-card');
  input.classList.add('sad-school-search-input');

  const inputRect = input.getBoundingClientRect();
  const controlledResultId = input.getAttribute('aria-controls') || input.getAttribute('aria-owns');
  const controlledResult = controlledResultId ? document.getElementById(controlledResultId) : null;
  const resultCandidates = [...document.querySelectorAll('body *')]
    .filter((element) => element instanceof HTMLElement && element !== card && isVisible(element))
    .map((element) => ({ element, rect: element.getBoundingClientRect(), text: normaliseText(element.textContent) }))
    .filter(({ rect, text }) => text.length > 2
      && rect.top >= inputRect.bottom - 8
      && rect.top <= inputRect.bottom + 48
      && rect.left <= inputRect.left + 24
      && rect.right >= inputRect.right - 24
      && rect.width >= inputRect.width * .8
      && rect.height >= 38);

  const resultPanel = controlledResult instanceof HTMLElement && isVisible(controlledResult)
    ? controlledResult
    : resultCandidates
    .sort((left, right) => {
      const topDifference = left.rect.top - right.rect.top;
      return Math.abs(topDifference) > 4
        ? topDifference
        : (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height);
    })[0]?.element;

  if (!(resultPanel instanceof HTMLElement)) return;
  resultPanel.classList.add('sad-school-results');

  const resultRect = resultPanel.getBoundingClientRect();
  [...resultPanel.querySelectorAll('*')].forEach((element) => {
    if (!(element instanceof HTMLElement) || !isVisible(element)) return;
    // querySelectorAll is ordered from outer containers to their children.
    // Once the visible row is tagged, do not tag text wrappers inside it.
    if (element.parentElement?.closest('.sad-school-result-row')) return;
    const rect = element.getBoundingClientRect();
    const text = normaliseText(element.textContent);
    if (text.length > 2 && rect.left <= resultRect.left + 20 && rect.right >= resultRect.right - 20
      && rect.width >= resultRect.width * .72 && rect.height >= 26 && rect.height <= 118) {
      element.classList.add('sad-school-result-row');
    }
  });
}

// The hosted sign-in page can be either a credential form or an OAuth choice.
// Tag only visible, static UI regions so the visual layer never changes how a
// user signs in, which provider is used, or where the sign-in redirects.
function polishAuthPortal() {
  if (!document.documentElement.classList.contains('sad-auth-portal')) return;

  // The hosted OAuth page is server-rendered and has no #root wrapper.
  const app = document.getElementById('root') || document.body;
  if (!(app instanceof HTMLElement)) return;

  const appChildren = [...app.children].filter((element) => element instanceof HTMLElement);
  const shell = appChildren
    .filter(isVisible)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
    })[0];
  shell?.classList.add('sad-auth-page-shell');

  [...app.querySelectorAll('*')].forEach((element) => {
    if (!(element instanceof HTMLElement) || !isVisible(element)) return;
    const rect = element.getBoundingClientRect();
    if (rect.top <= 12 && rect.width >= window.innerWidth * .7 && rect.height <= 16) {
      element.classList.add('sad-auth-accent-strip');
    }
  });

  const providerButton = [...app.querySelectorAll('button, a[href], a[role="button"], input[type="submit"]')]
    .find((element) => {
      const text = normaliseText(element.textContent || element.getAttribute('value'));
      return isVisible(element) && /(log in|sign in).*microsoft|microsoft.*(log in|sign in)/.test(text);
    });

  if (providerButton instanceof HTMLElement) {
    providerButton.classList.add('sad-auth-provider-button');
    const formCard = providerButton.closest('form');
    if (formCard instanceof HTMLElement && isVisible(formCard)) {
      formCard.classList.add('sad-auth-login-card');
    } else for (let element = providerButton.parentElement; element && element !== app; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (rect.width >= 260 && rect.height >= 120 && rect.width <= Math.min(900, window.innerWidth * .9)
        && rect.height <= window.innerHeight * .8) {
        element.classList.add('sad-auth-login-card');
        break;
      }
    }
  }

  const schoolBannerText = [...app.querySelectorAll('h1, h2, h3, p, div, span, strong')]
    .find((element) => normaliseText(element.textContent).startsWith('you are logging into'));
  if (schoolBannerText instanceof HTMLElement) {
    for (let element = schoolBannerText; element && element !== app; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (rect.width >= 260 && rect.height >= 42 && rect.width <= Math.min(900, window.innerWidth * .9)
        && rect.height <= 180) {
        element.classList.add('sad-auth-school-banner');
        break;
      }
    }
  }
}

function applyPortalTheme(settings) {
  const root = document.documentElement;
  const isAuth = location.hostname === 'auth.sparx-learning.com';
  const isSchoolSelector = location.hostname === 'selectschool.sparx-learning.com';
  const active = Boolean(settings.enabled && (isAuth || isSchoolSelector));

  root.classList.toggle('sad-portal', active);
  root.classList.toggle('sad-auth-portal', active && isAuth);
  root.classList.toggle('sad-school-portal', active && isSchoolSelector);
  root.style.setProperty('--sad-accent', settings.accent);
  root.style.setProperty('--sad-bg', settings.background);
  root.style.setProperty('--sad-surface', settings.surface);
  root.style.setProperty('--sad-text', settings.text);
  root.style.setProperty('--sad-ribbon', settings.ribbon);
  root.style.setProperty('--sad-radius', `${settings.radius}px`);
  root.style.setProperty('--sad-font', settings.font);

  document.querySelectorAll('form, .sad-credential-form, .sad-school-picker-form').forEach((form) => {
    if (!(form instanceof HTMLElement)) return;
    form.classList.toggle('sad-credential-form', active && isAuth && isCredentialForm(form));
    form.classList.toggle('sad-school-picker-form', active && isSchoolSelector);
  });

  if (active && isSchoolSelector) polishSchoolPicker();
  if (active && isAuth) polishAuthPortal();
}

chrome.storage.local.get(PORTAL_DEFAULTS, applyPortalTheme);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') chrome.storage.local.get(PORTAL_DEFAULTS, applyPortalTheme);
});

let refreshQueued = false;
new MutationObserver(() => {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    chrome.storage.local.get(PORTAL_DEFAULTS, applyPortalTheme);
  });
}).observe(document.documentElement, { childList: true, subtree: true });
