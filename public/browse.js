const $ = (id) => document.getElementById(id);

const SUPPORTED_LOCALES = ["da", "en", "es", "ch"];

const state = {
  uploadEnabled: false,
  locale: loadLocale(),
  ui: {},
  query: "",
  style: "",
  tag: "",
  theme: localStorage.getItem("kageatelier-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
};

function loadLocale() {
  try {
    const saved = localStorage.getItem("kageatelier-locale");
    if (SUPPORTED_LOCALES.includes(saved)) return saved;
  } catch { /* ignore */ }
  return "da";
}

function t(key, fallback) {
  return state.ui[key] ?? fallback ?? key;
}

function setText(id, value) {
  const el = $(id);
  if (el && value != null) el.textContent = value;
}

async function loadLocaleBundle() {
  try {
    const res = await fetch(`/i18n/${state.locale}.json`, { cache: "no-store" });
    state.ui = (await res.json()).ui ?? {};
  } catch {
    state.ui = {};
  }
  document.documentElement.lang = state.locale === "ch" ? "zh" : state.locale;
  setText("browseTitle", t("browseTitle"));
  setText("browseSubtitle", t("browseSubtitle"));
  setText("navBack", t("navBack"));
  setText("browseEmpty", t("browseEmpty"));
  const q = $("browseQuery"); if (q) q.placeholder = t("browseQueryPlaceholder");
  const tag = $("browseTag"); if (tag) tag.placeholder = t("browseTagPlaceholder");
  const styleAll = $("browseStyle")?.querySelector('option[value=""]'); if (styleAll) styleAll.textContent = t("browseStyleAll");
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.textContent = button.dataset.theme === "light" ? t("themeLight") : t("themeDark");
  });
  document.querySelectorAll("#localeToggle [data-locale]").forEach((button) => {
    button.classList.toggle("on", button.dataset.locale === state.locale);
  });
}

async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  state.locale = locale;
  try { localStorage.setItem("kageatelier-locale", locale); } catch { /* ignore */ }
  await loadLocaleBundle();
  await refresh();
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("kageatelier-theme", theme);
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.classList.toggle("on", button.dataset.theme === theme);
  });
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API-fejl");
  return data;
}

function queryString() {
  const params = new URLSearchParams();
  if (state.query) params.set("query", state.query);
  if (state.style) params.set("style", state.style);
  if (state.tag) params.set("tag", state.tag);
  params.set("lang", state.locale);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function renderList(items) {
  $("browseEmpty").hidden = items.length > 0;
  $("browseGrid").innerHTML = items.map((item) => {
    const image = item.image?.url
      ? `<img class="browse-image" src="${item.image.url}" alt="${item.image.alt}" />`
      : `<div class="browse-placeholder browse-placeholder-image"><img class="browse-image" src="/images/default-cover.jpg" alt="" /><span>${t("imageMissing", "Intet billede endnu")} · <code>${item.imagePath}</code> (.jpg / .png / .webp)</span></div>`;
    const upload = state.uploadEnabled
      ? `<label class="btn btn-ghost upload-btn">${item.image?.url ? "Skift billede" : "Upload billede"}<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${item.id}" hidden /></label>`
      : "";
    return `
      <article class="card browse-card">
        ${image}
        <div class="body">
          <div class="browse-topline">
            <span class="pill pill-mid">${item.style}</span>
            <span class="pill pill-${item.ketoLabel.includes("keto") ? "good" : "mid"}">${item.ketoLabel}</span>
          </div>
          <h3>${item.title}</h3>
          <p class="browse-summary">${item.summary}</p>
          <div class="recipe-meta">
            <span class="pill pill-mid">${item.servings} ${t("servingsLabel", "personer")}</span>
            <span class="pill pill-mid">${item.difficulty}</span>
            <span class="pill pill-mid">${new Date(item.updatedAt).toLocaleDateString("da-DK")}</span>
          </div>
          <div class="browse-tags">${item.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          <div class="browse-footer">
            <span class="tiny">${t("browseMetadata", "Metadata")}: ${item.provider}</span>
            <a class="btn btn-gold" href="/index.html?recipe=${encodeURIComponent(item.id)}">${t("browseOpen", "Åbn i atelieret")}</a>
            ${upload}
            <button class="btn btn-danger" data-delete="${item.id}" type="button">Slet</button>
          </div>
          <div class="tiny upload-status" data-status="${item.id}"></div>
        </div>
      </article>
    `;
  }).join("");
  $("browseGrid").querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = () => deleteRecipe(button.dataset.delete, button.closest(".browse-card")?.querySelector("h3")?.textContent ?? "");
  });
  $("browseGrid").querySelectorAll("[data-upload]").forEach((input) => {
    input.onchange = () => uploadImage(input.dataset.upload, input.files?.[0]);
  });
}

async function deleteRecipe(id, title) {
  if (!window.confirm(`Slet "${title}"? Det kan ikke fortrydes.`)) return;
  try {
    await api(`/api/recipes/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  } catch (err) {
    const status = document.querySelector(`[data-status="${id}"]`);
    if (status) status.textContent = err.message;
  }
}

async function uploadImage(id, file) {
  if (!file) return;
  const status = document.querySelector(`[data-status="${id}"]`);
  if (status) status.textContent = "Uploader…";
  try {
    const res = await fetch(`/api/recipes/${encodeURIComponent(id)}/image`, {
      method: "POST",
      headers: { "content-type": file.type },
      body: file,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload fejlede");
    if (status) status.textContent = `Gemt som ${data.path}. ${data.hint}`;
    await refresh();
    const after = document.querySelector(`[data-status="${id}"]`);
    if (after) after.textContent = `Gemt som ${data.path}. Husk: git add + commit + push.`;
  } catch (err) {
    if (status) status.textContent = err.message;
  }
}

async function loadHealth() {
  try {
    const health = await api("/api/health");
    state.uploadEnabled = Boolean(health.imageUpload);
  } catch {
    state.uploadEnabled = false;
  }
}

async function refresh() {
  try {
    const items = await api(`/api/recipes${queryString()}`);
    renderList(items);
  } catch (err) {
    $("browseGrid").innerHTML = `<div class="note">Kunne ikke hente opskrifter: ${err.message}</div>`;
    $("browseEmpty").hidden = true;
  }
}

function bind() {
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.onclick = () => applyTheme(button.dataset.theme);
  });
  document.querySelectorAll("#localeToggle [data-locale]").forEach((button) => {
    button.onclick = () => setLocale(button.dataset.locale);
  });
  $("browseQuery").oninput = () => {
    state.query = $("browseQuery").value.trim();
    refresh();
  };
  $("browseStyle").onchange = () => {
    state.style = $("browseStyle").value;
    refresh();
  };
  $("browseTag").oninput = () => {
    state.tag = $("browseTag").value.trim();
    refresh();
  };
}

applyTheme(state.theme);
bind();
loadLocaleBundle().then(loadHealth).then(refresh);