// Kageatelier frontend. Viser kun. Al beregning sker i Deno-backend (lib/engine.ts).
const $ = (id) => document.getElementById(id);

const DEFAULT_SERVINGS = 8;
const DEFAULT_VIEW_SERVINGS = 2;
const SUPPORTED_LOCALES = ["da", "en", "es", "ch"];

const state = {
  locale: loadLocale(),
  ui: {},
  catalog: [],
  categories: [],
  nuts: [],
  fibers: [],
  knowledge: null,
  extras: [],
  items: [],
  cakeName: "",
  activeCat: "",
  servings: DEFAULT_VIEW_SERVINGS,
  unitMode: "kitchen",
  theme: loadTheme(),
  analysis: null,
  currentRecipe: null,
  loadedRecipeId: "",
  analyzeTimer: null,
};

// ---------- hjælpere ----------

function loadTheme() {
  try {
    const saved = localStorage.getItem("kageatelier-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API-fejl");
  return data;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function scaleFactor() {
  return state.servings / DEFAULT_SERVINGS;
}

function displayGrams(baseGrams) {
  return Math.round(baseGrams * scaleFactor() * 10) / 10;
}

function baseGrams(displayedGrams) {
  return Math.round((displayedGrams / scaleFactor()) * 10) / 10;
}

function payload() {
  return {
    items: state.items,
    cakeName: state.cakeName,
    extras: state.extras,
    servings: state.servings,
    adjustToRealistic: true,
    locale: state.locale,
  };
}

function findIngredient(id) {
  return state.extras.concat(state.catalog).find((item) => item.id === id);
}

function allCategory() {
  return state.categories[0] ?? "Alle";
}

// ---------- tema og sprog ----------

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("kageatelier-theme", theme); } catch { /* ignore */ }
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.classList.toggle("on", button.dataset.theme === theme);
  });
}

function renderLocaleToggle() {
  document.querySelectorAll("#localeToggle [data-locale]").forEach((button) => {
    button.classList.toggle("on", button.dataset.locale === state.locale);
  });
}

function setText(id, value) {
  const el = $(id);
  if (el && value != null) el.textContent = value;
}

function setPlaceholder(id, value) {
  const el = $(id);
  if (el && value != null) el.placeholder = value;
}

function applyUiStrings() {
  document.documentElement.lang = state.locale === "ch" ? "zh" : state.locale;
  setText("appTitle", t("appTitle"));
  setText("appSubtitle", t("appSubtitle"));
  setText("navBrowse", t("navBrowse"));
  setText("btnRandom", t("randomKeto"));
  setText("btnClassic", t("classicChocolate"));
  setText("btnKnowledge", t("knowledgeButton"));
  setText("btnClear", t("clearRecipe"));
  setText("ingredientsSection", t("ingredientsSection"));
  setText("yourCakeSection", t("yourCakeSection"));
  setText("analysisSection", t("analysisSection"));
  setText("recipeSection", t("recipeSection"));
  setPlaceholder("search", t("searchPlaceholder"));
  setText("servingsFieldLabel", t("servingsField"));
  setText("unitModeFieldLabel", t("unitModeField"));
  setText("blendTitle", t("blendTitle"));
  setText("blendBody", t("blendBody"));
  setPlaceholder("blendName", t("blendNamePlaceholder"));
  setText("btnBlend", t("blendButton"));
  setText("recipeIngredientsHeading", t("recipeIngredientsHeading"));
  setText("recipeMethodHeading", t("recipeMethodHeading"));
  setText("btnCopy", t("copyMarkdown"));
  setText("btnPrint", t("printRecipe"));
  setText("btnSave", t("saveRecipe"));
  setPlaceholder("saveTitle", t("saveTitlePlaceholder"));
  setPlaceholder("saveImageUrl", t("saveImagePlaceholder"));
  setText("knowTitle", t("knowledgeTitle"));
  setText("closeModal", t("close"));
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.textContent = button.dataset.theme === "light" ? t("themeLight") : t("themeDark");
  });
  document.querySelectorAll("#unitModes [data-unit]").forEach((button) => {
    button.textContent = button.dataset.unit === "kitchen" ? t("unitKitchen") : t("unitWeight");
  });
  const scoreLabels = [t("scoreSuccess"), t("scoreTaste"), t("scoreKeto")];
  document.querySelectorAll("#analysisSection ~ .body .scores .score span, .scores .score span").forEach((span, index) => {
    if (scoreLabels[index]) span.textContent = scoreLabels[index];
  });
}

