import { assert, assertEquals } from "jsr:@std/assert";
import { closeStore, deleteSavedRecipe, getSavedRecipe, listSavedRecipes, saveRecipe } from "./recipe_store.ts";
import { saveRecipeImage, slugify } from "./images.ts";

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
    assertEquals(await deleteSavedRecipe(saved.id), true);
    assertEquals(await deleteSavedRecipe(saved.id), false);
    assertEquals((await listSavedRecipes()).length, 0);
  } finally {
    await closeStore();
    Deno.env.delete("KAGEATELIER_STORE");
    Deno.env.delete("KAGEATELIER_KV_PATH");
  }
});

Deno.test("billeder: slug, forventet sti og automatisk kobling fra repo-mappen", async () => {
  const tempDir = await Deno.makeTempDir();
  const imgDir = await Deno.makeTempDir();
  Deno.env.set("KAGEATELIER_RECIPES_FILE", `${tempDir}/recipes.json`);
  Deno.env.set("KAGEATELIER_IMAGE_DIR", imgDir);
  try {
    assertEquals(slugify("Chokolade-avokado fudge på fad!"), "chokolade-avokado-fudge-paa-fad");
    const saved = await saveRecipe({
      cakeName: "Rabarber & mandel",
      servings: 8,
      items: [{ id: "almond", grams: 180 }, { id: "egg", grams: 200 }, { id: "butter", grams: 90 }, { id: "allulose", grams: 80 }, { id: "rhubarb", grams: 140 }],
    });
    assert(saved.slug?.startsWith("rabarber-mandel-"));
    assertEquals(saved.imagePath, `public/images/recipes/${saved.slug}.jpg`);
    assertEquals(saved.images[0].status, "planned");

    await Deno.writeFile(`${imgDir}/${saved.slug}.png`, new Uint8Array([137, 80, 78, 71]));
    const again = await getSavedRecipe(saved.id);
    assertEquals(again?.images[0].status, "ready");
    assertEquals(again?.images[0].url, `/images/recipes/${saved.slug}.png`);
    const list = await listSavedRecipes();
    assertEquals(list[0].image?.url, `/images/recipes/${saved.slug}.png`);
    assertEquals(list[0].slug, saved.slug);

    const up = await saveRecipeImage(saved, new Uint8Array([255, 216, 255]), "image/jpeg");
    assertEquals(up.file, `${saved.slug}.jpg`);
    const files = [...Deno.readDirSync(imgDir)].map((f) => f.name);
    assertEquals(files, [`${saved.slug}.jpg`]);
  } finally {
    Deno.env.delete("KAGEATELIER_RECIPES_FILE");
    Deno.env.delete("KAGEATELIER_IMAGE_DIR");
  }
});
