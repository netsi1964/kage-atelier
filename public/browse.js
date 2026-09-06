const $ = (id) => document.getElementById(id);

const state = {
  query: "",
  style: "",
  tag: "",
  theme: localStorage.getItem("kageatelier-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
};

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("kageatelier-theme", theme);
  document.querySelectorAll("#themeToggle [data-theme]").forEach((button) => {
    button.classList.toggle("on", button.dataset.theme === theme);
  });
}

async function api(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API-fejl");
  return data;
}

function queryString() {
  const params = new URLSearchParams();
  if (state.query) params.set("query", state.query);
  if (state.style) params.set("style", state.style);
  if (state.tag) params.set("tag", state.tag);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function renderList(items) {
  $("browseEmpty").hidden = items.length > 0;
  $("browseGrid").innerHTML = items.map((item) => {
    const image = item.image?.url
      ? `<img class="browse-image" src="${item.image.url}" alt="${item.image.alt}" />`
      : `<div class="browse-placeholder">Billede klar senere<br><span>${item.image?.prompt ?? "AI-prompt gemt til senere"}</span></div>`;
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
            <span class="pill pill-mid">${item.servings} personer</span>
            <span class="pill pill-mid">${item.difficulty}</span>
            <span class="pill pill-mid">${new Date(item.updatedAt).toLocaleDateString("da-DK")}</span>
          </div>
          <div class="browse-tags">${item.tags.map((tag) => `<span class="chip">${tag}</span>`).join("")}</div>
          <div class="browse-footer">
            <span class="tiny">Metadata: ${item.provider}</span>
            <a class="btn btn-gold" href="/index.html?recipe=${encodeURIComponent(item.id)}">Åbn i atelieret</a>
          </div>
        </div>
      </article>
    `;
  }).join("");
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
refresh();