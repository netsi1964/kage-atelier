import { assert, assertEquals } from "jsr:@std/assert";
import { closeStore, getSavedRecipe, listSavedRecipes, saveRecipe } from "./recipe_store.ts";

Deno.test("gemte opskrifter kan gemmes og hentes igen", async () => {
  const tempDir = await Deno.makeTempDir();
  Deno.env.set("KAGEATELIER_RECIPES_FILE", `${tempDir}/recipes.json`);

  try {
    const saved = await saveRecipe({
      cakeName: "Testkage",
      servings: 2,
      items: [
        { id: "almond", grams: 120 },
        { id: "egg", grams: 150 },
        { id: "butter", grams: 80 },
        { id: "allulose", grams: 60 },
        { id: "vanilla", grams: 5 },
        { id: "salt", grams: 2 },
      ],
      imageUrl: "https://example.com/kage.jpg",
      imageAlt: "Testkage på fad",
    });

    const all = await listSavedRecipes();
    const one = await getSavedRecipe(saved.id);

    assertEquals(all.length, 1);
    assertEquals(all[0].id, saved.id);
    assertEquals(all[0].servings, 2);
    assert(one);
    assertEquals(one?.images[0]?.url, "https://example.com/kage.jpg");
    assert(one?.metadata.summary.length);
    assert(!one?.metadata.tags.includes("chokolade"));
  } finally {
    Deno.env.delete("KAGEATELIER_RECIPES_FILE");
  }
});
Deno.test("kv-lager: gem, list og hent via Deno KV", async () => {
  Deno.env.set("KAGEATELIER_STORE", "kv");
  Deno.env.set("KAGEATELIER_KV_PATH", ":memory:");
  try {
    const saved = await saveRecipe({
      cakeName: "KV-kage",
      servings: 8,
      items: [
        { id: "almond", grams: 160 },
        { id: "egg", grams: 200 },
        { id: "butter", grams: 90 },
        { id: "allulose", grams: 70 },
        { id: "cocoa", grams: 30 },
        { id: "salt", grams: 2 },
      ],
    });
    const all = await listSavedRecipes();
    const one = await getSavedRecipe(saved.id);
    assertEquals(all.length, 1);
    assertEquals(all[0].id, saved.id);
    assert(one);
    assertEquals(one?.title, "KV-kage");
    assert(one?.recipe.macros.perSlice.fat > 0);
    assertEquals(await getSavedRecipe("findes-ikke"), null);
  } finally {
    await closeStore();
    Deno.env.delete("KAGEATELIER_STORE");
    Deno.env.delete("KAGEATELIER_KV_PATH");
  }
});
