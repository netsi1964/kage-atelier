import type {
  Analysis,
  AnalyzeInput,
  BlendInput,
  ImpactLine,
  Ingredient,
  Macros,
  MacroSet,
  RecipeItem,
  Suggestion,
  WrittenRecipe,
} from "./types.ts";
import {
  CLASSIC_CHOCOLATE,
  INGREDIENTS,
  KETO_PROFILES,
  resolveLibrary,
} from "./ingredients.ts";
import { localizeAnalysis, normalizeLocale } from "./i18n.ts";

const DEFAULT_SERVINGS = 8;

const WET_IDS = new Set([
  "egg",
  "eggWhite",
  "eggYolk",
  "milk",
  "almondMilk",
  "buttermilk",
  "heavyCream",
  "sourCream",
  "oil",
  "butter",
  "cocoaButter",
  "lemon",
  "banana",
  "carrot",
  "berries",
  "lime",
  "avocado",
  "zucchini",
  "pumpkinPuree",
  "rhubarb",
  "raspberries",
  "strawberries",
  "blueberries",
  "vinegar",
  "fiberSyrup",
]);

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function adjustToRealistic(value: number, step = 0.25): number {
  return Math.round(value / step) * step;
}

function normalizeServings(value?: number): number {
  return clamp(Math.round(value || DEFAULT_SERVINGS), 1, 32);
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1").replace(".", ",");
}

function formatWeight(grams: number): string {
  if (grams >= 1000) return `${formatNumber(grams / 1000)} kg`;
  return `${Math.round(grams)} g`;
}

interface MeasureOption {
  unit: string;
  gramsPerUnit: number;
  step: number;
  minQty?: number;
  maxQty?: number;
  singular?: string;
  plural?: string;
}

function pickMeasure(grams: number, options: MeasureOption[]): string | null {
  for (const option of options) {
    const qty = adjustToRealistic(grams / option.gramsPerUnit, option.step);
    if (qty <= 0) continue;
    if (qty < (option.minQty ?? 0)) continue;
    if (qty > (option.maxQty ?? Number.POSITIVE_INFINITY)) continue;
    const label = option.singular
      ? (Math.abs(qty - 1) < 0.001 ? option.singular : option.plural ?? option.singular)
      : option.unit;
    return `${formatNumber(qty)} ${label}`;
  }
  return null;
}

const dryMeasures = (gramsPerDl: number): MeasureOption[] => [
  { unit: "dl", gramsPerUnit: gramsPerDl, step: 0.25, minQty: 0.5, maxQty: 6 },
  { unit: "spsk", gramsPerUnit: gramsPerDl / 10, step: 0.5, minQty: 1, maxQty: 12 },
  { unit: "tsk", gramsPerUnit: gramsPerDl / 30, step: 0.5, minQty: 1, maxQty: 12 },
];

const liquidMeasures = (gramsPerDl = 100): MeasureOption[] => [
  { unit: "dl", gramsPerUnit: gramsPerDl, step: 0.25, minQty: 0.5, maxQty: 8 },
  { unit: "spsk", gramsPerUnit: gramsPerDl / 6.67, step: 0.5, minQty: 1, maxQty: 12 },
  { unit: "tsk", gramsPerUnit: gramsPerDl / 20, step: 0.5, minQty: 1, maxQty: 12 },
];

