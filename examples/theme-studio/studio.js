// Theme Studio — interactive customizer for the libreconsent banner.
//
// Plain browser script: loads after the /dist/ IIFE bundles, exercises the
// public theming surface (CSS custom properties + UiOptions) and never touches
// packages/*. State lives only in the URL hash; nothing is persisted.

const PROPS = {
  bg: "--libreconsent-bg",
  fg: "--libreconsent-fg",
  muted: "--libreconsent-muted",
  surface: "--libreconsent-surface",
  border: "--libreconsent-border",
  accent: "--libreconsent-accent",
  "accent-fg": "--libreconsent-accent-fg",
  focus: "--libreconsent-focus",
  overlay: "--libreconsent-overlay",
  radius: "--libreconsent-radius",
  space: "--libreconsent-space",
  "font-size": "--libreconsent-font-size",
  "font-family": "--libreconsent-font-family",
  shadow: "--libreconsent-shadow",
};

// Verbatim from packages/ui/src/styles.ts light/dark branches.
const DEFAULTS = {
  light: {
    bg: "#ffffff",
    fg: "#16181d",
    muted: "#565b66",
    surface: "#f5f6f8",
    border: "#d5d8de",
    accent: "#1b57d6",
    "accent-fg": "#ffffff",
    focus: "#1b57d6",
  },
  dark: {
    bg: "#16181d",
    fg: "#f2f3f5",
    muted: "#a8adb8",
    surface: "#1e2128",
    border: "#343841",
    accent: "#6f9bff",
    "accent-fg": "#10131a",
    focus: "#8fb2ff",
  },
};

const COLOR_TOKENS = [
  "bg",
  "fg",
  "muted",
  "surface",
  "border",
  "accent",
  "accent-fg",
  "focus",
];

const FONT_STACKS = {
  system: null,
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
  rounded: '"Segoe UI Rounded", "Comic Sans MS", system-ui, sans-serif',
};

const SHADOWS = {
  soft: null,
  none: "none",
  heavy: "0 24px 60px rgba(0, 0, 0, 0.45)",
  retro: "8px 8px 0 rgba(0, 0, 0, 0.9)",
};

const LAYOUTS = ["bar-bottom", "box", "modal"];
const THEMES = ["auto", "light", "dark"];
const FAB_POSITIONS = ["bottom-start", "bottom-end"];
const LOCALES = ["en", "fr"];
const FONT_FAMILIES = ["system", "serif", "mono", "rounded"];
const SHADOW_KEYS = ["soft", "none", "heavy", "retro"];