async function loadLocaleBundle() {
  try {
    const res = await fetch(`/i18n/${state.locale}.json`, { cache: "no-store" });
    const bundle = await res.json();
    state.ui = bundle.ui ?? {};
  } catch {
    state.ui = {};
  }
  applyUiStrings();
  renderLocaleToggle();
}

async function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  state.locale = locale;
  try { localStorage.setItem("kageatelier-locale", locale); } catch { /* ignore */ }
  await loadLocaleBundle();
  await loadCatalog();
  scheduleAnalyze(0);
}

// ---------- katalog ----------

async function loadCatalog() {
  const catalog = await api(`/api/catalog?lang=${encodeURIComponent(state.locale)}`);
  state.catalog = catalog.ingredients;
  state.categories = catalog.categories;
  state.nuts = catalog.nuts;
  state.fibers = catalog.fibers;
  state.knowledge = catalog.knowledge;
  if (!state.categories.includes(state.activeCat)) state.activeCat = allCategory();
  renderCats();
  renderCatalog();
  renderBlendSelects();
  renderKnowledge();
}

function renderCats() {
  $("cats").innerHTML = state.categories.map((category) =>
    `<button class="chip ${category === state.activeCat ? "on" : ""}" data-cat="${esc(category)}" type="button">${esc(category)}</button>`
  ).join("");
  $("cats").querySelectorAll(".chip").forEach((button) => {
    button.onclick = () => {
      state.activeCat = button.dataset.cat;
      renderCats();
      renderCatalog();
    };
  });
}

function renderCatalog() {
  const q = $("search").value.trim().toLowerCase();
  const all = allCategory();
  const items = state.catalog.concat(state.extras).filter((item) =>
    (state.activeCat === all || item.cat === state.activeCat) &&
    (item.name.toLowerCase().includes(q) || (item.impact ?? "").toLowerCase().includes(q))
  );
  $("catalog").innerHTML = items.map((item) => `
    <div class="ing" title="${esc(item.impact)}">
      <div>
        <div class="name">${esc(item.name)}</div>
        <div class="meta">${esc(item.cat)} · ${Number(item.net).toFixed(1)} g ${esc(t("unitNetCarb", "net-carb"))} · ${Number(item.fat).toFixed(0)} g ${esc(t("unitFat", "fedt"))} · ${Number(item.prot).toFixed(0)} g ${esc(t("unitProtein", "protein"))} /100 g · keto ${Math.round(item.keto * 100)}%</div>
      </div>
      <button class="btn btn-gold" data-add="${esc(item.id)}" type="button">+ 50 g</button>
    </div>
  `).join("") || `<div class="empty">–</div>`;
  $("catalog").querySelectorAll("[data-add]").forEach((button) => {
    button.onclick = () => addIngredient(button.dataset.add, 50);
  });
}

function renderBlendSelects() {
  const option = (value, label) => `<option value="${esc(value)}">${esc(label)}</option>`;
  $("nut1").innerHTML = state.nuts.map((nut) => option(nut.mapsTo, nut.name)).join("");
  $("nut2").innerHTML = option("", "–") + state.nuts.map((nut) => option(nut.mapsTo, nut.name)).join("");
  $("fiber").innerHTML = state.fibers.map((fiber) => option(fiber.mapsTo ?? "", fiber.name)).join("");
  if (state.nuts[1]) $("nut2").value = state.nuts[1].mapsTo;
}

function renderKnowledge() {
  if (!state.knowledge) return;
  setText("knowTitle", state.knowledge.title || t("knowledgeTitle"));
  setText("knowBody", state.knowledge.body);
  $("knowPoints").innerHTML = state.knowledge.points.map((point) => `<li>${esc(point)}</li>`).join("");
}

// ---------- din kage ----------

function addIngredient(id, grams) {
  const existing = state.items.find((row) => row.id === id);
  if (existing) existing.grams = Math.round((existing.grams + baseGrams(grams)) * 10) / 10;
  else state.items.push({ id, grams: baseGrams(grams) });
  state.loadedRecipeId = "";
  renderItems();
  scheduleAnalyze();
}

