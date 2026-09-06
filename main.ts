import { join, extname } from "jsr:@std/path";
import { contentType } from "jsr:@std/media-types";
import {
  analyzeCake,
  analyzePreset,
  blendFlour,
  deleteSavedRecipe,
  getSavedRecipe,
  getCatalog,
  imagesWritable,
  listSavedRecipes,
  normalizeLocale,
  resolveStoreKind,
  saveRecipe,
  saveRecipeImage,
  type AnalyzeInput,
  type BlendInput,
  type Ingredient,
  type Locale,
  type SaveRecipeInput,
} from "./lib/mod.ts";

const PORT = Number(Deno.env.get("PORT") ?? "8787");
const ROOT = join(import.meta.dirname ?? Deno.cwd(), "public");
const MAX_PORT_ATTEMPTS = 20;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

async function readBody<T>(req: Request): Promise<T> {
  return await req.json() as T;
}

async function serveStatic(pathname: string): Promise<Response> {
  const clean = pathname === "/" ? "/index.html" : pathname;
  const filePath = join(ROOT, clean.replace(/^\/+/, ""));
  if (!filePath.startsWith(ROOT)) return error("Ugyldig sti", 400);
  try {
    const file = await Deno.readFile(filePath);
    const type = contentType(extname(filePath)) ?? "application/octet-stream";
    return new Response(file, { headers: { "content-type": type } });
  } catch {
    if (clean !== "/index.html") {
      try {
        const file = await Deno.readFile(join(ROOT, "index.html"));
        return new Response(file, { headers: { "content-type": "text/html; charset=utf-8" } });
      } catch {
        return error("Ikke fundet", 404);
      }
    }
    return error("Ikke fundet", 404);
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const locale = normalizeLocale(url.searchParams.get("lang"));

  if (req.method === "GET" && path === "/api/health") {
    return json({ ok: true, service: "kageatelier", runtime: "deno", store: resolveStoreKind(), imageUpload: imagesWritable() });
  }
  if (req.method === "GET" && path === "/api/catalog") {
    return json(getCatalog(locale));
  }
  if (req.method === "POST" && path === "/api/analyze") {
    const body = await readBody<AnalyzeInput>(req);
    return json(analyzeCake({ ...body, locale: body.locale ?? locale }));
  }
  if (req.method === "POST" && path === "/api/blend") {
    try {
      const body = await readBody<BlendInput>(req);
      const blended = blendFlour(body);
      // Client typically merges; return ingredient so UI can append.
      return json({ ...blended, analysisHint: "Send ingredient med som extras ved næste analyze." });
    } catch (err) {
      return error(err instanceof Error ? err.message : "Blending fejlede");
    }
  }
  if (req.method === "POST" && path === "/api/random-keto") {
    const body = await readBody<{ extras?: Ingredient[]; servings?: number; adjustToRealistic?: boolean; locale?: Locale }>(req)
      .catch(() => ({ extras: [], servings: undefined, adjustToRealistic: true, locale }));
    return json(analyzePreset("random-keto", body.extras ?? [], {
      servings: body.servings,
      adjustToRealistic: body.adjustToRealistic,
      locale: body.locale ?? locale,
    }));
  }
  if (req.method === "POST" && path === "/api/classic") {
    const body = await readBody<{ extras?: Ingredient[]; servings?: number; adjustToRealistic?: boolean; locale?: Locale }>(req)
      .catch(() => ({ extras: [], servings: undefined, adjustToRealistic: true, locale }));
    return json(analyzePreset("classic", body.extras ?? [], {
      servings: body.servings,
      adjustToRealistic: body.adjustToRealistic,
      locale: body.locale ?? locale,
    }));
  }
  if (req.method === "GET" && path === "/api/recipes") {
    return json(await listSavedRecipes({
      query: url.searchParams.get("query") ?? undefined,
      style: url.searchParams.get("style") ?? undefined,
      tag: url.searchParams.get("tag") ?? undefined,
      locale,
    }));
  }
  if (req.method === "POST" && path === "/api/recipes") {
    try {
      const body = await readBody<SaveRecipeInput>(req);
      return json(await saveRecipe({ ...body, locale: body.locale ?? locale }), 201);
    } catch (err) {
      return error(err instanceof Error ? err.message : "Kunne ikke gemme opskriften.");
    }
  }
  if (req.method === "POST" && /^\/api\/recipes\/[^/]+\/image$/.test(path)) {
    const id = path.split("/")[3];
    const recipe = await getSavedRecipe(id);
    if (!recipe) return error("Opskrift ikke fundet.", 404);
    if (!imagesWritable()) {
      return error(`Upload er slået fra på Deno Deploy. Læg filen som ${recipe.imagePath} i repoet og push.`, 405);
    }
    try {
      const bytes = new Uint8Array(await req.arrayBuffer());
      const saved = await saveRecipeImage(recipe, bytes, req.headers.get("content-type") ?? "");
      return json({ ok: true, ...saved, hint: `git add ${saved.path} && git commit -m "Billede: ${recipe.title}" && git push` }, 201);
    } catch (err) {
      return error(err instanceof Error ? err.message : "Upload fejlede");
    }
  }
  if (req.method === "DELETE" && /^\/api\/recipes\/[^/]+$/.test(path)) {
    const id = path.split("/")[3];
    const removed = await deleteSavedRecipe(id);
    if (!removed) return error("Opskrift ikke fundet.", 404);
    return json({ ok: true, id });
  }
  if (req.method === "GET" && path.startsWith("/api/recipes/")) {
    const id = path.replace("/api/recipes/", "").trim();
    if (!id) return error("Opskrift mangler id.", 400);
    const recipe = await getSavedRecipe(id);
    if (!recipe) return error("Opskrift ikke fundet.", 404);
    return json(recipe);
  }

  if (req.method === "GET") return await serveStatic(path);
  return error("Metode ikke understøttet", 405);
}

function serveLocalWithFallback(startPort: number) {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    try {
      const server = Deno.serve({ port, hostname: "0.0.0.0" }, handler);
      console.log(`Kageatelier kører på http://127.0.0.1:${port}`);
      return server;
    } catch (err) {
      if (err instanceof Deno.errors.AddrInUse) continue;
      throw err;
    }
  }

  throw new Error(
    `Kunne ikke finde en ledig port i intervallet ${startPort}-${startPort + MAX_PORT_ATTEMPTS - 1}.`,
  );
}

if (import.meta.main) {
  const onDeploy = Boolean(Deno.env.get("DENO_DEPLOYMENT_ID") || Deno.env.get("DENO_REGION"));
  if (onDeploy) {
    console.log("Kageatelier kører på Deno Deploy");
    Deno.serve(handler);
  } else {
    serveLocalWithFallback(PORT);
  }
}