const PRESETS = [
  { id: "default", label: "Default" },
  {
    id: "midnight",
    label: "Midnight",
    theme: "dark",
    colors: {
      bg: "#0b1020",
      fg: "#e8ecf8",
      muted: "#94a0bd",
      surface: "#131a30",
      border: "#26304d",
      accent: "#7aa2ff",
      "accent-fg": "#0b1020",
      focus: "#9db8ff",
    },
    radius: 12,
  },
  {
    id: "forest",
    label: "Forest",
    theme: "light",
    colors: {
      bg: "#f6f8f4",
      fg: "#1d2b20",
      muted: "#5c6f60",
      surface: "#e9f0e6",
      border: "#c9d8c8",
      accent: "#2f7d4f",
      "accent-fg": "#ffffff",
      focus: "#2f7d4f",
    },
    radius: 10,
  },
  {
    id: "sunset",
    label: "Sunset",
    theme: "light",
    colors: {
      bg: "#fff7f0",
      fg: "#3a2230",
      muted: "#8a6a72",
      surface: "#ffeede",
      border: "#f0d5bd",
      accent: "#b8431c",
      "accent-fg": "#ffffff",
      focus: "#b8431c",
    },
    radius: 16,
  },
  {
    id: "bubblegum",
    label: "Bubblegum",
    theme: "light",
    colors: {
      bg: "#fff0f6",
      fg: "#46232f",
      muted: "#9c6b7d",
      surface: "#ffe0ec",
      border: "#f7c2d8",
      accent: "#d6336c",
      "accent-fg": "#ffffff",
      focus: "#d6336c",
    },
    radius: 24,
  },
  {
    id: "terminal",
    label: "Terminal",
    theme: "dark",
    colors: {
      bg: "#0a0f0a",
      fg: "#c8f5c8",
      muted: "#7fbf7f",
      surface: "#101710",
      border: "#1f3a1f",
      accent: "#33ff66",
      "accent-fg": "#04220c",
      focus: "#33ff66",
    },
    radius: 0,
    fontFamily: "mono",
  },
  {
    id: "newsprint",
    label: "Newsprint",
    theme: "light",
    colors: {
      bg: "#faf7f0",
      fg: "#1c1b18",
      muted: "#575349",
      surface: "#f1ece0",
      border: "#d8d2c2",
      accent: "#1c1b18",
      "accent-fg": "#faf7f0",
      focus: "#8a2b2b",
    },
    radius: 0,
    fontFamily: "serif",
  },
  {
    id: "contrast",
    label: "Max contrast",
    theme: "dark",
    colors: {
      bg: "#000000",
      fg: "#ffffff",
      muted: "#d0d0d0",
      surface: "#0a0a0a",
      border: "#ffffff",
      accent: "#ffd400",
      "accent-fg": "#000000",
      focus: "#00e0ff",
    },
    radius: 4,
    shadow: "none",
  },
];

function defaultState() {
  return {
    layout: "bar-bottom",
    theme: "auto",
    fab: true,
    fabPos: "bottom-start",
    locale: "en",
    colors: {},
    overlayAlpha: 55,
    radius: null,
    fontSize: null,
    fontFamily: "system",
    shadow: "soft",
  };
}

let state = defaultState();
let activePreset = "default";

// ---- Color + contrast math (WCAG 2.x) ----------------------------------

