// Synkroniserer gemte opskrifter mellem prod (Deno Deploy + KV) og de lokale lagre.
//
//   deno task sync                 status: hvad ligger hvor
//   deno task sync pull            prod → lokalt (bevarer id og slug, så billeder passer)
//   deno task sync push            lokalt → prod (kræver KAGEATELIER_SYNC_TOKEN)
//
// Flag:
//   --store=file|kv|both   hvilke lokale lagre der skrives (standard: both)
//   --url=<https://…>      anden prod-adresse (standard: KAGEATELIER_PROD_URL eller live-siden)
//   --dry-run              vis hvad der ville ske, skriv ingenting
//   --force                overskriv også når den lokale/fjerne udgave er nyere
//
// Hvorfor id'et betyder noget: billedfilen hedder <titel-slug>-<id's første 8 tegn>.jpg.
// Gemmer man den samme opskrift igen via API'et, får den et nyt id og dermed et nyt
// filnavn — og billedet i repoet passer ikke længere. Derfor skriver vi direkte til
// lageret med importSavedRecipe i stedet for at gå gennem POST /api/recipes.

import { closeStore, getSavedRecipe, importSavedRecipe, listSavedRecipes } from "../lib/recipe_store.ts";
import type { SavedRecipe } from "../lib/types.ts";

const DEFAULT_URL = "https://kage-atelier.netsi1964.deno.net";

type StoreChoice = "file" | "kv" | "both";

interface Options {
  command: "status" | "pull" | "push";
  url: string;
  store: StoreChoice;
  dryRun: boolean;
  force: boolean;
}

