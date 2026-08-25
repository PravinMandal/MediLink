/*
 * Contrast harness — computes WCAG 2.1 contrast ratios for every
 * text/surface token pair used for body text in each shipped mode
 * (Daylight, Obsidian, Print) and asserts WCAG AA (>= 4.5 for body
 * text, >= 3.0 for large text >= 18.66px bold / 24px regular).
 * Values below must stay in sync with globals.css.
 */
const lum = (hex) => {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};

const modes = {
  Daylight: {
    surface_canvas: "#f5f7f5", surface_data: "#ffffff", surface_elevated_solid: "#ffffff",
    text_primary: "#182622", text_secondary: "#49564f", text_tertiary: "#5c695f",
    action_link: "#0d4a3d", status_warning: "#7a4f06", status_danger: "#a32219",
    on_action_primary: "#ffffff",
  },
  Obsidian: {
    surface_canvas: "#0a0a0c", surface_data: "#101014", surface_elevated_solid: "#15151b",
    text_primary: "#edf1f7", text_secondary: "#b6c0cd", text_tertiary: "#8f99a6",
    action_link: "#6badff", status_warning: "#ffb95c", status_danger: "#ff6b6b",
    on_action_primary: "#0a0a0c",
  },
  Print: {
    surface_canvas: "#ffffff", surface_data: "#ffffff", surface_elevated_solid: "#ffffff",
    text_primary: "#111111", text_secondary: "#3d3d3d", text_tertiary: "#4f4f4f",
    action_link: "#000000", status_warning: "#5c3a00", status_danger: "#8a1109",
    on_action_primary: "#ffffff",
  },
};

// [name, fg, bg, largeOnly]
const pairs = [
  ["text-primary / surface-canvas (body)", "text_primary", "surface_canvas", false],
  ["text-primary / surface-data (body)", "text_primary", "surface_data", false],
  ["text-primary / surface-elevated (body)", "text_primary", "surface_elevated_solid", false],
  ["text-secondary / surface-data (body)", "text_secondary", "surface_data", false],
  ["text-tertiary / surface-data (meta)", "text_tertiary", "surface_data", false],
  ["action-link / surface-data (link)", "action_link", "surface_data", false],
  ["status-warning / surface-data (body)", "status_warning", "surface_data", false],
  ["status-danger / surface-data (body)", "status_danger", "surface_data", false],
  ["on-action-primary / action-primary (button label)", "on_action_primary", "action_primary", false],
];

let failed = 0;
for (const [mode, t] of Object.entries(modes)) {
  const action_primary = mode === "Daylight" ? "#14594b" : mode === "Obsidian" ? "#4dbfa4" : "#000000";
  console.log(`\n${mode}`);
  for (const [name, fgKey, bgKey, largeOnly] of pairs) {
    const fg = fgKey === "on_action_primary" ? t[fgKey] : t[fgKey];
    const bg = bgKey === "action_primary" ? action_primary : t[bgKey];
    const r = ratio(fg, bg);
    const min = largeOnly ? 3 : 4.5;
    const ok = r >= min;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${r.toFixed(2)}  (min ${min})  ${name}  ${fg} on ${bg}`);
  }
}
if (failed) {
  console.error(`\n${failed} pair(s) failed WCAG AA`);
  process.exit(1);
}
console.log("\nAll pairs meet WCAG AA.");