function hexToRgb(hex) {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function effectiveScheme() {
  if (state.theme === "dark" || state.theme === "light") return state.theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function effectiveColor(token) {
  return state.colors[token] ?? DEFAULTS[effectiveScheme()][token];
}

function hslToHex(h, s, l) {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n) => {
    const c = lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ---- Consent config (fresh object graph per boot, so deepFreeze on the
//      normalized config can never leak back into a shared input object) --

function makeConfig() {
  return {
    categories: [
      {
        id: "analytics",
        label: "category.analytics.label",
        description: "category.analytics.description",
      },
      {
        id: "marketing",
        label: "category.marketing.label",
        description: "category.marketing.description",
      },
    ],
    i18n: {
      translations: {
        en: {
          "category.analytics.label": "Analytics",
          "category.analytics.description": "Measures how this site is used.",
          "category.marketing.label": "Marketing",
          "category.marketing.description":
            "Supports personalized advertising.",
        },
        fr: {
          "category.analytics.label": "Analytique",
          "category.analytics.description": "Mesure l'utilisation de ce site.",
          "category.marketing.label": "Marketing",
          "category.marketing.description":
            "Prend en charge la publicité personnalisée.",
        },
      },
    },
    storage: { cookieName: "libreconsent-studio" },
    usPrivacy: { enabled: true },
  };
}

// ---- Mount lifecycle ----------------------------------------------------

let api = null;
let ui = null;
let mountedKey = null;

function mountOptions() {
  const opts = {
    layout: state.layout,
    theme: state.theme,
    floatingButton: state.fab,
    floatingButtonPosition: state.fabPos,
  };
  if (state.locale !== "en") opts.locale = state.locale;
  return opts;
}

function mountKey() {
  return `${state.layout}|${state.theme}|${state.fab}|${state.fabPos}|${state.locale}`;
}

function boot() {
  api = window.LibreConsentCore.init(makeConfig());
  ui = window.LibreConsentUi.mount(api, mountOptions());
  mountedKey = mountKey();
}

function remount() {
  if (ui) {
    try {
      ui.unmount();
    } catch {
      /* already gone */
    }
  }
  if (api) {
    try {
      api.reset();
    } catch {
      /* already invalidated */
    }
  }
  boot();
}

// ---- Render pipeline ----------------------------------------------------

function applyVars() {
  const root = document.documentElement.style;
  for (const prop of Object.values(PROPS)) {
    root.removeProperty(prop);
  }
  for (const token of COLOR_TOKENS) {
    if (state.colors[token]) {
      root.setProperty(PROPS[token], state.colors[token]);
    }
  }
  if (state.colors.overlay) {
    const { r, g, b } = hexToRgb(state.colors.overlay);
    root.setProperty(
      PROPS.overlay,
      `rgba(${r}, ${g}, ${b}, ${state.overlayAlpha / 100})`,
    );
  }
  if (state.radius !== null) {
    root.setProperty(PROPS.radius, `${state.radius}px`);
  }
  if (state.fontSize !== null) {
    root.setProperty(PROPS["font-size"], `${state.fontSize}px`);
  }
  if (FONT_STACKS[state.fontFamily]) {
    root.setProperty(PROPS["font-family"], FONT_STACKS[state.fontFamily]);
  }
  if (SHADOWS[state.shadow]) {
    root.setProperty(PROPS.shadow, SHADOWS[state.shadow]);
  }
}

function syncControls() {
  const setPressed = (attr, current) => {
    for (const el of panel.querySelectorAll(`[${attr}]`)) {
      el.setAttribute(
        "aria-pressed",
        String(el.getAttribute(attr) === current),
      );
    }
  };
  setPressed("data-studio-layout", state.layout);
  setPressed("data-studio-theme", state.theme);
  setPressed("data-studio-fabpos", state.fabPos);
  setPressed("data-studio-locale", state.locale);

  for (const el of panel.querySelectorAll("[data-preset]")) {
    el.setAttribute("aria-pressed", String(el.dataset.preset === activePreset));
  }

  const scheme = effectiveScheme();
  for (const token of COLOR_TOKENS) {
    const input = panel.querySelector(`[data-studio="${token}"]`);
    if (input && input !== document.activeElement) {
      input.value = state.colors[token] ?? DEFAULTS[scheme][token];
    }
  }
  const overlayInput = panel.querySelector('[data-studio="overlay"]');
  if (overlayInput && overlayInput !== document.activeElement) {
    overlayInput.value = state.colors.overlay ?? "#101217";
  }
  setRange("overlay-alpha", state.overlayAlpha);
  setRange("radius", state.radius ?? 8);
  setRange("font-size", state.fontSize ?? 16);

  const fontFamily = panel.querySelector('[data-studio="font-family"]');
  if (fontFamily) fontFamily.value = state.fontFamily;
  const shadow = panel.querySelector('[data-studio="shadow"]');
  if (shadow) shadow.value = state.shadow;
  const fab = panel.querySelector('[data-studio="fab"]');
  if (fab) fab.checked = state.fab;
}

function setRange(token, value) {
  const input = panel.querySelector(`[data-studio="${token}"]`);
  if (input) input.value = String(value);
  const out = panel.querySelector(`[data-studio-output="${token}"]`);
  if (out) out.textContent = String(value);
}

function renderBadges() {
  const rows = [
    { key: "fg-bg", a: effectiveColor("fg"), b: effectiveColor("bg") },
    {
      key: "accent",
      a: effectiveColor("accent-fg"),
      b: effectiveColor("accent"),
    },
    { key: "muted-bg", a: effectiveColor("muted"), b: effectiveColor("bg") },
  ];
  for (const { key, a, b } of rows) {
    const row = panel.querySelector(`[data-contrast="${key}"]`);
    if (!row) continue;
    const ratio = contrast(a, b);
    const pass = ratio >= 4.5;
    row.dataset.state = pass ? "pass" : "fail";
    row.querySelector(".contrast-ratio").textContent = `${ratio.toFixed(2)}:1`;
    row.querySelector(".contrast-chip").textContent = pass ? "PASS" : "FAIL";
  }
}

function buildCss() {
  const lines = [];
  for (const token of COLOR_TOKENS) {
    if (state.colors[token]) {
      lines.push(`  ${PROPS[token]}: ${state.colors[token]};`);
    }
  }
  if (state.colors.overlay) {
    const { r, g, b } = hexToRgb(state.colors.overlay);
    lines.push(
      `  ${PROPS.overlay}: rgba(${r}, ${g}, ${b}, ${state.overlayAlpha / 100});`,
    );
  }
  if (state.radius !== null) {
    lines.push(`  ${PROPS.radius}: ${state.radius}px;`);
  }
  if (state.fontSize !== null) {
    lines.push(`  ${PROPS["font-size"]}: ${state.fontSize}px;`);
  }
  if (FONT_STACKS[state.fontFamily]) {
    lines.push(`  ${PROPS["font-family"]}: ${FONT_STACKS[state.fontFamily]};`);
  }
  if (SHADOWS[state.shadow]) {
    lines.push(`  ${PROPS.shadow}: ${SHADOWS[state.shadow]};`);
  }
  if (lines.length === 0) {
    return "/* Using library defaults — nothing to override. */";
  }
  return `:root {\n${lines.join("\n")}\n}`;
}

function buildJs() {
  const opts = [];
  if (state.layout !== "bar-bottom") opts.push(`  layout: "${state.layout}"`);
  if (state.theme !== "auto") opts.push(`  theme: "${state.theme}"`);
  if (state.fab !== true) opts.push(`  floatingButton: ${state.fab}`);
  if (state.fabPos !== "bottom-start") {
    opts.push(`  floatingButtonPosition: "${state.fabPos}"`);
  }
  if (state.locale !== "en") opts.push(`  locale: "${state.locale}"`);
  const head = "const api = LibreConsentCore.init({ /* your categories */ });";
  const mount =
    opts.length === 0
      ? "LibreConsentUi.mount(api);"
      : `LibreConsentUi.mount(api, {\n${opts.join(",\n")}\n});`;
  return `${head}\n${mount}`;
}

// ---- Share link (URL hash) ---------------------------------------------

function serializeState() {
  return `c=${btoa(encodeURIComponent(JSON.stringify(state)))}`;
}

function sanitizeState(raw) {
  const next = defaultState();
  if (!raw || typeof raw !== "object") return next;
  if (LAYOUTS.includes(raw.layout)) next.layout = raw.layout;
  if (THEMES.includes(raw.theme)) next.theme = raw.theme;
  if (typeof raw.fab === "boolean") next.fab = raw.fab;
  if (FAB_POSITIONS.includes(raw.fabPos)) next.fabPos = raw.fabPos;
  if (LOCALES.includes(raw.locale)) next.locale = raw.locale;
  if (FONT_FAMILIES.includes(raw.fontFamily)) next.fontFamily = raw.fontFamily;
  if (SHADOW_KEYS.includes(raw.shadow)) next.shadow = raw.shadow;
  if (Number.isFinite(raw.radius)) next.radius = clampInt(raw.radius, 0, 24);
  if (Number.isFinite(raw.fontSize))
    next.fontSize = clampInt(raw.fontSize, 12, 20);
  if (Number.isFinite(raw.overlayAlpha)) {
    next.overlayAlpha = clampInt(raw.overlayAlpha, 0, 100);
  }
  if (raw.colors && typeof raw.colors === "object") {
    for (const [k, v] of Object.entries(raw.colors)) {
      if (
        [...COLOR_TOKENS, "overlay"].includes(k) &&
        typeof v === "string" &&
        /^#[0-9a-f]{6}$/i.test(v)
      ) {
        next.colors[k] = v.toLowerCase();
      }
    }
  }
  return next;
}

function deserializeState(hash) {
  if (!hash) return null;
  const match = /c=([^&]*)/.exec(hash);
  if (!match) return null;
  try {
    return sanitizeState(JSON.parse(decodeURIComponent(atob(match[1]))));
  } catch {
    return null;
  }
}

function clampInt(n, lo, hi) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

// ---- Presets + randomizer ----------------------------------------------

function applyPreset(id) {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) return;
  if (id === "default") {
    const fresh = defaultState();
    fresh.layout = state.layout;
    fresh.fab = state.fab;
    fresh.fabPos = state.fabPos;
    fresh.locale = state.locale;
    state = fresh;
  } else {
    const next = defaultState();
    next.layout = state.layout;
    next.fab = state.fab;
    next.fabPos = state.fabPos;
    next.locale = state.locale;
    next.theme = preset.theme ?? "auto";
    next.colors = { ...(preset.colors ?? {}) };
    next.radius = preset.radius ?? null;
    next.fontFamily = preset.fontFamily ?? "system";
    next.shadow = preset.shadow ?? "soft";
    state = next;
  }
  activePreset = id;
}

const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function surprise() {
  const h = randInt(0, 359);
  const h2 = (h + 150 + randInt(0, 60)) % 360;
  const dark = Math.random() < 0.5;
  const colors = {};
  if (dark) {
    colors.bg = hslToHex(h2, 25, 8);
    colors.fg = hslToHex(h2, 20, 95);
    colors.surface = hslToHex(h2, 22, 13);
    colors.border = hslToHex(h2, 18, 28);
    colors.muted = hslToHex(h2, 12, 70);
  } else {
    colors.bg = hslToHex(h2, 40, 98);
    colors.fg = hslToHex(h2, 30, 12);
    colors.surface = hslToHex(h2, 35, 94);
    colors.border = hslToHex(h2, 25, 82);
    colors.muted = hslToHex(h2, 12, 38);
  }
  let accentL = 50;
  let accent = hslToHex(h, 80, accentL);
  const accentFg =
    contrast("#ffffff", accent) >= contrast("#000000", accent)
      ? "#ffffff"
      : "#000000";
  for (let i = 0; i < 8 && contrast(accentFg, accent) < 4.5; i += 1) {
    accentL += accentFg === "#ffffff" ? -5 : 5;
    accent = hslToHex(h, 80, accentL);
  }
  if (contrast(accentFg, accent) < 4.5) {
    accent = hslToHex(h, 80, accentFg === "#ffffff" ? 0 : 100);
  }
  colors.accent = accent;
  colors["accent-fg"] = accentFg;
  colors.focus = accent;
  state.colors = colors;
  state.theme = dark ? "dark" : "light";
  state.radius = pick([0, 4, 8, 12, 16, 24]);
  activePreset = null;
}

// ---- Single render entrypoint ------------------------------------------

let panel = null;
let cssEl = null;
let jsEl = null;

function render() {
  applyVars();
  if (mountedKey !== mountKey()) {
    remount();
  }
  syncControls();
  renderBadges();
  cssEl.textContent = buildCss();
  jsEl.textContent = buildJs();
  history.replaceState(null, "", `#${serializeState()}`);
}

function resetAll() {
  state = defaultState();
  activePreset = "default";
  remount();
  history.replaceState(null, "", location.pathname);
  render();
}

// ---- Clipboard ----------------------------------------------------------

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.dataset.copied = "true";
    window.setTimeout(() => {
      btn.textContent = original;
      delete btn.dataset.copied;
    }, 1500);
  } catch {
    /* clipboard unavailable */
  }
}

// ---- Event wiring -------------------------------------------------------

function onInput(e) {
  const target = e.target;
  const token = target.dataset.studio;
  if (!token) return;
  if (COLOR_TOKENS.includes(token) || token === "overlay") {
    state.colors[token] = target.value;
    activePreset = null;
    render();
  } else if (token === "overlay-alpha") {
    state.overlayAlpha = Number(target.value);
    activePreset = null;
    render();
  } else if (token === "radius") {
    state.radius = Number(target.value);
    activePreset = null;
    render();
  } else if (token === "font-size") {
    state.fontSize = Number(target.value);
    activePreset = null;
    render();
  }
}

function onChange(e) {
  const target = e.target;
  const token = target.dataset.studio;
  if (token === "font-family") {
    state.fontFamily = target.value;
    activePreset = null;
    render();
  } else if (token === "shadow") {
    state.shadow = target.value;
    activePreset = null;
    render();
  } else if (token === "fab") {
    state.fab = target.checked;
    activePreset = null;
    render();
  }
}

function onClick(e) {
  const btn = e.target.closest("button");
  if (!btn) return;
  const ds = btn.dataset;
  if (ds.preset) {
    applyPreset(ds.preset);
    render();
    return;
  }
  if (ds.studioLayout) {
    state.layout = ds.studioLayout;
    activePreset = null;
    render();
    return;
  }
  if (ds.studioTheme) {
    state.theme = ds.studioTheme;
    activePreset = null;
    render();
    return;
  }
  if (ds.studioFabpos) {
    state.fabPos = ds.studioFabpos;
    activePreset = null;
    render();
    return;
  }
  if (ds.studioLocale) {
    state.locale = ds.studioLocale;
    activePreset = null;
    render();
    return;
  }
  switch (ds.studio) {
    case "surprise":
      surprise();
      render();
      break;
    case "reset-all":
      resetAll();
      break;
    case "restart":
      remount();
      break;
    case "open-prefs":
      ui?.showPreferences();
      break;
    case "open-optout":
      ui?.showOptOut();
      break;
    case "copy-css":
      copy(cssEl.textContent, btn);
      break;
    case "copy-js":
      copy(jsEl.textContent, btn);
      break;
    case "copy-link":
      copy(location.href, btn);
      break;
    default:
      break;
  }
}

// ---- Preset card rendering ---------------------------------------------

function renderPresetCards() {
  const container = panel.querySelector('[data-studio="presets"]');
  if (!container) return;
  container.replaceChildren();
  for (const preset of PRESETS) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "preset-card";
    card.dataset.preset = preset.id;
    card.setAttribute("aria-pressed", "false");
    const swatches = document.createElement("span");
    swatches.className = "preset-swatches";
    const palette = preset.id === "default" ? DEFAULTS.light : preset.colors;
    for (const token of ["bg", "surface", "accent", "fg"]) {
      const chip = document.createElement("i");
      chip.style.background = palette[token];
      swatches.append(chip);
    }
    const name = document.createElement("span");
    name.className = "preset-name";
    name.textContent = preset.label;
    card.append(swatches, name);
    container.append(card);
  }
}

// ---- Boot ---------------------------------------------------------------

function start() {
  panel = document.querySelector(".studio-panel");
  cssEl = document.querySelector('[data-studio="export-css"]');
  jsEl = document.querySelector('[data-studio="export-js"]');

  renderPresetCards();

  const loaded = deserializeState(location.hash);
  if (loaded) {
    state = loaded;
    activePreset = null;
  }

  panel.addEventListener("input", onInput);
  panel.addEventListener("change", onChange);
  panel.addEventListener("click", onClick);

  boot();
  render();

  Object.defineProperty(window, "__studio", {
    value: {
      get api() {
        return api;
      },
      get ui() {
        return ui;
      },
      get state() {
        return state;
      },
    },
    writable: false,
    configurable: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start);
} else {
  start();
}