function removeIngredient(id) {
  state.items = state.items.filter((row) => row.id !== id);
  renderItems();
  scheduleAnalyze();
}

function renderServingsHint() {
  setText("servingsHint", t("servingsHint"));
  $("servings").value = state.servings;
}

function renderItems() {
  const total = state.items.reduce((sum, row) => sum + displayGrams(row.grams), 0);
  setText("totalWeight", `${Math.round(total)} g`);
  renderServingsHint();
  if (!state.items.length) {
    $("recipe").className = "empty";
    $("recipe").innerHTML = esc(t("emptyRecipe"));
    return;
  }
  $("recipe").className = "";
  $("recipe").innerHTML = state.items.map((row) => {
    const item = findIngredient(row.id);
    return `
      <div class="recipe-item" data-id="${esc(row.id)}">
        <div>
          <div>${esc(item?.name ?? row.id)}</div>
          <div class="tiny">${esc(item?.cat ?? "")}</div>
        </div>
        <label class="amount-field"><input type="number" min="0" step="1" value="${displayGrams(row.grams)}" data-grams="${esc(row.id)}" /><span>g</span></label>
        <button class="btn btn-ghost" data-remove="${esc(row.id)}" type="button">✕</button>
      </div>
    `;
  }).join("");
  $("recipe").querySelectorAll("[data-grams]").forEach((input) => {
    input.onchange = () => {
      const row = state.items.find((item) => item.id === input.dataset.grams);
      if (!row) return;
      const value = Number(input.value);
      if (!(value > 0)) return removeIngredient(row.id);
      row.grams = baseGrams(value);
      state.loadedRecipeId = "";
      renderItems();
      scheduleAnalyze();
    };
  });
  $("recipe").querySelectorAll("[data-remove]").forEach((button) => {
    button.onclick = () => removeIngredient(button.dataset.remove);
  });
}

// ---------- analyse ----------

function scheduleAnalyze(delay = 180) {
  clearTimeout(state.analyzeTimer);
  state.analyzeTimer = setTimeout(analyze, delay);
}

async function analyze() {
  if (!state.items.length) {
    renderAnalysis(null);
    return;
  }
  try {
    const analysis = await api("/api/analyze", { method: "POST", body: JSON.stringify(payload()) });
    renderAnalysis(analysis);
  } catch (err) {
    $("verdict").textContent = `${t("backendOffline")} (${err.message})`;
  }
}

function scoreColor(el, n, kind) {
  if (kind === "keto") el.style.color = n > 75 ? "var(--keto)" : n > 45 ? "var(--warn)" : "var(--bad)";
  else el.style.color = n > 70 ? "var(--good)" : n > 45 ? "var(--warn)" : "var(--bad)";
}

function macrosContainer() {
  let el = $("macros");
  if (!el) {
    el = document.createElement("div");
    el.id = "macros";
    el.className = "macros";
    $("ketoMeta").insertAdjacentElement("afterend", el);
  }
  return el;
}

