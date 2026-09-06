// Flytter opskrifter fra data/recipes.json (fil-lager) til Deno KV.
// Lokalt:      deno task migrate-kv            → data/kageatelier.kv
// Deno Deploy: kør mod den hostede KV med DENO_KV_ACCESS_TOKEN og KAGEATELIER_KV_PATH=<remote url>
//              (se https://docs.deno.com/deploy/kv/manual/on_deploy/#connect-to-managed-databases-from-outside-of-deno-deploy)
import { closeStore, importSavedRecipe } from "../lib/recipe_store.ts";
import type { SavedRecipe } from "../lib/types.ts";

const source = Deno.env.get("KAGEATELIER_RECIPES_FILE") ?? new URL("../data/recipes.json", import.meta.url).pathname;
Deno.env.set("KAGEATELIER_STORE", "kv");

const raw = await Deno.readTextFile(source);
const recipes = (JSON.parse(raw).recipes ?? []) as SavedRecipe[];
for (const recipe of recipes) {
  await importSavedRecipe(recipe);
  console.log(`→ ${recipe.title} (${recipe.id})`);
}
await closeStore();
console.log(`${recipes.length} opskrifter flyttet til KV.`);
