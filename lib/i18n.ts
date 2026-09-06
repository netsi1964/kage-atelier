import { join } from "jsr:@std/path";
import type {
  Analysis,
  CatalogPayload,
  Ingredient,
  Locale,
  RecipeMetadata,
  WrittenRecipe,
} from "./types.ts";

interface TranslationBundle {
  code: Locale;
  label: string;
  ui: Record<string, string>;
  categories: Record<string, string>;
  ingredients: Record<string, string>;
  nuts: Record<string, string>;
  fibers: Record<string, string>;
  phrases: Record<string, string>;
  knowledge: {
    title: string;
    body: string;
    points: string[];
  };
}

const SUPPORTED: Locale[] = ["da", "en", "es", "ch"];
const DEFAULT_LOCALE: Locale = "da";
const cache = new Map<Locale, TranslationBundle>();

export function normalizeLocale(input?: string | null): Locale {
  const value = (input ?? "").toLowerCase();
  return SUPPORTED.includes(value as Locale) ? value as Locale : DEFAULT_LOCALE;
}

function filePath(locale: Locale): string {
  return join(import.meta.dirname ?? Deno.cwd(), "..", "public", "i18n", `${locale}.json`);
}

export function getTranslations(locale?: string | null): TranslationBundle {
  const code = normalizeLocale(locale);
  if (cache.has(code)) return cache.get(code)!;
  const raw = Deno.readTextFileSync(filePath(code));
  const parsed = JSON.parse(raw) as TranslationBundle;
  cache.set(code, parsed);
  return parsed;
}

function replaceAll(text: string, pairs: Array<[string, string]>): string {
  let value = text;
  for (const [from, to] of pairs) {
    value = value.split(from).join(to);
  }
  return value;
}

export function localizeText(locale: string | null | undefined, text: string): string {
  const bundle = getTranslations(locale);
  const pairs = Object.entries(bundle.phrases).sort((a, b) => b[0].length - a[0].length);
  return replaceAll(text, pairs);
}

export function localizeIngredientName(locale: string | null | undefined, ingredient: Ingredient): string {
  const bundle = getTranslations(locale);
  return bundle.ingredients[ingredient.id] ?? localizeText(locale, ingredient.name);
}

function localizeRecipeText(locale: Locale, recipe: WrittenRecipe): WrittenRecipe {
  const bundle = getTranslations(locale);
  const categoryTitle = bundle.ui.recipeIngredientsHeading ?? "Ingredients";
  const methodTitle = bundle.ui.recipeMethodHeading ?? "Method";
  const temperatureLabel = bundle.ui.temperatureLabel ?? "Oven temperature";
  const timeLabel = bundle.ui.timeLabel ?? "Time";
  const formLabel = bundle.ui.formLabel ?? "Tin";
  const servingsLabel = bundle.ui.servingsLabel ?? "Servings";
  const u = (key: string, fallback: string) => bundle.ui[key] ?? fallback;
  const macroLinesLocalized = (() => {
    const m = recipe.macros;
    if (!m) return [] as string[];
    const s = m.perSlice;
    const h = m.per100;
    const e = m.energyPct;
    const net = u("unitNetCarb", "net carbs");
    const fat = u("unitFat", "fat");
    const prot = u("unitProtein", "protein");
    const fib = u("unitFiber", "fiber");
    const carb = u("unitCarb", "carbs");
    return [
      `- ${u("macrosPerSlice", "Per serving")}: ${s.net.toFixed(1)} g ${net} · ${s.fat.toFixed(1)} g ${fat} · ${s.prot.toFixed(1)} g ${prot} · ${s.fib.toFixed(1)} g ${fib} · ${s.cal} kcal`,
      `- ${u("macrosPer100", "Per 100 g")}: ${h.net.toFixed(1)} g ${net} · ${h.fat.toFixed(1)} g ${fat} · ${h.prot.toFixed(1)} g ${prot} · ${h.cal} kcal`,
      `- ${u("energySplit", "Energy split")}: ${e.fat} % ${fat} · ${e.prot} % ${prot} · ${e.carb} % ${carb}`,
    ];
  })();

  const buildText = (mode: "weight" | "kitchen") => {
    const ingredients = recipe.groups.map((group) => [
      `### ${group.category}`,
      ...group.lines.map((line) => `- ${mode === "weight" ? line.weightLabel : line.kitchenLabel} ${line.name}`),
    ].join("\n")).join("\n\n");

    return [
      `# ${recipe.title}`,
      "",
      recipe.lead,
      "",
      `- ${temperatureLabel}: ${recipe.temp} °C`,
      `- ${timeLabel}: ${recipe.minutesFrom}–${recipe.minutesTo} min`,
      `- ${formLabel}: ${recipe.form}`,
      `- ${servingsLabel}: ${recipe.servings}`,
      ...macroLinesLocalized,
      "",
      `## ${categoryTitle}`,
      "",
      ingredients,
      "",
      `## ${methodTitle}`,
      "",
      ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
      "",
    ].join("\n");
  };

  return {
    ...recipe,
    textWeight: buildText("weight"),
    textKitchen: buildText("kitchen"),
    text: recipe.defaultUnitMode === "weight" ? buildText("weight") : buildText("kitchen"),
  };
}