function renderMacros(macros) {
  const el = macrosContainer();
  if (!macros) {
    el.innerHTML = "";
    return;
  }
  const row = (label, key, unit = "g", digits = 1) =>
    `<tr><td>${esc(label)}</td><td>${Number(macros.perSlice[key]).toFixed(digits)} ${unit}</td><td>${Number(macros.per100[key]).toFixed(digits)} ${unit}</td></tr>`;
  const e = macros.energyPct;
  const tile = (label, value, unit, color) =>
    `<div class="score"><span>${esc(label)}</span><b style="color:${color}">${value}<small> ${unit}</small></b><span class="tiny">${esc(t("macroPerSliceCaption", "pr. stykke"))}</span></div>`;
  el.innerHTML = `
    <div class="scores macro-tiles">
      ${tile(t("macroCarbs", "Kulhydrater (net)"), macros.perSlice.net.toFixed(1), "g", macros.perSlice.net <= 5 ? "var(--keto)" : macros.perSlice.net <= 10 ? "var(--warn)" : "var(--bad)")}
      ${tile(t("macroFat", "Fedt"), macros.perSlice.fat.toFixed(1), "g", "var(--gold)")}
      ${tile(t("macroProtein", "Protein"), macros.perSlice.prot.toFixed(1), "g", "var(--cocoa)")}
    </div>
    <table class="macro-table">
      <thead><tr><th>${esc(t("macrosTitle", "Makroer"))}</th><th>${esc(t("macrosPerSlice", "Pr. stykke"))}</th><th>${esc(t("macrosPer100", "Pr. 100 g"))}</th></tr></thead>
      <tbody>
        ${row(t("unitNetCarb", "net-carb"), "net")}
        ${row(t("unitFat", "fedt"), "fat")}
        ${row(t("unitProtein", "protein"), "prot")}
        ${row(t("unitFiber", "fiber"), "fib")}
        ${row(t("unitKcal", "kcal"), "cal", "", 0)}
      </tbody>
    </table>
    <div class="energy-bar" title="${esc(t("energySplit", "Energifordeling"))}">
      <span style="width:${e.fat}%;background:var(--keto)"></span>
      <span style="width:${e.prot}%;background:var(--gold)"></span>
      <span style="width:${e.carb}%;background:var(--bad)"></span>
    </div>
    <div class="energy-legend">
      <span><i style="background:var(--keto)"></i>${e.fat} % ${esc(t("unitFat", "fedt"))}</span>
      <span><i style="background:var(--gold)"></i>${e.prot} % ${esc(t("unitProtein", "protein"))}</span>
      <span><i style="background:var(--bad)"></i>${e.carb} % ${esc(t("unitCarb", "kulhydrat"))}</span>
    </div>`;
}

function renderAnalysis(analysis) {
  state.analysis = analysis;
  if (!analysis || analysis.empty) {
    ["sSuccess", "sTaste", "sKeto"].forEach((id) => { $(id).textContent = "–"; $(id).style.color = ""; });
    $("ketoMeta").textContent = "";
    renderMacros(null);
    $("bars").innerHTML = "";
    $("verdict").textContent = analysis?.verdict ?? t("recipeDefaultLead");
    $("suggest").innerHTML = "";
    $("impacts").innerHTML = "";
    renderRecipeCard(null);
    return;
  }
  $("sSuccess").textContent = analysis.success;
  $("sTaste").textContent = analysis.taste;
  $("sKeto").textContent = analysis.keto;
  scoreColor($("sSuccess"), analysis.success, "success");
  scoreColor($("sTaste"), analysis.taste, "taste");
  scoreColor($("sKeto"), analysis.keto, "keto");
  const tone = analysis.keto >= 80 ? "pill-good" : analysis.keto >= 50 ? "pill-mid" : "pill-bad";
  $("ketoMeta").innerHTML = `<span class="pill ${tone}">${esc(analysis.ketoLabel)}</span>
    <span class="pill pill-mid">${analysis.netPer100.toFixed(1)} g net-carb/100 g</span>
    <span class="pill pill-mid">${analysis.netPerSlice.toFixed(1)} g / ${analysis.servings}</span>`;
  renderMacros(analysis.macros);
  $("bars").innerHTML = analysis.properties.map((prop) => `
    <div class="bar-row">
      <span>${esc(prop.name)}</span>
      <div class="track"><div class="fill" style="width:${Math.round(prop.value)}%;background:${esc(prop.color)}"></div></div>
      <span>${Math.round(prop.value)}</span>
    </div>
  `).join("");
  $("verdict").textContent = analysis.verdict;
  $("suggest").innerHTML = `<ul>${analysis.suggestions.map((s) => `<li><b>${esc(s.title)}</b> – ${esc(s.detail)}</li>`).join("")}</ul>`;
  $("impacts").innerHTML = analysis.impacts.map((line) => `
    <div class="impact-line">
      <b>${esc(line.name)}</b> <span class="tiny">${Math.round(line.grams)} g · ${Math.round(line.share * 100)}%${line.roles.length ? " · " + esc(line.roles.join(", ")) : ""}</span>
      <div class="tiny">${esc(line.impact)}</div>
    </div>
  `).join("");
  renderRecipeCard(analysis.recipe);
}

