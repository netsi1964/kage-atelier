// Billeder til opskrifter ligger i repoet: public/images/recipes/<slug>.<jpg|jpeg|png|webp>
// Koblingen sker via filnavnet. Ingen database-ændring er nødvendig: findes filen, bruges den.
import { extname, join } from "jsr:@std/path";
import type { SavedRecipe, SavedRecipeSummary } from "./types.ts";

export const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
export const IMAGE_URL_PREFIX = "/images/recipes";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function imageDir(): string {
  return Deno.env.get("KAGEATELIER_IMAGE_DIR") ?? join(import.meta.dirname ?? Deno.cwd(), "..", "public", "images", "recipes");
}

export function onDeploy(): boolean {
  return Boolean(Deno.env.get("DENO_DEPLOYMENT_ID") || Deno.env.get("DENO_REGION"));
}

/** Kan serveren skrive billedfiler? Nej på Deno Deploy (read-only), ja lokalt. */
export function imagesWritable(): boolean {
  return !onDeploy();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "kage";
}

/** Stabilt filnavn: <titel-slug>-<første 8 tegn af id>. Gemmes på opskriften ved oprettelse. */
export function recipeSlug(recipe: Pick<SavedRecipe, "id" | "title" | "slug">): string {
  return recipe.slug || `${slugify(recipe.title)}-${recipe.id.slice(0, 8)}`;
}

export function expectedImagePath(recipe: Pick<SavedRecipe, "id" | "title" | "slug">): string {
  return `public/images/recipes/${recipeSlug(recipe)}.jpg`;
}

async function exists(path: string): Promise<boolean> {
  try {
    const info = await Deno.stat(path);
    return info.isFile;
  } catch {
    return false;
  }
}

/** Finder en billedfil i repoet for opskriften: <slug>.<ext> eller <id>.<ext>. */
export async function findRecipeImage(recipe: Pick<SavedRecipe, "id" | "title" | "slug">): Promise<{ url: string; file: string } | null> {
  const dir = imageDir();
  const bases = [recipeSlug(recipe), recipe.id];
  for (const base of bases) {
    for (const ext of IMAGE_EXTS) {
      const file = `${base}.${ext}`;
      if (await exists(join(dir, file))) return { url: `${IMAGE_URL_PREFIX}/${file}`, file };
    }
  }
  return null;
}

/** Returnerer opskriften med slug, forventet sti og cover-billede fra repoet, hvis det findes. */
export async function attachRepoImage<T extends SavedRecipe>(recipe: T): Promise<T> {
  const slug = recipeSlug(recipe);
  const found = await findRecipeImage(recipe);
  const images = recipe.images.length ? recipe.images.map((image) => ({ ...image })) : [{
    id: crypto.randomUUID(),
    kind: "cover" as const,
    status: "planned" as const,
    alt: `${recipe.title} på fad`,
    prompt: recipe.metadata?.imagePrompt ?? "",
  }];
  const cover = images.find((image) => image.kind === "cover") ?? images[0];
  if (found) {
    cover.url = found.url;
    cover.status = "ready";
  }
  return { ...recipe, slug, imagePath: expectedImagePath({ ...recipe, slug }), images };
}

export function summaryImageFields(recipe: SavedRecipe): Pick<SavedRecipeSummary, "slug" | "imagePath"> {
  const slug = recipeSlug(recipe);
  return { slug, imagePath: expectedImagePath({ ...recipe, slug }) };
}

/** Gemmer uploadet billede som <slug>.<ext> og fjerner andre varianter. Kun lokalt. */
export async function saveRecipeImage(
  recipe: Pick<SavedRecipe, "id" | "title" | "slug">,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ url: string; file: string; path: string }> {
  if (!imagesWritable()) {
    throw new Error("Billeder kan ikke uploades på Deno Deploy. Læg filen i public/images/recipes/ i repoet og push.");
  }
  const ext = MIME_TO_EXT[contentType.split(";")[0].trim().toLowerCase()];
  if (!ext) throw new Error("Understøttede formater: JPEG, PNG og WebP.");
  if (!bytes.length) throw new Error("Tom fil.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Billedet må højst være 8 MB.");
  const dir = imageDir();
  await Deno.mkdir(dir, { recursive: true });
  const slug = recipeSlug(recipe);
  for (const other of IMAGE_EXTS) {
    if (other === ext) continue;
    try { await Deno.remove(join(dir, `${slug}.${other}`)); } catch { /* fandtes ikke */ }
  }
  const file = `${slug}.${ext}`;
  const path = join(dir, file);
  await Deno.writeFile(path, bytes);
  return { url: `${IMAGE_URL_PREFIX}/${file}`, file, path: `public/images/recipes/${file}` };
}

export function isImageFileName(name: string): boolean {
  return IMAGE_EXTS.includes(extname(name).slice(1).toLowerCase() as typeof IMAGE_EXTS[number]);
}