export function localizeCatalog(locale?: string | null, catalog?: CatalogPayload): CatalogPayload {
  const source = catalog ?? { categories: [], ingredients: [], nuts: [], fibers: [], knowledge: { title: "", body: "", points: [] } };
  const bundle = getTranslations(locale);
  return {
    categories: source.categories.map((category) => bundle.categories[category] ?? localizeText(locale, category)),
    ingredients: source.ingredients.map((ingredient) => ({
      ...ingredient,
      cat: (bundle.categories[ingredient.cat] ?? ingredient.cat) as Ingredient["cat"],
      name: bundle.ingredients[ingredient.id] ?? localizeText(locale, ingredient.name),
      impact: localizeText(locale, ingredient.impact),
    })),
    nuts: source.nuts.map((nut) => ({ ...nut, name: bundle.nuts[nut.id] ?? localizeText(locale, nut.name) })),
    fibers: source.fibers.map((fiber) => ({ ...fiber, name: bundle.fibers[fiber.id] ?? localizeText(locale, fiber.name) })),
    knowledge: {
      title: bundle.knowledge.title,
      body: bundle.knowledge.body,
      points: bundle.knowledge.points,
    },
  };
}

export function localizeAnalysis(locale?: string | null, analysis?: Analysis): Analysis {
  if (!analysis) return analysis as unknown as Analysis;
  const code = normalizeLocale(locale);
  const bundle = getTranslations(code);
  if (code === "da") return analysis;

  const localizedRecipe = analysis.recipe
    ? localizeRecipeText(code, {
      ...analysis.recipe,
      title: localizeText(code, analysis.recipe.title),
      lead: localizeText(code, analysis.recipe.lead),
      badge: localizeText(code, analysis.recipe.badge),
      form: localizeText(code, analysis.recipe.form),
      groups: analysis.recipe.groups.map((group) => ({
        category: bundle.categories[group.category] ?? localizeText(code, group.category),
        lines: group.lines.map((line) => ({
          ...line,
          name: bundle.ingredients[line.id] ?? localizeText(code, line.name),
          weightLabel: localizeText(code, line.weightLabel),
          kitchenLabel: localizeText(code, line.kitchenLabel),
        })),
      })),
      steps: analysis.recipe.steps.map((step) => localizeText(code, step)),
      metaPills: analysis.recipe.metaPills.map((pill) => ({ ...pill, label: localizeText(code, pill.label) })),
    })
    : null;

  return {
    ...analysis,
    ketoLabel: localizeText(code, analysis.ketoLabel),
    verdict: localizeText(code, analysis.verdict),
    notes: analysis.notes.map((note) => localizeText(code, note)),
    suggestions: analysis.suggestions.map((suggestion) => ({
      title: localizeText(code, suggestion.title),
      detail: localizeText(code, suggestion.detail),
    })),
    impacts: analysis.impacts.map((impact) => ({
      ...impact,
      name: bundle.ingredients[impact.id] ?? localizeText(code, impact.name),
      impact: localizeText(code, impact.impact),
      roles: impact.roles.map((role) => localizeText(code, role)),
    })),
    properties: analysis.properties.map((property) => ({
      ...property,
      name: localizeText(code, property.name),
    })),
    recipe: localizedRecipe,
  };
}

export function localizeMetadata(locale?: string | null, metadata?: RecipeMetadata): RecipeMetadata {
  if (!metadata) return metadata as unknown as RecipeMetadata;
  const code = normalizeLocale(locale);
  return {
    ...metadata,
    summary: localizeText(code, metadata.summary),
    tags: metadata.tags.map((tag) => localizeText(code, tag)),
    style: localizeText(code, metadata.style),
    difficulty: localizeText(code, metadata.difficulty),
    occasion: localizeText(code, metadata.occasion),
  };
}