function renderRecipeCard(recipe) {
  state.currentRecipe = recipe;
  if (!recipe) {
    setText("recipeBadge", t("recipeBadgeEmpty"));
    setText("recipeTitle", t("recipeDefaultTitle"));
    setText("recipeLead", t("recipeDefaultLead"));
    $("recipeMeta").innerHTML = "";
    $("recipeIngredients").className = "empty";
    $("recipeIngredients").textContent = "–";
    $("recipeMethod").className = "empty";
    $("recipeMethod").textContent = "–";
    return;
  }
  const badge = recipe.badge === "Keto-opskrift" ? t("recipeBadgeKeto", recipe.badge) : t("recipeBadge", recipe.badge);
  setText("recipeBadge", badge);
  setText("recipeTitle", recipe.title);
  setText("recipeLead", recipe.lead);
  $("recipeMeta").innerHTML = recipe.metaPills.map((pill) => `<span class="pill pill-${esc(pill.tone)}">${esc(pill.label)}</span>`).join("");
  if (recipe.macros) {
    const m = recipe.macros;
    const line = (label, set, withFib) =>
      `<div class="tiny"><b>${esc(label)}:</b> ${set.net.toFixed(1)} g ${esc(t("unitNetCarb", "net-carb"))} · ${set.fat.toFixed(1)} g ${esc(t("unitFat", "fedt"))} · ${set.prot.toFixed(1)} g ${esc(t("unitProtein", "protein"))}${withFib ? ` · ${set.fib.toFixed(1)} g ${esc(t("unitFiber", "fiber"))}` : ""} · ${set.cal} kcal</div>`;
    $("recipeMeta").insertAdjacentHTML("beforeend",
      `<div class="macros">${line(t("macrosPerSlice", "Pr. stykke"), m.perSlice, true)}${line(t("macrosPer100", "Pr. 100 g"), m.per100, false)}<div class="tiny"><b>${esc(t("energySplit", "Energifordeling"))}:</b> ${m.energyPct.fat} % ${esc(t("unitFat", "fedt"))} · ${m.energyPct.prot} % ${esc(t("unitProtein", "protein"))} · ${m.energyPct.carb} % ${esc(t("unitCarb", "kulhydrat"))}</div></div>`);
  }
  $("recipeIngredients").className = "";
  $("recipeIngredients").innerHTML = recipe.groups.map((group) => `
    <div class="recipe-section-label">${esc(group.category)}</div>
    <ul class="ing-print">${group.lines.map((line) =>
      `<li><span class="amount">${esc(state.unitMode === "weight" ? line.weightLabel : line.kitchenLabel)}</span> ${esc(line.name)}</li>`
    ).join("")}</ul>
  `).join("");
  $("recipeMethod").className = "";
  $("recipeMethod").innerHTML = `<ol>${recipe.steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol>`;
}

// ---------- generatorer, blend, gem ----------

function applyPreset(data) {
  state.items = data.items.map((row) => ({ id: row.id, grams: row.grams }));
  state.cakeName = data.cakeName ?? "";
  state.loadedRecipeId = "";
  $("saveTitle").value = state.cakeName;
  renderItems();
  renderAnalysis(data);
}

async function runPreset(path) {
  try {
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({ extras: state.extras, servings: state.servings, adjustToRealistic: true, locale: state.locale }),
    });
    applyPreset(data);
  } catch (err) {
    $("verdict").textContent = `${t("backendOffline")} (${err.message})`;
  }
}

async function blend() {
  const body = {
    nut1: $("nut1").value,
    nut1g: Number($("nut1g").value) || 0,
    nut2: $("nut2").value || undefined,
    nut2g: Number($("nut2g").value) || 0,
    fiber: $("fiber").value || undefined,
    fiberg: Number($("fiberg").value) || 0,
    name: $("blendName").value.trim(),
  };
  try {
    const data = await api("/api/blend", { method: "POST", body: JSON.stringify(body) });
    state.extras.push(data.ingredient);
    state.items.push({ id: data.ingredient.id, grams: data.grams });
    state.loadedRecipeId = "";
    renderCatalog();
    renderItems();
    scheduleAnalyze(0);
  } catch (err) {
    $("verdict").textContent = err.message;
  }
}

