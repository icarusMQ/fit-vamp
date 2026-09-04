/* Color palette presets. The values themselves live in styles.css as
   [data-theme="..."] blocks — this file only tracks which preset is active
   (persisted in localStorage) and stamps the matching data-theme attribute
   onto <html>. `swatch` here is purely cosmetic, for rendering picker
   previews without needing to read computed CSS values. */

const THEME_LS_KEY = "ft_theme";

const THEMES = {
  gothic: { name: "Gothic", swatch: ["#0a0612", "#1a1027", "#c81e3a", "#f2c14e"] },
  parchment: { name: "Parchment", swatch: ["#efe6d8", "#fbf6ec", "#9c1730", "#96690b"] },
  terminal: { name: "Terminal", swatch: ["#04120a", "#0a2614", "#ff5050", "#f5d76e"] },
};

function getThemeId() {
  try {
    const id = localStorage.getItem(THEME_LS_KEY);
    return THEMES[id] ? id : "gothic";
  } catch {
    return "gothic";
  }
}

function setThemeId(id) {
  if (!THEMES[id]) return;
  try { localStorage.setItem(THEME_LS_KEY, id); } catch {}
  document.documentElement.setAttribute("data-theme", id);
}

// Reconciles the attribute the inline <head> snippet already set (from the
// same key, before first paint) against the real registry, in case of a
// stale/corrupt value — this never causes a visible flash since it just
// confirms or corrects what's already painted.
document.documentElement.setAttribute("data-theme", getThemeId());