function parseArgs(argv: string[]): Options {
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  const flag = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const command = (positional[0] ?? "status") as Options["command"];
  if (!["status", "pull", "push"].includes(command)) {
    throw new Error(`Ukendt kommando: ${command}. Brug status, pull eller push.`);
  }
  const store = (flag("store") ?? "both") as StoreChoice;
  if (!["file", "kv", "both"].includes(store)) {
    throw new Error(`Ukendt lager: ${store}. Brug file, kv eller both.`);
  }
  return {
    command,
    url: (flag("url") ?? Deno.env.get("KAGEATELIER_PROD_URL") ?? DEFAULT_URL).replace(/\/+$/, ""),
    store,
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

// ---- prod ----

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

async function remoteRecipes(base: string): Promise<SavedRecipe[]> {
  const summaries = await fetchJson<{ id: string }[]>(`${base}/api/recipes`);
  const recipes: SavedRecipe[] = [];
  for (const summary of summaries) {
    recipes.push(await fetchJson<SavedRecipe>(`${base}/api/recipes/${encodeURIComponent(summary.id)}`));
  }
  return recipes;
}

// ---- lokalt ----

/** Læser et lokalt lager. resolveStoreKind() slår env op ved hvert kald, så det er nok at sætte den. */
async function localRecipes(kind: "file" | "kv"): Promise<SavedRecipe[]> {
  Deno.env.set("KAGEATELIER_STORE", kind);
  const summaries = await listSavedRecipes();
  const recipes: SavedRecipe[] = [];
  for (const summary of summaries) {
    const recipe = await getSavedRecipe(summary.id);
    if (recipe) recipes.push(recipe);
  }
  return recipes;
}

async function writeLocal(kind: "file" | "kv", recipes: SavedRecipe[]) {
  Deno.env.set("KAGEATELIER_STORE", kind);
  for (const recipe of recipes) await importSavedRecipe(recipe);
}

function stores(choice: StoreChoice): ("file" | "kv")[] {
  return choice === "both" ? ["file", "kv"] : [choice];
}

// ---- sammenligning ----

interface Diff {
  onlyRemote: SavedRecipe[];
  onlyLocal: SavedRecipe[];
  remoteNewer: SavedRecipe[];
  localNewer: SavedRecipe[];
  same: SavedRecipe[];
}

function diff(remote: SavedRecipe[], local: SavedRecipe[]): Diff {
  const localById = new Map(local.map((recipe) => [recipe.id, recipe]));
  const remoteById = new Map(remote.map((recipe) => [recipe.id, recipe]));
  const out: Diff = { onlyRemote: [], onlyLocal: [], remoteNewer: [], localNewer: [], same: [] };
  for (const recipe of remote) {
    const mine = localById.get(recipe.id);
    if (!mine) out.onlyRemote.push(recipe);
    else if (recipe.updatedAt > mine.updatedAt) out.remoteNewer.push(recipe);
    else if (recipe.updatedAt < mine.updatedAt) out.localNewer.push(mine);
    else out.same.push(recipe);
  }
  for (const recipe of local) if (!remoteById.has(recipe.id)) out.onlyLocal.push(recipe);
  return out;
}

function listOut(label: string, recipes: SavedRecipe[]) {
  if (!recipes.length) return;
  console.log(`\n${label} (${recipes.length}):`);
  for (const recipe of recipes) console.log(`  · ${recipe.title}  —  ${recipe.id.slice(0, 8)}  ${recipe.imagePath ?? ""}`);
}

// ---- kommandoer ----

async function runStatus(options: Options) {
  const remote = await remoteRecipes(options.url);
  console.log(`Prod (${options.url}): ${remote.length} opskrifter`);
  for (const kind of stores(options.store)) {
    const local = await localRecipes(kind);
    const d = diff(remote, local);
    console.log(`\n── lokalt lager: ${kind} (${local.length} opskrifter) ──`);
    listOut("Kun i prod", d.onlyRemote);
    listOut("Kun lokalt", d.onlyLocal);
    listOut("Nyere i prod", d.remoteNewer);
    listOut("Nyere lokalt", d.localNewer);
    if (d.same.length) console.log(`\nEns: ${d.same.length}`);
  }
}

async function runPull(options: Options) {
  const remote = await remoteRecipes(options.url);
  console.log(`Henter ${remote.length} opskrifter fra ${options.url}`);
  for (const kind of stores(options.store)) {
    const local = await localRecipes(kind);
    const d = diff(remote, local);
    const write = options.force ? remote : [...d.onlyRemote, ...d.remoteNewer];
    console.log(`\n── ${kind} ──`);
    if (d.localNewer.length && !options.force) {
      listOut("Springes over, nyere lokalt (brug --force for at overskrive)", d.localNewer);
    }
    if (!write.length) {
      console.log("Intet at hente, alt er allerede opdateret.");
      continue;
    }
    listOut(options.dryRun ? "Ville skrive" : "Skriver", write);
    if (!options.dryRun) await writeLocal(kind, write);
  }
}

async function runPush(options: Options) {
  const token = Deno.env.get("KAGEATELIER_SYNC_TOKEN");
  if (!token) {
    throw new Error(
      "Push kræver KAGEATELIER_SYNC_TOKEN. Sæt den samme værdi som miljøvariabel på Deno Deploy " +
      "og her lokalt. Uden den er skrive-endpointet slået fra i prod.",
    );
  }
  const source = options.store === "both" ? "file" : options.store;
  const remote = await remoteRecipes(options.url);
  const local = await localRecipes(source);
  const d = diff(remote, local);
  const write = options.force ? local : [...d.onlyLocal, ...d.localNewer];
  console.log(`Sender fra lokalt lager "${source}" til ${options.url}`);
  if (d.remoteNewer.length && !options.force) {
    listOut("Springes over, nyere i prod (brug --force for at overskrive)", d.remoteNewer);
  }
  if (!write.length) {
    console.log("Intet at sende, prod er allerede opdateret.");
    return;
  }
  listOut(options.dryRun ? "Ville sende" : "Sender", write);
  if (options.dryRun) return;
  for (const recipe of write) {
    await fetchJson(`${options.url}/api/recipes/${encodeURIComponent(recipe.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-sync-token": token },
      body: JSON.stringify(recipe),
    });
    console.log(`  ✓ ${recipe.title}`);
  }
}

if (import.meta.main) {
  try {
    const options = parseArgs(Deno.args);
    if (options.command === "status") await runStatus(options);
    else if (options.command === "pull") await runPull(options);
    else await runPush(options);
  } catch (err) {
    console.error(`Fejl: ${err instanceof Error ? err.message : err}`);
    Deno.exitCode = 1;
  } finally {
    await closeStore();
  }
}
