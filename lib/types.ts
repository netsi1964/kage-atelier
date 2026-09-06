export type Category =
  | "Mel & blender"
  | "Sødt"
  | "Fedt"
  | "Æg & mejeri"
  | "Hævning"
  | "Smag"
  | "Bindemiddel"
  | "Frugt & pynt";

export type Locale = "da" | "en" | "es" | "ch";

export interface Ingredient {
  id: string;
  name: string;
  cat: Category;
  net: number;
  fat: number;
  prot: number;
  fib: number;
  cal: number;
  abs: number;
  structure: number;
  moisture: number;
  crumb: number;
  sweet: number;
  rich: number;
  rise: number;
  flavor: number;
  keto: number;
  impact: string;
}

export interface RecipeItem {
  id: string;
  grams: number;
}

export interface BlendInput {
  nut1: string;
  nut1g: number;
  nut2?: string;
  nut2g?: number;
  fiber?: string;
  fiberg?: number;
  name?: string;
}

export interface AnalyzeInput {
  items: RecipeItem[];
  cakeName?: string;
  extras?: Ingredient[];
  servings?: number;
  adjustToRealistic?: boolean;
  locale?: Locale;
}

export interface Suggestion {
  title: string;
  detail: string;
}

export interface ImpactLine {
  id: string;
  name: string;
  grams: number;
  share: number;
  impact: string;
  roles: string[];
}

export type RecipeUnitMode = "weight" | "kitchen";

export interface RecipeLine {
  id: string;
  name: string;
  grams: number;
  weightLabel: string;
  kitchenLabel: string;
}

export interface RecipeGroup {
  category: string;
  lines: RecipeLine[];
}

export interface WrittenRecipe {
  title: string;
  lead: string;
  badge: string;
  form: string;
  temp: string;
  minutesFrom: number;
  minutesTo: number;
  servings: number;
  totalGrams: number;
  groups: RecipeGroup[];
  steps: string[];
  text: string;
  textWeight: string;
  textKitchen: string;
  defaultUnitMode: RecipeUnitMode;
  metaPills: { label: string; tone: "good" | "mid" | "bad" }[];
  macros: Macros;
}

export interface MacroSet {
  net: number;
  fat: number;
  prot: number;
  fib: number;
  cal: number;
}

export interface Macros {
  total: MacroSet;
  perSlice: MacroSet;
  per100: MacroSet;
  energyPct: { fat: number; prot: number; carb: number };
}

export interface PropertyBar {
  name: string;
  value: number;
  color: string;
}

export interface Analysis {
  empty: boolean;
  success: number;
  taste: number;
  keto: number;
  ketoLabel: string;
  netPer100: number;
  netPerSlice: number;
  fatTotal: number;
  protTotal: number;
  totalGrams: number;
  servings: number;
  macros: Macros;
  properties: PropertyBar[];
  verdict: string;
  notes: string[];
  suggestions: Suggestion[];
  impacts: ImpactLine[];
  recipe: WrittenRecipe | null;
  profileName?: string;
}

export interface CatalogPayload {
  categories: string[];
  ingredients: Ingredient[];
  nuts: { id: string; name: string; mapsTo: string }[];
  fibers: { id: string; name: string; mapsTo: string | null }[];
  knowledge: { title: string; body: string; points: string[] };
}

export interface SavedRecipeAnalysis {
  success: number;
  taste: number;
  keto: number;
  ketoLabel: string;
  netPer100: number;
  netPerSlice: number;
  totalGrams: number;
  verdict: string;
}

export interface RecipeMetadata {
  summary: string;
  tags: string[];
  style: string;
  difficulty: string;
  occasion: string;
  imagePrompt: string;
  provider: string;
}

export interface RecipeImageAsset {
  id: string;
  kind: "cover" | "step";
  status: "planned" | "ready";
  url?: string;
  alt: string;
  prompt: string;
}

export interface SavedRecipe {
  id: string;
  title: string;
  cakeName: string;
  createdAt: string;
  updatedAt: string;
  servings: number;
  items: RecipeItem[];
  extras: Ingredient[];
  recipe: WrittenRecipe;
  analysis: SavedRecipeAnalysis;
  metadata: RecipeMetadata;
  images: RecipeImageAsset[];
  /** Filnavn-basis for billede i repoet: public/images/recipes/<slug>.jpg */
  slug?: string;
  /** Beregnet ved læsning: forventet sti til billedfilen */
  imagePath?: string;
}

export interface SavedRecipeSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  servings: number;
  ketoLabel: string;
  summary: string;
  style: string;
  difficulty: string;
  tags: string[];
  image?: RecipeImageAsset;
  provider: string;
  slug: string;
  imagePath: string;
}

export interface SaveRecipeInput {
  items: RecipeItem[];
  extras?: Ingredient[];
  cakeName?: string;
  servings?: number;
  imageUrl?: string;
  imageAlt?: string;
  locale?: Locale;
}
