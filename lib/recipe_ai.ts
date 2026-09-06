import type { Analysis, RecipeMetadata, WrittenRecipe } from "./types.ts";

interface MetadataInput {
  title: string;
  recipe: WrittenRecipe;
  analysis: Analysis;
}

function jsonHeaders() {
  return { "content-type": "application/json" };
}

function tagSet(input: MetadataInput): string[] {
  const ingredientText = input.recipe.groups
    .flatMap((group) => group.lines.map((line) => `${line.name} ${line.id}`))
    .join(" ")
    .toLowerCase();
  const text = `${input.title} ${input.analysis.verdict} ${ingredientText}`.toLowerCase();
  const tags = new Set<string>();
  if (text.includes("keto")) tags.add("keto");
  if (text.includes("chokolade") || text.includes("kakao")) tags.add("chokolade");
  if (text.includes("citron")) tags.add("citron");
  if (text.includes("vanilje")) tags.add("vanilje");
  if (text.includes("gulerod")) tags.add("gulerod");
  if (text.includes("nød") || text.includes("mandel") || text.includes("hasselnød")) tags.add("nøddemel");
  if (input.analysis.keto >= 60) tags.add("lav-carb");
  if (input.analysis.success >= 75) tags.add("sikker favorit");
  return Array.from(tags).slice(0, 6);
}

function heuristicMetadata(input: MetadataInput): RecipeMetadata {
  const tags = tagSet(input);
  const style = input.analysis.keto >= 60 ? "Keto" : "Klassisk";
  const difficulty = input.recipe.steps.length > 9 ? "Middel" : "Nem";
  const occasion = input.analysis.keto >= 60 ? "Hverdag og gæster" : "Weekend og fødselsdag";
  const summary = `${input.title} er en ${input.analysis.keto >= 60 ? "lav-carb" : "klassisk"} kage til ${input.recipe.servings} personer med ${input.analysis.verdict.toLowerCase()}`;
  const imagePrompt = `Editorial food photo of ${input.title.toLowerCase()}, Scandinavian home baking style, sliced cake on ceramic plate, soft natural light, visible crumb, ${tags.join(", ")}`;
  return {
    summary,
    tags,
    style,
    difficulty,
    occasion,
    imagePrompt,
    provider: "heuristic",
  };
}

function normalizeMetadata(data: Partial<RecipeMetadata> | null | undefined, fallback: RecipeMetadata): RecipeMetadata {
  return {
    summary: data?.summary?.trim() || fallback.summary,
    tags: Array.isArray(data?.tags) ? data!.tags!.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 6) : fallback.tags,
    style: data?.style?.trim() || fallback.style,
    difficulty: data?.difficulty?.trim() || fallback.difficulty,
    occasion: data?.occasion?.trim() || fallback.occasion,
    imagePrompt: data?.imagePrompt?.trim() || fallback.imagePrompt,
    provider: data?.provider?.trim() || fallback.provider,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function tryOllama(input: MetadataInput, fallback: RecipeMetadata): Promise<RecipeMetadata | null> {
  const endpoint = Deno.env.get("OLLAMA_ENDPOINT") ?? "http://127.0.0.1:11434/api/generate";
  const model = Deno.env.get("OLLAMA_MODEL") ?? "llama3.2:3b";
  const prompt = [
    "Svar kun med gyldig JSON.",
    "Lav metadata til en dansk kageopskrift.",
    "Felter: summary, tags, style, difficulty, occasion, imagePrompt, provider.",
    `Titel: ${input.title}`,
    `Opskrift: ${input.recipe.textWeight}`,
    `Analyse: ${input.analysis.verdict}`,
  ].join("\n");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
      signal: AbortSignal.timeout(2200),
    });
    if (!res.ok) return null;
    const body = await res.json();
    const raw = typeof body.response === "string" ? body.response : "";
    const parsed = extractJson(raw);
    if (!parsed) return null;
    return normalizeMetadata(parsed as Partial<RecipeMetadata>, { ...fallback, provider: `ollama:${model}` });
  } catch {
    return null;
  }
}

async function tryApple(input: MetadataInput, fallback: RecipeMetadata): Promise<RecipeMetadata | null> {
  const endpoint = Deno.env.get("APPLE_AI_ENDPOINT");
  if (!endpoint) return null;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        task: "recipe-metadata",
        title: input.title,
        recipe: input.recipe.textWeight,
        verdict: input.analysis.verdict,
      }),
      signal: AbortSignal.timeout(2200),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeMetadata(data as Partial<RecipeMetadata>, { ...fallback, provider: "apple-endpoint" });
  } catch {
    return null;
  }
}

export async function generateRecipeMetadata(input: MetadataInput): Promise<RecipeMetadata> {
  const fallback = heuristicMetadata(input);
  const provider = (Deno.env.get("RECIPE_AI_PROVIDER") ?? "auto").toLowerCase();

  if (provider === "ollama") return await tryOllama(input, fallback) ?? fallback;
  if (provider === "apple") return await tryApple(input, fallback) ?? fallback;
  if (provider === "heuristic") return fallback;

  return await tryOllama(input, fallback)
    ?? await tryApple(input, fallback)
    ?? fallback;
}