async function saveRecipe() {
  if (!state.items.length) return;
  const title = $("saveTitle").value.trim() || state.cakeName || state.currentRecipe?.title || "";
  try {
    const saved = await api("/api/recipes", {
      method: "POST",
      body: JSON.stringify({
        items: state.items,
        extras: state.extras,
        cakeName: title,
        servings: state.servings,
        imageUrl: $("saveImageUrl").value.trim() || undefined,
        locale: state.locale,
      }),
    });
    state.loadedRecipeId = saved.id;
    const imageNote = saved.images?.find((image) => image.kind === "cover")?.url
      ? ""
      : ` · Billede: læg ${saved.imagePath} (jpg, png eller webp) i repoet, eller upload fra opskriftsbiblioteket.`;
    $("saveStatus").textContent = `${t("saveStored")}: ${saved.title}${imageNote}`;
  } catch (err) {
    $("saveStatus").textContent = `${t("saveFailed")}: ${err.message}`;
  }
}

async function loadSavedRecipeFromUrl() {
  const id = new URLSearchParams(location.search).get("recipe");
  if (!id) return;
  try {
    const recipe = await api(`/api/recipes/${encodeURIComponent(id)}`);
    state.extras = recipe.extras ?? [];
    state.items = recipe.items.map((row) => ({ id: row.id, grams: row.grams }));
    state.cakeName = recipe.cakeName || recipe.title || "";
    state.servings = recipe.servings || state.servings;
    state.loadedRecipeId = recipe.id;
    $("saveTitle").value = state.cakeName;
    renderCatalog();
    renderItems();
    scheduleAnalyze(0);
    $("saveStatus").textContent = `${t("saveLoaded")}: ${recipe.title}`;
  } catch (err) {
    $("saveStatus").textContent = `${t("saveFailed")}: ${err.message}`;
  }
}

async function copyMarkdown() {
  const recipe = state.currentRecipe;
  if (!recipe) return;
  const text = state.unitMode === "weight" ? recipe.textWeight : recipe.textKitchen;
  try {
    await navigator.clipboard.writeText(text);
    $("btnCopy").textContent = t("copied");
    setTimeout(() => { $("btnCopy").textContent = t("copyReset"); }, 1600);
  } catch {
    window.prompt("Markdown", text);
  }
}

function clearRecipe() {
  state.items = [];
  state.cakeName = "";
  state.loadedRecipeId = "";
  $("saveTitle").value = "";
  $("saveStatus").textContent = "";
  renderItems();
  renderAnalysis(null);
}

function toggleModal(open) {
  $("modal").style.display = open ? "flex" : "none";
}

// ---------- binding ----------

function bind() {
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.onclick = () => applyTheme(button.dataset.theme);
  });
  document.querySelectorAll("#localeToggle [data-locale]").forEach((button) => {
    button.onclick = () => setLocale(button.dataset.locale);
  });
  document.querySelectorAll("#unitModes [data-unit]").forEach((button) => {
    button.onclick = () => {
      state.unitMode = button.dataset.unit;
      document.querySelectorAll("#unitModes [data-unit]").forEach((b) => b.classList.toggle("on", b === button));
      renderRecipeCard(state.currentRecipe);
    };
  });
  $("search").oninput = renderCatalog;
  $("servings").onchange = () => {
    const value = Math.max(1, Math.min(32, Math.round(Number($("servings").value) || DEFAULT_VIEW_SERVINGS)));
    state.servings = value;
    renderItems();
    scheduleAnalyze(0);
  };
  $("btnRandom").onclick = () => runPreset("/api/random-keto");
  $("btnClassic").onclick = () => runPreset("/api/classic");
  $("btnKnowledge").onclick = () => toggleModal(true);
  $("closeModal").onclick = () => toggleModal(false);
  $("modal").onclick = (event) => { if (event.target === $("modal")) toggleModal(false); };
  $("btnClear").onclick = clearRecipe;
  $("btnBlend").onclick = blend;
  $("btnSave").onclick = saveRecipe;
  $("btnCopy").onclick = copyMarkdown;
  $("btnPrint").onclick = () => window.print();
  $("saveTitle").oninput = () => { state.cakeName = $("saveTitle").value.trim(); scheduleAnalyze(400); };
}

async function init() {
  applyTheme(state.theme);
  bind();
  await loadLocaleBundle();
  try {
    await loadCatalog();
  } catch (err) {
    $("catalog").innerHTML = `<div class="note">${esc(t("backendOffline"))} (${esc(err.message)})</div>`;
    return;
  }
  renderItems();
  renderAnalysis(null);
  await loadSavedRecipeFromUrl();
}

init();
