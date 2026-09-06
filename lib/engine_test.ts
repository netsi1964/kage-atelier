import { assert, assertEquals, assertGreater } from "jsr:@std/assert";
import { analyzeCake, analyzePreset, blendFlour } from "./engine.ts";
import { CATEGORIES, FIBERS, INGREDIENTS, KETO_PROFILES, NUTS } from "./ingredients.ts";

Deno.test("tom opskrift er empty", () => {
  const a = analyzeCake({ items: [] });
  assertEquals(a.empty, true);
});

Deno.test("klassisk chokolade scorer lavt på keto", () => {
  const a = analyzePreset("classic");
  assertEquals(a.empty, false);
  assert(a.keto < 45);
  assert(a.recipe !== null);
  assertGreater(a.recipe!.steps.length, 5);
});

Deno.test("portioner skalerer maengder men bevarer net-carb pr. stykke", () => {
  const items = [
    { id: "wheat", grams: 180 },
    { id: "sugar", grams: 180 },
    { id: "butter", grams: 150 },
    { id: "egg", grams: 150 },
    { id: "cocoa", grams: 40 },
    { id: "milk", grams: 80 },
    { id: "bp", grams: 8 },
  ];
  const base = analyzeCake({ items, servings: 8 });
  const scaled = analyzeCake({ items, servings: 12 });

  assertEquals(base.recipe?.servings, 8);
  assertEquals(scaled.recipe?.servings, 12);
  assertEquals(Math.round(scaled.totalGrams), Math.round(base.totalGrams * 1.5));
  assertEquals(scaled.netPerSlice.toFixed(1), base.netPerSlice.toFixed(1));
});

Deno.test("opskrift giver baade vaegt og koekkenmaal", () => {
  const a = analyzePreset("classic", [], { servings: 8, adjustToRealistic: true });
  const bp = a.recipe?.groups.flatMap((group) => group.lines).find((line) => line.id === "bp");

  assert(bp);
  assert(bp!.weightLabel.endsWith("g"));
  assert(bp!.kitchenLabel.includes("tsk") || bp!.kitchenLabel.includes("spsk"));
  assertEquals(a.recipe?.defaultUnitMode, "kitchen");
  assert(a.recipe?.textKitchen.includes("## Ingredienser"));
});

Deno.test("random keto er mere keto-venlig end klassisk", () => {
  const k = analyzePreset("random-keto");
  const c = analyzePreset("classic");
  assertGreater(k.keto, c.keto);
  assertGreater(k.success, 30);
});

Deno.test("blend laver custom mel", () => {
  const { ingredient, grams } = blendFlour({
    nut1: "almond",
    nut1g: 80,
    nut2: "hazelnut",
    nut2g: 20,
    fiber: "psyllium",
    fiberg: 5,
    name: "Testmel",
  });
  assertEquals(ingredient.name, "Testmel");
  assertEquals(grams, 105);
  assert(ingredient.id.startsWith("custom"));
  const a = analyzeCake({
    items: [
      { id: ingredient.id, grams },
      { id: "egg", grams: 200 },
      { id: "butter", grams: 80 },
      { id: "allulose", grams: 60 },
      { id: "vanilla", grams: 5 },
      { id: "salt", grams: 2 },
    ],
    extras: [ingredient],
    cakeName: "Blendtest",
  });
  assertEquals(a.empty, false);
  assertEquals(a.recipe?.title, "Blendtest");
});

// ---- Katalog-integritet (keto-udvidelse) ----

const ids = new Set(INGREDIENTS.map((item) => item.id));

Deno.test("katalog: unikke id'er og gyldige kategorier", () => {
  assertEquals(ids.size, INGREDIENTS.length);
  for (const item of INGREDIENTS) {
    assert(CATEGORIES.includes(item.cat), `${item.id} har ukendt kategori ${item.cat}`);
    assert(item.name.trim().length > 0, `${item.id} mangler navn`);
    assert(item.impact.trim().length > 20, `${item.id} mangler impact-tekst`);
  }
});

