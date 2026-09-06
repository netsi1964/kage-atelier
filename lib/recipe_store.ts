import { dirname, join } from "jsr:@std/path";
import { analyzeCake } from "./engine.ts";
import { localizeMetadata, localizeText, normalizeLocale } from "./i18n.ts";
import { generateRecipeMetadata } from "./recipe_ai.ts";
import { attachRepoImage, findRecipeImage, recipeSlug, summaryImageFields } from "./images.ts";
import type {
  Locale,
  SaveRecipeInput,
  SavedRecipe,
  SavedRecipeSummary,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Lager: to bagender med samme lille interface.
//   file  – JSON-fil (lokal udvikling). Sti: KAGEATELIER_RECIPES_FILE eller data/recipes.json
//   kv    – Deno KV (Deno Deploy). Lokalt: SQLite-fil via KAGEATELIER_KV_PATH eller data/kageatelier.kv
// Valg: KAGEATELIER_STORE=file|kv. Uden env: kv på Deno Deploy, ellers file.
// ---------------------------------------------------------------------------

export type StoreKind = "file" | "kv";

interface RecipeBackend {
  kind: StoreKind;
  list(): Promise<SavedRecipe[]>;
  get(id: string): Promise<SavedRecipe | null>;
  put(recipe: SavedRecipe): Promise<void>;
}

function onDeploy(): boolean {
  return Boolean(Deno.env.get("DENO_DEPLOYMENT_ID") || Deno.env.get("DENO_REGION"));
}

export function resolveStoreKind(): StoreKind {
  const forced = (Deno.env.get("KAGEATELIER_STORE") ?? "").toLowerCase();
  if (forced === "file" || forced === "kv") return forced;
  return onDeploy() ? "kv" : "file";
}

// ---- file ----

function dbFilePath() {
  return Deno.env.get("KAGEATELIER_RECIPES_FILE") ?? join(import.meta.dirname ?? Deno.cwd(), "..", "data", "recipes.json");
}

interface RecipeArchive {
  recipes: SavedRecipe[];
}

async function readFileArchive(): Promise<RecipeArchive> {
  try {
    const raw = await Deno.readTextFile(dbFilePath());
    const data = JSON.parse(raw) as RecipeArchive;
    return { recipes: Array.isArray(data.recipes) ? data.recipes : [] };
  } catch {
    return { recipes: [] };
  }
}

async function writeFileArchive(archive: RecipeArchive) {
  await Deno.mkdir(dirname(dbFilePath()), { recursive: true });
  await Deno.writeTextFile(dbFilePath(), JSON.stringify(archive, null, 2));
}

const fileBackend: RecipeBackend = {
  kind: "file",
  async list() {
    return (await readFileArchive()).recipes;
  },
  async get(id) {
    return (await readFileArchive()).recipes.find((recipe) => recipe.id === id) ?? null;
  },
  async put(recipe) {
    const archive = await readFileArchive();
    archive.recipes = [recipe, ...archive.recipes.filter((item) => item.id !== recipe.id)];
    await writeFileArchive(archive);
  },
};

// ---- kv ----

const KV_PREFIX = ["recipes"] as const;
let kvPromise: Promise<Deno.Kv> | null = null;

function kvPath(): string | undefined {
  if (onDeploy()) return undefined;
  const custom = Deno.env.get("KAGEATELIER_KV_PATH");
  if (custom) return custom;
  return join(import.meta.dirname ?? Deno.cwd(), "..", "data", "kageatelier.kv");
}

async function openKv(): Promise<Deno.Kv> {
  if (!kvPromise) {
    const path = kvPath();
    if (path && path !== ":memory:") await Deno.mkdir(dirname(path), { recursive: true });
    kvPromise = Deno.openKv(path);
  }
  return await kvPromise;
}

/** Lukker KV-forbindelsen (bruges af tests og migrering). */
export async function closeStore() {
  if (kvPromise) {
    const kv = await kvPromise;
    kv.close();
    kvPromise = null;
  }
}

const kvBackend: RecipeBackend = {
  kind: "kv",
  async list() {
    const kv = await openKv();
    const recipes: SavedRecipe[] = [];
    for await (const entry of kv.list<SavedRecipe>({ prefix: [...KV_PREFIX] })) recipes.push(entry.value);
    return recipes;
  },
  async get(id) {
    const kv = await openKv();
    const entry = await kv.get<SavedRecipe>([...KV_PREFIX, id]);
    return entry.value ?? null;
  },
  async put(recipe) {
    const kv = await openKv();
    await kv.set([...KV_PREFIX, recipe.id], recipe);
  },
};

function backend(): RecipeBackend {
  return resolveStoreKind() === "kv" ? kvBackend : fileBackend;
}

/** Skriver en opskrift direkte til det aktive lager uden ny analyse (migrering). */
export async function importSavedRecipe(recipe: SavedRecipe): Promise<void> {
  await backend().put(recipe);
}

// ---------------------------------------------------------------------------

interface RecipeFilters {
  query?: string;
  style?: string;
  tag?: string;
}

function usedExtras(input: SaveRecipeInput) {
  const ids = new Set(input.items.map((item) => item.id));
  return (input.extras ?? []).filter((item) => ids.has(item.id));
}

async function summaryOf(recipe: SavedRecipe, locale: Locale): Promise<SavedRecipeSummary> {
  const metadata = localizeMetadata(locale, recipe.metadata);
  const found = await findRecipeImage(recipe);
  const cover = recipe.images.find((image) => image.kind === "cover");
  const image = found
    ? { id: cover?.id ?? recipe.id, kind: "cover" as const, status: "ready" as const, url: found.url, alt: cover?.alt ?? recipe.title, prompt: cover?.prompt ?? "" }
    : cover;
  return {
    ...summaryImageFields(recipe),
    id: recipe.id,
    title: localizeText(locale, recipe.title),
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    servings: recipe.servings,
    ketoLabel: localizeText(locale, recipe.analysis.ketoLabel),
    summary: metadata.summary,
    style: metadata.style,
    difficulty: metadata.difficulty,
    tags: metadata.tags,
    image,
    provider: metadata.provider,
  };
}

function matches(recipe: SavedRecipe, filters: RecipeFilters) {
  const query = (filters.query ?? "").trim().toLowerCase();
  const style = (filters.style ?? "").trim().toLowerCase();
  const tag = (filters.tag ?? "").trim().toLowerCase();
  if (style && recipe.metadata.style.toLowerCase() !== style) return false;
  if (tag && !recipe.metadata.tags.some((item) => item.toLowerCase().includes(tag))) return false;
  if (!query) return true;
  const haystack = [
    recipe.title,
    recipe.metadata.summary,
    recipe.metadata.occasion,
    recipe.metadata.tags.join(" "),
    recipe.analysis.verdict,
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

export async function listSavedRecipes(filters: RecipeFilters & { locale?: string } = {}): Promise<SavedRecipeSummary[]> {
  const locale = normalizeLocale(filters.locale);
  const recipes = await backend().list();
  const sorted = recipes
    .filter((recipe) => matches(recipe, filters))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return await Promise.all(sorted.map((recipe) => summaryOf(recipe, locale)));
}

export async function getSavedRecipe(id: string): Promise<SavedRecipe | null> {
  const recipe = await backend().get(id);
  return recipe ? await attachRepoImage(recipe) : null;
}

export async function saveRecipe(input: SaveRecipeInput): Promise<SavedRecipe> {
  const extras = usedExtras(input);
  const analysis = analyzeCake({
    items: input.items,
    extras,
    cakeName: input.cakeName,
    servings: input.servings,
    adjustToRealistic: true,
    locale: input.locale,
  });
  if (analysis.empty || !analysis.recipe) {
    throw new Error("Opskriften kan ikke gemmes uden ingredienser.");
  }

  const now = new Date().toISOString();
  const title = analysis.recipe.title;
  const metadata = await generateRecipeMetadata({ title, recipe: analysis.recipe, analysis });
  const imagePrompt = metadata.imagePrompt;
  const images = [
    {
      id: crypto.randomUUID(),
      kind: "cover" as const,
      status: input.imageUrl ? "ready" as const : "planned" as const,
      url: input.imageUrl,
      alt: input.imageAlt?.trim() || `${title} på fad`,
      prompt: imagePrompt,
    },
  ];

  const id = crypto.randomUUID();
  const recipe: SavedRecipe = {
    id,
    slug: recipeSlug({ id, title }),
    title,
    cakeName: input.cakeName?.trim() || title,
    createdAt: now,
    updatedAt: now,
    servings: analysis.servings,
    items: input.items,
    extras,
    recipe: analysis.recipe,
    analysis: {
      success: analysis.success,
      taste: analysis.taste,
      keto: analysis.keto,
      ketoLabel: analysis.ketoLabel,
      netPer100: analysis.netPer100,
      netPerSlice: analysis.netPerSlice,
      totalGrams: analysis.totalGrams,
      verdict: analysis.verdict,
    },
    metadata,
    images,
  };

  await backend().put(recipe);
  return await attachRepoImage(recipe);
}