function kitchenLabel(id: string, grams: number): string {
  switch (id) {
    case "egg":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 50, step: 0.5, minQty: 1, maxQty: 12, singular: "æg", plural: "æg" }]) ?? formatWeight(grams);
    case "eggWhite":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 30, step: 0.5, minQty: 1, maxQty: 12, singular: "æggehvide", plural: "æggehvider" }]) ?? formatWeight(grams);
    case "eggYolk":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 18, step: 0.5, minQty: 1, maxQty: 12, singular: "blomme", plural: "blommer" }]) ?? formatWeight(grams);
    case "wheat":
      return pickMeasure(grams, dryMeasures(60)) ?? formatWeight(grams);
    case "cakeFlour":
      return pickMeasure(grams, dryMeasures(55)) ?? formatWeight(grams);
    case "almond":
      return pickMeasure(grams, dryMeasures(45)) ?? formatWeight(grams);
    case "coconutFlour":
      return pickMeasure(grams, dryMeasures(35)) ?? formatWeight(grams);
    case "hazelnut":
    case "walnut":
      return pickMeasure(grams, dryMeasures(50)) ?? formatWeight(grams);
    case "pecan":
      return pickMeasure(grams, dryMeasures(45)) ?? formatWeight(grams);
    case "sunflower":
    case "flax":
      return pickMeasure(grams, dryMeasures(55)) ?? formatWeight(grams);
    case "sugar":
      return pickMeasure(grams, dryMeasures(85)) ?? formatWeight(grams);
    case "brownSugar":
      return pickMeasure(grams, dryMeasures(70)) ?? formatWeight(grams);
    case "erythritol":
      return pickMeasure(grams, dryMeasures(75)) ?? formatWeight(grams);
    case "allulose":
      return pickMeasure(grams, dryMeasures(80)) ?? formatWeight(grams);
    case "monk":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 12, step: 0.5, minQty: 0.5, maxQty: 8 },
        { unit: "tsk", gramsPerUnit: 4, step: 0.5, minQty: 1, maxQty: 12 },
      ]) ?? formatWeight(grams);
    case "butter":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 14, step: 0.5, minQty: 1, maxQty: 10 },
        { unit: "dl", gramsPerUnit: 90, step: 0.25, minQty: 0.5, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "oil":
    case "cocoaButter":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 13.5, step: 0.5, minQty: 1, maxQty: 12 },
        { unit: "dl", gramsPerUnit: 92, step: 0.25, minQty: 0.5, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "creamCheese":
      return pickMeasure(grams, [
        { unit: "dl", gramsPerUnit: 95, step: 0.25, minQty: 0.5, maxQty: 4 },
        { unit: "spsk", gramsPerUnit: 15, step: 0.5, minQty: 1, maxQty: 12 },
      ]) ?? formatWeight(grams);
    case "heavyCream":
    case "sourCream":
    case "milk":
    case "almondMilk":
    case "buttermilk":
    case "espresso":
      return pickMeasure(grams, liquidMeasures()) ?? formatWeight(grams);
    case "bp":
    case "soda":
      return pickMeasure(grams, [
        { unit: "tsk", gramsPerUnit: 4, step: 0.5, minQty: 0.5, maxQty: 6 },
        { unit: "spsk", gramsPerUnit: 12, step: 0.5, minQty: 1, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "tartar":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 3, step: 0.5, minQty: 0.5, maxQty: 6 }]) ?? formatWeight(grams);
    case "vanilla":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 5, step: 0.5, minQty: 0.5, maxQty: 6 }]) ?? formatWeight(grams);
    case "cocoa":
      return pickMeasure(grams, [
        { unit: "dl", gramsPerUnit: 35, step: 0.25, minQty: 0.5, maxQty: 3 },
        { unit: "spsk", gramsPerUnit: 5, step: 0.5, minQty: 1, maxQty: 12 },
      ]) ?? formatWeight(grams);
    case "cinnamon":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 2.6, step: 0.5, minQty: 0.5, maxQty: 8 }]) ?? formatWeight(grams);
    case "lemon":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 25, step: 0.5, minQty: 0.5, maxQty: 4, singular: "citron", plural: "citroner" }]) ?? formatWeight(grams);
    case "salt":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 6, step: 0.25, minQty: 0.25, maxQty: 4 }]) ?? formatWeight(grams);
    case "xanthan":
    case "psyllium":
      return pickMeasure(grams, [
        { unit: "tsk", gramsPerUnit: 3, step: 0.5, minQty: 0.5, maxQty: 6 },
        { unit: "spsk", gramsPerUnit: 9, step: 0.5, minQty: 1, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "carrot":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 60, step: 0.5, minQty: 0.5, maxQty: 8, singular: "gulerod", plural: "gulerødder" }]) ?? formatWeight(grams);
    case "banana":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 120, step: 0.5, minQty: 0.5, maxQty: 6, singular: "banan", plural: "bananer" }]) ?? formatWeight(grams);
    case "berries":
      return pickMeasure(grams, dryMeasures(60)) ?? formatWeight(grams);
    case "pecans":
    case "walnutsTop":
      return pickMeasure(grams, dryMeasures(50)) ?? formatWeight(grams);
    case "almondLowFat":
    case "sesameFlour":
    case "lupin":
      return pickMeasure(grams, dryMeasures(50)) ?? formatWeight(grams);
    case "chiaMeal":
      return pickMeasure(grams, dryMeasures(55)) ?? formatWeight(grams);
    case "oatFiber":
      return pickMeasure(grams, dryMeasures(30)) ?? formatWeight(grams);
    case "inulin":
      return pickMeasure(grams, dryMeasures(60)) ?? formatWeight(grams);
    case "wheyProtein":
    case "eggWhiteProtein":
      return pickMeasure(grams, dryMeasures(45)) ?? formatWeight(grams);
    case "xylitol":
      return pickMeasure(grams, dryMeasures(85)) ?? formatWeight(grams);
    case "sweetBlend":
      return pickMeasure(grams, dryMeasures(75)) ?? formatWeight(grams);
    case "powderedSweet":
      return pickMeasure(grams, dryMeasures(55)) ?? formatWeight(grams);
    case "brownSweet":
      return pickMeasure(grams, dryMeasures(70)) ?? formatWeight(grams);
    case "tagatose":
      return pickMeasure(grams, dryMeasures(80)) ?? formatWeight(grams);
    case "fiberSyrup":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 20, step: 0.5, minQty: 1, maxQty: 12 },
        { unit: "dl", gramsPerUnit: 140, step: 0.25, minQty: 0.5, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "ghee":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 14, step: 0.5, minQty: 1, maxQty: 10 },
        { unit: "dl", gramsPerUnit: 90, step: 0.25, minQty: 0.5, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "mctOil":
    case "avocadoOil":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 13.5, step: 0.5, minQty: 1, maxQty: 12 },
        { unit: "dl", gramsPerUnit: 92, step: 0.25, minQty: 0.5, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "almondButter":
    case "peanutButter":
    case "tahini":
      return pickMeasure(grams, [
        { unit: "dl", gramsPerUnit: 95, step: 0.25, minQty: 0.5, maxQty: 4 },
        { unit: "spsk", gramsPerUnit: 16, step: 0.5, minQty: 1, maxQty: 12 },
      ]) ?? formatWeight(grams);
    case "mascarpone":
    case "ricotta":
      return pickMeasure(grams, [
        { unit: "dl", gramsPerUnit: 95, step: 0.25, minQty: 0.5, maxQty: 5 },
        { unit: "spsk", gramsPerUnit: 15, step: 0.5, minQty: 1, maxQty: 12 },
      ]) ?? formatWeight(grams);
    case "coconutCream":
    case "coconutMilk":
    case "greekYogurt":
    case "skyr":
    case "pumpkinPuree":
      return pickMeasure(grams, liquidMeasures()) ?? formatWeight(grams);
    case "gelatin":
      return pickMeasure(grams, [
        { unit: "tsk", gramsPerUnit: 3, step: 0.5, minQty: 0.5, maxQty: 6 },
        { unit: "spsk", gramsPerUnit: 9, step: 0.5, minQty: 1, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "cardamom":
    case "ginger":
    case "nutmeg":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 2, step: 0.25, minQty: 0.25, maxQty: 8 }]) ?? formatWeight(grams);
    case "orangeZest":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 6, step: 0.5, minQty: 1, maxQty: 6 },
        { unit: "tsk", gramsPerUnit: 2, step: 0.5, minQty: 0.5, maxQty: 6 },
      ]) ?? formatWeight(grams);
    case "lime":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 30, step: 0.5, minQty: 0.5, maxQty: 6, singular: "lime", plural: "limes" }]) ?? formatWeight(grams);
    case "almondExtract":
      return pickMeasure(grams, [{ unit: "tsk", gramsPerUnit: 5, step: 0.25, minQty: 0.25, maxQty: 4 }]) ?? formatWeight(grams);
    case "vinegar":
      return pickMeasure(grams, [
        { unit: "tsk", gramsPerUnit: 5, step: 0.5, minQty: 0.5, maxQty: 6 },
        { unit: "spsk", gramsPerUnit: 15, step: 0.5, minQty: 1, maxQty: 4 },
      ]) ?? formatWeight(grams);
    case "sugarFreeChips":
    case "raspberries":
    case "strawberries":
    case "blueberries":
    case "rhubarb":
      return pickMeasure(grams, dryMeasures(60)) ?? formatWeight(grams);
    case "zucchini":
      return pickMeasure(grams, dryMeasures(70)) ?? formatWeight(grams);
    case "avocado":
      return pickMeasure(grams, [{ unit: "stk", gramsPerUnit: 150, step: 0.5, minQty: 0.5, maxQty: 4, singular: "avokado", plural: "avokadoer" }]) ?? formatWeight(grams);
    case "coconutShred":
      return pickMeasure(grams, dryMeasures(35)) ?? formatWeight(grams);
    case "macadamia":
    case "pumpkinSeeds":
    case "sunflowerSeeds":
    case "sesameSeeds":
    case "almondFlakes":
    case "cocoaNibs":
      return pickMeasure(grams, dryMeasures(50)) ?? formatWeight(grams);
    case "freezeDriedRaspberry":
      return pickMeasure(grams, [
        { unit: "spsk", gramsPerUnit: 5, step: 0.5, minQty: 1, maxQty: 8 },
        { unit: "tsk", gramsPerUnit: 1.7, step: 0.5, minQty: 0.5, maxQty: 6 },
      ]) ?? formatWeight(grams);
    default:
      return formatWeight(grams);
  }
}