Deno.test("katalog: makro-tal er plausible pr. 100 g", () => {
  for (const item of INGREDIENTS) {
    assert(item.net >= 0 && item.net <= 100, `${item.id} net ${item.net}`);
    assert(item.fat >= 0 && item.fat <= 100, `${item.id} fat ${item.fat}`);
    assert(item.prot >= 0 && item.prot <= 100, `${item.id} prot ${item.prot}`);
    assert(item.fib >= 0 && item.fib <= 100, `${item.id} fib ${item.fib}`);
    assert(item.cal >= 0 && item.cal <= 900, `${item.id} cal ${item.cal}`);
    assert(item.keto >= 0 && item.keto <= 1, `${item.id} keto ${item.keto}`);
    assert(item.abs >= 0 && item.abs <= 10, `${item.id} abs ${item.abs}`);
    // Vægten af net-carb + fedt + protein + fiber kan ikke overstige 100 g (sukkeralkoholer tæller ikke som net).
    assert(item.net + item.fat + item.prot + item.fib <= 101, `${item.id} makroer summerer over 100 g`);
  }
});

Deno.test("blender: nødder og fibre peger på kendte ingredienser", () => {
  for (const nut of NUTS) assert(ids.has(nut.mapsTo), `NUTS ${nut.id} -> ${nut.mapsTo}`);
  for (const fiber of FIBERS) {
    if (fiber.mapsTo !== null) assert(ids.has(fiber.mapsTo), `FIBERS ${fiber.id} -> ${fiber.mapsTo}`);
  }
});

Deno.test("keto-profiler: alle id'er findes og scorer keto-venligt", () => {
  for (const profile of KETO_PROFILES) {
    for (const [id] of profile.items) assert(ids.has(id), `${profile.name}: ukendt id ${id}`);
    const a = analyzeCake({ items: profile.items.map(([id, grams]) => ({ id, grams })), cakeName: profile.name });
    assertEquals(a.empty, false, profile.name);
    assertGreater(a.keto, 65, `${profile.name} keto ${a.keto}`);
    assertGreater(a.success, 45, `${profile.name} succes ${a.success}`);
    assert(a.netPerSlice < 8, `${profile.name} net/stykke ${a.netPerSlice.toFixed(1)}`);
  }
});

Deno.test("i18n: en.json navngiver alle ingredienser, nødder og fibre", async () => {
  const raw = await Deno.readTextFile(new URL("../public/i18n/en.json", import.meta.url));
  const bundle = JSON.parse(raw) as { ingredients: Record<string, string>; nuts: Record<string, string>; fibers: Record<string, string> };
  for (const item of INGREDIENTS) assert(bundle.ingredients[item.id], `en.json mangler ingrediens ${item.id}`);
  for (const nut of NUTS) assert(bundle.nuts[nut.id], `en.json mangler nød ${nut.id}`);
  for (const fiber of FIBERS) assert(bundle.fibers[fiber.id], `en.json mangler fiber ${fiber.id}`);
});

Deno.test("makroer: pr. stykke gange portioner = total, energi summerer til 100", () => {
  const a = analyzePreset("classic", [], { servings: 8, locale: "da" });
  const m = a.macros;
  assert(m.total.fat > 0 && m.total.prot > 0 && m.total.net > 0);
  assert(Math.abs(m.perSlice.net * 8 - m.total.net) < 0.5);
  assert(Math.abs(m.perSlice.fat * 8 - m.total.fat) < 0.5);
  assertEquals(m.energyPct.fat + m.energyPct.prot + m.energyPct.carb, 100);
  assert(Math.abs(m.per100.net - a.netPer100) < 0.1);
  assert(a.recipe!.text.includes("g fedt"));
  assert(a.recipe!.text.includes("g protein"));
  assert(a.recipe!.text.includes("Energifordeling"));
  assert(a.recipe!.metaPills.some((pill) => pill.label.includes("protein")));
});

Deno.test("makroer: keto-profil er fedtdomineret og oversættes til engelsk", () => {
  const da = analyzePreset("random-keto", [], { servings: 8, locale: "da" });
  assertGreater(da.macros.energyPct.fat, 55);
  const en = analyzeCake({ items: da.items, cakeName: da.cakeName, servings: 8, locale: "en" });
  assert(en.recipe!.text.includes("g fat"));
  assert(en.recipe!.text.includes("Energy split"));
});
