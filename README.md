# Kageatelier

Webapp der lader dig bygge en kage af ingredienser, få live vurdering af succes/smag/keto, se forventet krumme (tørhed, smuldring, fugt, densitet …) og få en færdig opskrift skrevet automatisk.

Backend er Deno. Frontend er kun UI. Al scoring og opskriftsgenerering ligger i `lib/`.

## Hurtig start

```bash
deno task start
```

Åbn http://127.0.0.1:8787. Anden port: `PORT=8788 deno task start`. Ingen `.env` er nødvendig.

```bash
deno task test
deno task check
```

## Hvad appen kan

- Tilføje ingredienser i gram
- Live score: succes, smag, keto (net-carb pr. 100 g og pr. skive)
- Forventede egenskaber: tørhed, smuldring, fugtighed, densitet, sødme, hævning, rigdom, struktur
- Forslag til næste ingrediens + effekt af hver ingrediens i netop denne dej
- Blend eget mel af nødder + fiber
- Tilfældig keto-kage / klassisk chokoladekage
- Fuld opskrift med fremgangsmåde, form, temperatur og bagetid

## Arkitektur

```
lib/types.ts          typer
lib/ingredients.ts    katalog + keto-profiler + vidensbase
lib/engine.ts         scoring, opskrift, blending
lib/engine_test.ts    tests
lib/mod.ts            modul-eksport
main.ts               Deno HTTP: API + static files
public/               UI (ingen beregning)
```

API:

| Metode | Sti | Formål |
|---|---|---|
| GET | `/api/catalog` | Katalog, kategorier, blender, vidensbase |
| POST | `/api/analyze` | `{ items, cakeName?, extras? }` → scoring + opskrift |
| POST | `/api/blend` | Blend nødder/fiber → nyt mel |
| POST | `/api/random-keto` | Tilfældig keto-kage + analyse |
| POST | `/api/classic` | Klassisk chokoladekage + analyse |
| GET | `/api/health` | Status |

Hjemmelavet mel sendes tilbage som `extras` ved næste analyze, så API’en er stateless.

## Gemte opskrifter: fil lokalt, Deno KV i drift

`lib/recipe_store.ts` har to bagender med samme interface:

| Lager | Hvornår | Placering |
|---|---|---|
| `file` | lokal udvikling (standard) | `data/recipes.json` (eller `KAGEATELIER_RECIPES_FILE`) |
| `kv` | Deno Deploy (vælges automatisk) | Deno KV. Lokalt en SQLite-fil i `data/kageatelier.kv` (eller `KAGEATELIER_KV_PATH`) |

Tving et lager med `KAGEATELIER_STORE=file` eller `KAGEATELIER_STORE=kv`. Prøv KV lokalt:

```bash
KAGEATELIER_STORE=kv deno task start
```

Flyt eksisterende opskrifter fra JSON-filen til KV:

```bash
deno task migrate-kv
```

Deno KV kræver ingen opsætning på Deno Deploy. `data/` er ikke i git.

## Deno Deploy

```bash
export DENO_DEPLOY_TOKEN="ddp_..."
deno task deploy
```

Nemmest: opret projektet i Deno Deploy-dashboardet fra GitHub-repoet med `main.ts` som entrypoint. Derefter deployer GitHub Action `.github/workflows/deploy.yml` automatisk ved push til `main`.

Forventet URL: `https://kageatelier.deno.dev`

GitHub Action: `.github/workflows/deploy.yml`

## Læs videre

- `docs/CONTEXT.md` — formål, research og mønstre fra den oprindelige undersøgelse
- `docs/INGREDIENTS.md` — ingrediensernes rolle og 5 parametre
- `docs/ROADMAP.md` — idéer til næste forbedringer