function formatRecipeLine(id: string, name: string, grams: number) {
  return {
    id,
    name,
    grams: Math.round(grams),
    weightLabel: formatWeight(grams),
    kitchenLabel: kitchenLabel(id, grams),
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function emptyMacroSet(): MacroSet {
  return { net: 0, fat: 0, prot: 0, fib: 0, cal: 0 };
}

export function computeMacros(rows: Array<Ingredient & { grams: number }>, total: number, servings: number): Macros {
  const sum = (key: "net" | "fat" | "prot" | "fib" | "cal") => rows.reduce((acc, row) => acc + row.grams * (Number(row[key]) || 0) / 100, 0);
  const tot: MacroSet = { net: sum("net"), fat: sum("fat"), prot: sum("prot"), fib: sum("fib"), cal: sum("cal") };
  const scale = (factor: number): MacroSet => ({ net: r1(tot.net * factor), fat: r1(tot.fat * factor), prot: r1(tot.prot * factor), fib: r1(tot.fib * factor), cal: Math.round(tot.cal * factor) });
  const kcalFat = tot.fat * 9;
  const kcalProt = tot.prot * 4;
  const kcalCarb = tot.net * 4;
  const kcalSum = kcalFat + kcalProt + kcalCarb;
  const pct = (part: number) => kcalSum > 0 ? Math.round(part / kcalSum * 100) : 0;
  const fatPct = pct(kcalFat);
  const protPct = pct(kcalProt);
  return {
    total: scale(1),
    perSlice: scale(1 / Math.max(1, servings)),
    per100: scale(100 / Math.max(1, total)),
    energyPct: { fat: fatPct, prot: protPct, carb: Math.max(0, 100 - fatPct - protPct) },
  };
}

export function macroLines(macros: Macros): string[] {
  const s = macros.perSlice;
  const h = macros.per100;
  const e = macros.energyPct;
  return [
    `- Pr. stykke: ${s.net.toFixed(1)} g net-carb · ${s.fat.toFixed(1)} g fedt · ${s.prot.toFixed(1)} g protein · ${s.fib.toFixed(1)} g fiber · ${s.cal} kcal`,
    `- Pr. 100 g: ${h.net.toFixed(1)} g net-carb · ${h.fat.toFixed(1)} g fedt · ${h.prot.toFixed(1)} g protein · ${h.cal} kcal`,
    `- Energifordeling: ${e.fat} % fedt · ${e.prot} % protein · ${e.carb} % kulhydrat`,
  ];
}

function emptyAnalysis(): Analysis {
  return {
    empty: true,
    success: 0,
    taste: 0,
    keto: 0,
    ketoLabel: "",
    netPer100: 0,
    netPerSlice: 0,
    fatTotal: 0,
    protTotal: 0,
    totalGrams: 0,
    servings: DEFAULT_SERVINGS,
    macros: { total: emptyMacroSet(), perSlice: emptyMacroSet(), per100: emptyMacroSet(), energyPct: { fat: 0, prot: 0, carb: 0 } },
    properties: [],
    verdict: "Tilføj ingredienser for at få en vurdering.",
    notes: [],
    suggestions: [],
    impacts: [],
    recipe: null,
  };
}

export function analyzeCake(input: AnalyzeInput): Analysis {
  const locale = normalizeLocale(input.locale);
  const lib = resolveLibrary(input.extras ?? []);
  const servings = normalizeServings(input.servings);
  const scaleFactor = servings / DEFAULT_SERVINGS;
  const rows = (input.items ?? [])
    .map((row) => {
      const ing = lib.get(row.id);
      if (!ing || !(row.grams > 0)) return null;
      return { ...ing, grams: row.grams * scaleFactor };
    })
    .filter((row): row is Ingredient & { grams: number } => row !== null);

  if (!rows.length) return emptyAnalysis();

  const total = rows.reduce((sum, row) => sum + row.grams, 0) || 1;
  const weighted = (key: keyof Ingredient) =>
    rows.reduce((sum, row) => sum + row.grams * (Number(row[key]) || 0), 0) / total;

  const netTotal = rows.reduce((sum, row) => sum + row.grams * row.net / 100, 0);
  const fatTotal = rows.reduce((sum, row) => sum + row.grams * row.fat / 100, 0);
  const protTotal = rows.reduce((sum, row) => sum + row.grams * row.prot / 100, 0);
  const netPer100 = netTotal / total * 100;
  const netPerSlice = netTotal / servings;
  const macros = computeMacros(rows, total, servings);

  const absLoad = rows.reduce((sum, row) => sum + row.grams * row.abs, 0);
  const wetG = rows.filter((row) => WET_IDS.has(row.id) || row.cat === "Fedt" || row.cat === "Æg & mejeri")
    .reduce((sum, row) => sum + row.grams, 0);
  const dryG = total - wetG;
  const hydration = wetG / Math.max(30, dryG);
  const neededHydration = clamp(absLoad / Math.max(80, dryG) * 0.35, 0.35, 2.2);
  const hydRatio = hydration / neededHydration;

  const eggsG = rows.filter((row) => ["egg", "eggWhite", "eggYolk"].includes(row.id)).reduce((sum, row) => sum + row.grams, 0);
  const flourG = rows.filter((row) => row.cat === "Mel & blender").reduce((sum, row) => sum + row.grams, 0);
  const sweetG = rows.filter((row) => row.cat === "Sødt").reduce((sum, row) => sum + row.grams, 0);
  const fatG = rows.filter((row) => row.cat === "Fedt" || ["eggYolk", "creamCheese", "heavyCream", "mascarpone", "coconutCream", "avocado"].includes(row.id))
    .reduce((sum, row) => sum + row.grams, 0);
  const binderG = rows.filter((row) => row.cat === "Bindemiddel").reduce((sum, row) => sum + row.grams, 0);
  const flavorG = rows.filter((row) => ["vanilla", "cocoa", "chocolate", "cinnamon", "lemon", "espresso", "salt", "cardamom", "ginger", "nutmeg", "orangeZest", "lime", "almondExtract", "cocoaMass", "sugarFreeChips"].includes(row.id))
    .reduce((sum, row) => sum + row.grams, 0);
  const wheatG = rows.filter((row) => ["wheat", "cakeFlour", "sugar", "brownSugar", "banana", "milk", "buttermilk"].includes(row.id))
    .reduce((sum, row) => sum + row.grams, 0);
  const cocoG = rows.filter((row) => row.id === "coconutFlour").reduce((sum, row) => sum + row.grams, 0);
  const leavenG = rows.filter((row) => row.cat === "Hævning").reduce((sum, row) => sum + row.grams, 0);

  const moisture = clamp(50 + weighted("moisture") * 18 + (hydRatio - 1) * 25 + (fatG / total) * 20 - (cocoG / total) * 35, 4, 96);
  const dryness = 100 - moisture;
  const crumbliness = clamp(
    40 + weighted("crumb") * 22 - binderG * 8 - eggsG / total * 40 + (flourG && eggsG / flourG < 0.35 ? 18 : 0),
    4,
    96,
  );
  const density = clamp(55 - weighted("rise") * 12 - eggsG / total * 25 + fatG / total * 20 + (cocoG ? 8 : 0) - leavenG * 3, 8, 94);
  const sweetness = clamp(weighted("sweet") * 38 + sweetG / total * 90, 2, 98);
  const rise = clamp(20 + weighted("rise") * 22 + leavenG * 6 + eggsG / total * 40 - density * 0.15, 4, 96);
  const richness = clamp(15 + weighted("rich") * 22 + fatG / total * 55, 4, 98);
  const structure = clamp(20 + weighted("structure") * 20 + eggsG / total * 35 + binderG * 10 + (wheatG ? 15 : 0) - crumbliness * 0.15, 5, 96);
  const flavor = clamp(10 + weighted("flavor") * 28 + (flavorG > 0 ? 18 : 0) + Math.min(22, sweetness * 0.2) + Math.min(15, richness * 0.15), 5, 98);

  let success = 40;
  if (flourG + eggsG > 40) success += 10;
  if (sweetG > 8 || rows.some((row) => row.cat === "Sødt")) success += 8;
  if (fatG > 15) success += 8;
  if (flavorG > 0) success += 8;
  if (hydRatio > 0.7 && hydRatio < 1.45) success += 14;
  else success -= Math.min(22, Math.abs(hydRatio - 1) * 20);
  if (structure > 45) success += 8;
  if (cocoG > 20 && eggsG < cocoG * 1.6) success -= 18;
  if (binderG > 12) success -= 8;
  if (leavenG > 18) success -= 6;
  if (rows.length < 3) success -= 10;
  if (sweetness < 12 && !rows.some((row) => row.id === "cocoa" || row.id === "chocolate" || row.id === "lemon")) success -= 6;
  success = clamp(Math.round(success + (flavor - 50) * 0.12 + (moisture - 50) * 0.08), 8, 97);

  const taste = clamp(Math.round(flavor * 0.45 + richness * 0.2 + (100 - Math.abs(sweetness - 62)) * 0.15 + (100 - dryness) * 0.12 + (100 - crumbliness) * 0.08), 8, 98);

  let keto = clamp(Math.round(100 - netPer100 * 3.2 - (wheatG / total) * 70), 1, 99);
  keto = Math.round(keto * (0.35 + 0.65 * weighted("keto")));
  if (netPerSlice > 15) keto = Math.min(keto, 35);
  if (netPerSlice < 4 && wheatG === 0) keto = Math.max(keto, 78);

  const ketoLabel = keto >= 80 ? "Meget keto-venlig" : keto >= 60 ? "Acceptabel keto" : keto >= 40 ? "Lav-carb-ish" : "Ikke keto";

  const notes: string[] = [];
  if (hydRatio < 0.7) notes.push("Dejen ser undervandetet ud — forvent tør og smuldrende kage.");
  if (hydRatio > 1.5) notes.push("Meget våd balance — risiko for klæg midte og dårlig hævning.");
  if (cocoG && eggsG < cocoG * 1.5) notes.push("Kokosmel uden nok æg/væske giver savsmuld. Tommelfinger: mange æg pr. 30–60 g kokosmel.");
  if (flourG && eggsG / Math.max(flourG, 1) < 0.3 && binderG < 1) notes.push("Lav æg-til-mel-ratio. Nøddemel smuldrer uden extra æg eller xanthan eller psyllium.");
  if (sweetness < 20) notes.push("Lav sødme. De fleste velsmagende kager ligger midt-højt på sødme eller kompenserer med chokolade eller syre.");
  if (sweetness > 85) notes.push("Meget sød — kan dække nuancer og gøre krummen klæg.");
  if (wheatG > 30) notes.push("Hvedemel, sukker eller banan trækker keto-scoren kraftigt ned.");
  if (rows.some((row) => row.id === "erythritol") && !rows.some((row) => row.id === "allulose")) {
    notes.push("Erythritol alene kan give kølig eftersmag og tørrere bid. Allulose eller ekstra fedt hjælper.");
  }
  if (leavenG === 0 && eggsG < 80) notes.push("Ingen hævemiddel og få æg: forvent tæt kage, lidt i retning af kladdkaka.");
  if (flavorG === 0) notes.push("Mangler smagsgiver. Vanilje, salt, kakao eller citron løfter næsten alt.");
  if (!notes.length) notes.push("Balancen ser fornuftig ud. Små justeringer i fedt, æg og smag kan stadig finpudse krummen.");

  const verdict =
    `${dryness > 70 ? "tør " : moisture > 70 ? "saftig " : "moderat fugtig "}` +
    `${crumbliness > 68 ? "og smuldrende " : structure > 65 ? "med holdbar krumme " : ""}` +
    `${density > 68 ? "tæt " : rise > 65 ? "luftig " : ""}kage med ${sweetness > 60 ? "tydelig" : "afdæmpet"} sødme og ${richness > 60 ? "høj" : "let"} rigdom. ${notes.join(" ")}`;

  const have = new Set(rows.map((row) => row.id));
  const suggestions: Suggestion[] = [];
  if (!have.has("salt")) suggestions.push({ title: "Salt", detail: "Skærper sødmen og får kagen til at smage færdig. Start med 1–2 g." });
  if (!have.has("vanilla") && !have.has("cocoa") && !have.has("lemon")) {
    suggestions.push({ title: "Vanilje eller kakao", detail: "Uden en klar smagsakse scorer kagen lavt på velsmag." });
  }
  if (crumbliness > 62 && binderG < 1 && !have.has("xanthan")) {
    suggestions.push({ title: "Xanthangummi (1–2 g)", detail: "Sænker smuldring markant i kager med nøddemel." });
  }
  if (cocoG && hydRatio < 1) {
    suggestions.push({ title: "Ekstra æg eller mandelmælk", detail: "Kokosmel drikker væske. Ét ekstra æg pr. 20–25 g kokosmel er et godt udgangspunkt." });
  }
  if (have.has("cocoa") && !have.has("espresso") && !have.has("butter")) {
    suggestions.push({ title: "Kaffe eller mere fedt", detail: "Kakao tørrer og bliver flad uden fedt eller lidt kaffe som forstærker." });
  }
  if (keto > 70 && sweetness < 35 && !have.has("erythritol") && !have.has("allulose") && !have.has("monk")) {
    suggestions.push({ title: "Sødemiddel til bagning", detail: "Prøv allulose-sødning eller munkefrugt-blend for sødme uden at løfte net-carb." });
  }
  if (have.has("almond") && !have.has("coconutFlour") && structure < 50) {
    suggestions.push({ title: "Lidt kokosmel", detail: "10–20 % af melmængden som kokosmel giver mere bid og suger overskydende fedt." });
  }
  if (have.has("creamCheese") && !have.has("lemon")) {
    suggestions.push({ title: "Citron", detail: "Syre klæder flødeost og løfter en ellers tung kage." });
  }
  if (success > 60 && keto < 45) {
    suggestions.push({ title: "Skift sukker og mel", detail: "Prøv bagesødning som allulose og byt hvedemel til mandelmel plus lidt kokosmel." });
  }
  if (!suggestions.length) {
    suggestions.push({ title: "Ristede pekannødder eller bær", detail: "Tekstur og aroma uden at ændre strukturen voldsomt." });
  }

  const impacts: ImpactLine[] = rows.map((row) => {
    const roles: string[] = [];
    if (row.structure > 0.5) roles.push("bygger struktur");
    if (row.structure < 0) roles.push("mørner eller forkorter struktur");
    if (row.moisture > 0.4) roles.push("øger fugt");
    if (row.moisture < -0.4) roles.push("tørrer dejen");
    if (row.crumb > 0.4) roles.push("øger smuldring");
    if (row.crumb < -0.4) roles.push("binder krummen");
    if (row.sweet > 0.8) roles.push("søder");
    if (row.rise > 0.8) roles.push("giver hævning");
    if (row.flavor > 0.8) roles.push("driver smagen");
    if (row.keto < 0.3) roles.push("sænker keto-score");
    return { id: row.id, name: row.name, grams: row.grams, share: row.grams / total, impact: row.impact, roles };
  });

  const recipe = writeRecipe({
    rows,
    total,
    servings,
    netPerSlice,
    macros,
    hydRatio,
    flourG,
    cocoG,
    binderG,
    wheatG,
    moisture,
    crumbliness,
    density,
    success,
    taste,
    keto,
    cakeName: input.cakeName ?? "",
    adjustToRealistic: input.adjustToRealistic ?? true,
  });

  const analysis = {
    empty: false,
    success,
    taste,
    keto,
    ketoLabel,
    netPer100,
    netPerSlice,
    fatTotal,
    protTotal,
    totalGrams: total,
    servings,
    macros,
    properties: [
      { name: "Tørhed", value: dryness, color: dryness > 65 ? "var(--bad)" : "var(--gold)" },
      { name: "Smuldring", value: crumbliness, color: crumbliness > 65 ? "var(--bad)" : "var(--gold)" },
      { name: "Fugtighed", value: moisture, color: "var(--keto)" },
      { name: "Densitet", value: density, color: "var(--cocoa)" },
      { name: "Sødme", value: sweetness, color: "var(--gold2)" },
      { name: "Hævning", value: rise, color: "var(--good)" },
      { name: "Rigdom", value: richness, color: "#c9846a" },
      { name: "Struktur", value: structure, color: "#8fb7e8" },
    ],
    verdict,
    notes,
    suggestions,
    impacts,
    recipe,
  };

  return localizeAnalysis(locale, analysis);
}

function inferTitle(rows: Array<Ingredient & { grams: number }>, cakeName: string): string {
  if (cakeName) return cakeName;
  const ids = new Set(rows.map((row) => row.id));
  const ketoish = !ids.has("wheat") && !ids.has("cakeFlour") && !ids.has("sugar") && !ids.has("brownSugar") && !ids.has("banana");
  const prefix = ketoish ? "Keto " : "";
  if (ids.has("cocoa") || ids.has("chocolate")) {
    const flourG = rows.filter((row) => row.cat === "Mel & blender").reduce((sum, row) => sum + row.grams, 0);
    if (flourG < 50) return prefix + "kladdkaka";
    return prefix + "chokoladekage";
  }
  if (ids.has("creamCheese") && ids.has("lemon")) return prefix + "citron-cheesecakekage";
  if (ids.has("creamCheese")) return prefix + "flødeostekage";
  if (ids.has("carrot")) return prefix + "gulerodskage";
  if (ids.has("cinnamon") && (ids.has("pecan") || ids.has("pecans"))) return prefix + "kanel-pekankage";
  if (ids.has("hazelnut")) return prefix + "hasselnøddekage";
  if (ids.has("orangeZest") && ids.has("cardamom")) return prefix + "kardemomme-appelsinkage";
  if (ids.has("rhubarb")) return prefix + "rabarberkage";
  if (ids.has("zucchini")) return prefix + "squashkage";
  if (ids.has("pumpkinPuree")) return prefix + "græskarkage";
  if (ids.has("raspberries")) return prefix + "hindbærkage";
  if (ids.has("lime") && ids.has("coconutShred")) return prefix + "lime-kokoskage";
  if (ids.has("coconutShred")) return prefix + "kokoskage";
  if (ids.has("peanutButter")) return prefix + "peanutbutter-kage";
  if (ids.has("lemon")) return prefix + "citronekage";
  if (ids.has("vanilla")) return prefix + "vaniljekage";
  return prefix + "hjemmebagt kage";
}

function buildRecipeText(recipe: {
  title: string;
  lead: string;
  temp: string;
  minutesFrom: number;
  minutesTo: number;
  form: string;
  servings: number;
  netPerSlice: number;
  macros: Macros;
  groups: WrittenRecipe["groups"];
  steps: string[];
}, mode: "weight" | "kitchen"): string {
  const ingredients = recipe.groups.map((group) => [
    `### ${group.category}`,
    ...group.lines.map((line) => `- ${mode === "weight" ? line.weightLabel : line.kitchenLabel} ${line.name}`),
  ].join("\n")).join("\n\n");

  return [
    `# ${recipe.title}`,
    "",
    recipe.lead,
    "",
    `- Ovntemperatur: ${recipe.temp} °C`,
    `- Tid: ${recipe.minutesFrom}–${recipe.minutesTo} min`,
    `- Form: ${recipe.form}`,
    `- Portioner: ${recipe.servings}`,
    ...macroLines(recipe.macros),
    "",
    "## Ingredienser",
    "",
    ingredients,
    "",
    "## Fremgangsmåde",
    "",
    ...recipe.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
  ].join("\n");
}

function writeRecipe(ctx: {
  rows: Array<Ingredient & { grams: number }>;
  total: number;
  servings: number;
  netPerSlice: number;
  macros: Macros;
  hydRatio: number;
  flourG: number;
  cocoG: number;
  binderG: number;
  wheatG: number;
  moisture: number;
  crumbliness: number;
  density: number;
  success: number;
  taste: number;
  keto: number;
  cakeName: string;
  adjustToRealistic: boolean;
}): WrittenRecipe {
  const { rows, total, servings, netPerSlice, macros, hydRatio, flourG, cocoG, binderG, wheatG, moisture, crumbliness, density, success, taste, keto, cakeName, adjustToRealistic } = ctx;
  const ids = new Set(rows.map((row) => row.id));
  const rawTitle = inferTitle(rows, cakeName);
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
  const ketoish = keto >= 60 && wheatG === 0;
  const form = total < 450
    ? "en lille form (15–18 cm) eller 6–8 muffins"
    : total < 900
    ? "en springform på 20–22 cm"
    : "en 24 cm form eller to 18 cm lagkageforme";
  const temp = ids.has("chocolate") && flourG < 60 ? "170" : ketoish ? "175" : "175–180";
  let minutes = 28;
  if (total > 900) minutes = 40;
  else if (total > 650) minutes = 34;
  if (cocoG > 20) minutes += 4;
  if (ids.has("chocolate") && flourG < 60) minutes = Math.max(18, minutes - 8);
  if (density > 70) minutes += 4;

  const groupsMap = new Map<string, Array<Ingredient & { grams: number }>>();
  for (const row of rows) {
    const list = groupsMap.get(row.cat) ?? [];
    list.push(row);
    groupsMap.set(row.cat, list);
  }
  const order = ["Mel & blender", "Sødt", "Fedt", "Æg & mejeri", "Hævning", "Smag", "Bindemiddel", "Frugt & pynt"];
  const groups = order.filter((group) => groupsMap.has(group)).map((group) => ({
    category: group,
    lines: (groupsMap.get(group) ?? []).sort((a, b) => b.grams - a.grams).map((row) => formatRecipeLine(row.id, row.name, row.grams)),
  }));

  const steps: string[] = [];
  steps.push(`Varm ovnen til ${temp} °C. Smør ${form} og beklæd bunden med bagepapir.`);
  if (ids.has("eggWhite") && !ids.has("egg")) {
    steps.push("Pisk æggehvider med en knivspids salt og eventuelt vinsten til stive tinder. Sødemidlet vendes i lidt ad gangen.");
  } else if (ids.has("butter") || ids.has("cocoaButter") || ids.has("ghee")) {
    const sweeteners = rows.filter((row) => row.cat === "Sødt").map((row) => row.name.toLowerCase());
    steps.push(`Pisk ${ids.has("butter") ? "blødt smør" : "fedtstof"}${sweeteners.length ? " med " + sweeteners.join(" og ") : ""} lyst og luftigt i 2–3 minutter. Har du flødeost i opskriften, piskes den med her.`);
    if (ids.has("egg") || ids.has("eggYolk")) {
      steps.push("Tilsæt æg, og eventuelt blommer, ét ad gangen og pisk godt mellem hvert, så dejen emulgerer. Vanilje og eventuel kaffe røres i.");
    }
  } else {
    steps.push("Pisk æg og sødemiddel sammen, indtil blandingen er lysere og lidt tyk. Tilsæt vanilje og øvrige flydende smagsstoffer.");
  }
  if (ids.has("chocolate")) {
    steps.push("Smelt den mørke chokolade over vandbad eller i korte intervaller i mikroovn. Lad den køle et par minutter og rør den i den fede masse.");
  }
  const dry = rows.filter((row) => ["Mel & blender", "Hævning", "Bindemiddel"].includes(row.cat) || ["cocoa", "cinnamon", "salt", "cardamom", "ginger", "nutmeg"].includes(row.id));
  if (dry.length) {
    steps.push("I en anden skål blandes alle tørre ingredienser: mel, kakao, hævemiddel, salt, krydderi og bindemiddel. Pisk eller sigt det godt sammen, så der ikke kommer klumper.");
    steps.push("Vend de tørre ingredienser i den våde masse med en dejskraber. Stop, når der næsten ingen tørre pletter er tilbage, så kagen ikke bliver sej eller tæt.");
  }
  if (["almondMilk", "milk", "buttermilk", "heavyCream", "sourCream", "oil", "coconutCream", "coconutMilk", "greekYogurt", "skyr", "ricotta", "mascarpone", "fiberSyrup", "vinegar", "avocadoOil", "mctOil"].some((id) => ids.has(id))) {
    steps.push("Tilsæt væske, olie eller creme til sidst og justér konsistensen. Dejen skal være smørbar, ikke løbende som pandekagedej. Kokosmel tykner efter 2–3 minutter, så vent lidt før du tilsætter mere væske.");
  }
  if (["zucchini", "rhubarb", "strawberries", "raspberries", "blueberries"].some((id) => ids.has(id))) {
    steps.push("Forbered vådt fyld: pres revet squash i et viskestykke, macerér rabarber med lidt sødemiddel i 30 minutter og hæld saften fra, og vend bær i en spiseskefuld kokosmel.");
  }
  if (["carrot", "banana", "berries", "pecans", "walnutsTop", "pecan", "raspberries", "strawberries", "blueberries", "rhubarb", "zucchini", "pumpkinPuree", "avocado", "coconutShred", "macadamia", "pumpkinSeeds", "sunflowerSeeds", "sesameSeeds", "almondFlakes", "cocoaNibs", "sugarFreeChips"].some((id) => ids.has(id))) {
    steps.push("Vend frugt og eller hakkede nødder i til sidst, så de ikke bliver mast eller synker unødigt til bunds.");
  }
  if (cocoG > 15) steps.push("Lad dejen hvile 3–5 minutter, så kokosmelet kan suge væske. Fordel den derefter i formen og glat toppen.");
  else steps.push("Fordel dejen i formen og glat toppen let. Bank formen én gang i bordet for at slå store luftlommer ud.");

  if (ids.has("chocolate") && flourG < 60) {
    steps.push(`Bag ${minutes}–${minutes + 6} minutter. Midten må gerne være lidt blød, hvis du går efter kladdkaka-stilen. En tandstikker må gerne have lidt fugtigt smuld på sig.`);
  } else {
    steps.push(`Bag ${minutes}–${minutes + 8} minutter, til toppen er sat og en tandstikker kommer ud med få fugtige krummer. Kager med nødde-mel bliver hurtigt tørre, hvis de overbages.`);
  }
  steps.push("Køl 10 minutter i formen, løsn kanten og læg kagen på rist. Skær først, når den er næsten kold, ellers smuldrer den lettere.");

  if (ids.has("creamCheese")) {
    steps.push("Forslag til topping: pisk flødeost med lidt sødemiddel og citronsaft til en tyk frosting og smør den på den kolde kage.");
  } else if (ids.has("cocoa") || ids.has("chocolate")) {
    steps.push("Forslag til topping: lav en ganache af piskefløde og mørk chokolade, eller læg et tyndt lag smørcreme på. Klassisk variant er en enkel chokoladeglasur.");
  } else if (ids.has("lemon") || ids.has("lime")) {
    steps.push("Forslag til topping: rør citronglasur af sødemiddel og citronsaft, eller servér med flødeskum og citronskal.");
  } else {
    steps.push("Servér med flødeskum, bær eller en skefuld creme fraiche. Et drys pulveriseret sødemiddel på toppen giver et fint bager-look.");
  }

  if (hydRatio < 0.75) steps.push("Bemærk: vurderingen peger på en tør dej. Overvej ét ekstra æg eller 20–40 g mere væske, før du bager.");
  if (hydRatio > 1.5) steps.push("Bemærk: dejen ser meget våd ud. Bag et par minutter længere, eller rør 10–15 g ekstra mandel- eller kokosmel i.");
  if (crumbliness > 68 && binderG < 1) steps.push("Bemærk: høj smuldring. 1 tsk xanthangummi eller 1 spsk psyllium gør kagen mere skærbar.");

  const lead = `${ketoish ? "En lav-carb" : "En"} ${moisture > 65 ? "saftig" : moisture < 40 ? "fast" : "blød"} ${density > 65 ? "og tæt " : "og forholdsvis luftig "}kage til ca. ${servings} stykker. Forventet succes ${success}/100, smag ${taste}/100, keto ${keto}/100.`;
  const textWeight = buildRecipeText({ title, lead, temp, minutesFrom: minutes, minutesTo: minutes + 8, form, servings, netPerSlice, macros, groups, steps }, "weight");
  const textKitchen = buildRecipeText({ title, lead, temp, minutesFrom: minutes, minutesTo: minutes + 8, form, servings, netPerSlice, macros, groups, steps }, "kitchen");

  return {
    title,
    lead,
    badge: ketoish ? "Keto-opskrift" : "Opskrift",
    form,
    temp,
    minutesFrom: minutes,
    minutesTo: minutes + 8,
    servings,
    totalGrams: Math.round(total),
    groups,
    steps,
    text: adjustToRealistic ? textKitchen : textWeight,
    textWeight,
    textKitchen,
    defaultUnitMode: adjustToRealistic ? "kitchen" : "weight",
    macros,
    metaPills: [
      { label: form.replace(/^en /, ""), tone: "mid" },
      { label: `${temp} °C · ${minutes}–${minutes + 8} min`, tone: "mid" },
      { label: `${servings} stykker`, tone: "mid" },
      { label: `${netPerSlice.toFixed(1)} g net-carb/stykke`, tone: keto >= 80 ? "good" : keto >= 50 ? "mid" : "bad" },
      { label: `${macros.perSlice.fat.toFixed(1)} g fedt/stykke`, tone: "mid" },
      { label: `${macros.perSlice.prot.toFixed(1)} g protein/stykke`, tone: "mid" },
      { label: `${macros.perSlice.cal} kcal/stykke`, tone: "mid" },
      { label: `${macros.energyPct.fat}/${macros.energyPct.prot}/${macros.energyPct.carb} % fedt/protein/kulhydrat`, tone: macros.energyPct.fat >= 65 ? "good" : "mid" },
      { label: `${Math.round(total)} g dej`, tone: "mid" },
    ],
  };
}

let blendSeq = 0;

export function blendFlour(input: BlendInput): { ingredient: Ingredient; grams: number } {
  const find = (id?: string) => INGREDIENTS.find((item) => item.id === id);
  const a = find(input.nut1);
  if (!a) throw new Error("Ukendt nød til blending.");
  const b = input.nut2 ? find(input.nut2) : undefined;
  const f = input.fiber ? find(input.fiber) : undefined;
  const ag = Number(input.nut1g) || 0;
  const bg = Number(input.nut2g) || 0;
  const fg = Number(input.fiberg) || 0;
  const sum = ag + bg + fg;
  if (sum < 10) throw new Error("Brug mindst 10 g i alt.");
  const mix = (key: keyof Ingredient) =>
    (ag * Number(a[key] || 0) + (b ? bg * Number(b[key] || 0) : 0) + (f ? fg * Number(f[key] || 0) : 0)) / sum;
  blendSeq++;
  const ingredient: Ingredient = {
    id: `custom${blendSeq}-${Date.now()}`,
    name: (input.name ?? "").trim() || `Hjemmelavet mel #${blendSeq}`,
    cat: "Mel & blender",
    net: mix("net"),
    fat: mix("fat"),
    prot: mix("prot"),
    fib: mix("fib"),
    cal: mix("cal"),
    abs: mix("abs"),
    structure: mix("structure"),
    moisture: mix("moisture"),
    crumb: mix("crumb"),
    sweet: mix("sweet"),
    rich: mix("rich"),
    rise: mix("rise"),
    flavor: mix("flavor"),
    keto: mix("keto"),
    impact: `Blendet mel af ${a.name}${b ? " + " + b.name : ""}${f ? " + " + f.name : ""}. Egenskaberne er vægtet gennemsnit. Nøddemel har ikke gluten, så behold æg og eventuelt bindemiddel i opskriften.`,
  };
  return { ingredient, grams: Math.round(sum) };
}

export function randomKetoItems(): { name: string; items: RecipeItem[] } {
  const profile = KETO_PROFILES[Math.floor(Math.random() * KETO_PROFILES.length)];
  return {
    name: profile.name,
    items: profile.items.map(([id, grams]) => ({
      id,
      grams: Math.max(1, Math.round(grams * (0.88 + Math.random() * 0.24))),
    })),
  };
}

export function classicChocolateItems(): { name: string; items: RecipeItem[] } {
  return {
    name: "Klassisk chokoladekage",
    items: CLASSIC_CHOCOLATE.map(([id, grams]) => ({ id, grams })),
  };
}

export function analyzePreset(
  kind: "random-keto" | "classic",
  extras: Ingredient[] = [],
  options: Pick<AnalyzeInput, "servings" | "adjustToRealistic" | "locale"> = {},
): Analysis & { items: RecipeItem[]; cakeName: string } {
  const preset = kind === "classic" ? classicChocolateItems() : randomKetoItems();
  const analysis = analyzeCake({
    items: preset.items,
    cakeName: preset.name,
    extras,
    servings: options.servings,
    adjustToRealistic: options.adjustToRealistic,
    locale: options.locale,
  });
  return { ...analysis, items: preset.items, cakeName: localizeAnalysis(options.locale, { ...analysis, recipe: null }).profileName ?? preset.name, profileName: preset.name };
}