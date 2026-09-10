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

**Vigtigt på Deno Deploy:** KV-databasen skal oprettes og tilknyttes appen i dashboardet, ellers får hver server-isolat sin egen midlertidige KV, og gemte opskrifter forsvinder ved næste deploy eller skift af isolat.

1. Organisationens side → **Databases** → **Provision Database** → vælg **Deno KV**, giv den et navn.
2. Appen `kage-atelier` → fanen **Databases** → **Attach Database** → vælg KV-instansen.
3. Ingen kodeændring: `Deno.openKv()` rammer automatisk den tilknyttede database. Deno opretter en separat database pr. miljø (production og branches).

`data/` er ikke i git.

## Billeder til opskrifter

Billeder ligger i repoet i `public/images/recipes/` og kobles til opskriften via filnavnet:

```
public/images/recipes/<slug>.jpg      (jpeg, png og webp virker også)
```

Slug'en dannes ved gem (`<titel>-<8 tegn af id>`, fx `rabarber-mandel-3f2a9c1e`) og vises i biblioteket og i API-svaret som `slug`/`imagePath`. Findes filen, sættes cover-billedet automatisk ved læsning. Ingen databaseændring.

Nemmeste arbejdsgang: kør `deno task dev`, åbn `/opskrifter.html`, tryk **Upload billede** på kortet. Filen gemmes med det rigtige navn, og du committer og pusher den. På Deno Deploy er upload slået fra, fordi filsystemet er read-only; der virker kun filer i repoet.

## Synk mellem prod og lokalt

Prod gemmer i Deno KV, lokalt gemmes i `data/recipes.json` (og en lokal KV-fil). De to
har ingen fælles historik, så de driver fra hinanden. Det gør ondt på billeder: filnavnet
indeholder de første 8 tegn af opskriftens id, og gemmer du "samme" kage lokalt, får den
et nyt id og dermed et navn, der ikke passer til filen i repoet.

`deno task sync` løser det ved at kopiere hele opskriften med id og slug i behold:

```sh
deno task sync                 # status: hvad ligger kun i prod, kun lokalt, hvad er nyere
deno task sync pull            # prod → lokalt (skriver både fil- og KV-lageret)
deno task sync pull --dry-run  # vis hvad der ville ske
deno task sync pull --store=file
deno task sync push            # lokalt → prod
```

Uden `--force` springes opskrifter over, hvor modparten er nyere. Intet slettes.

**Push er slået fra i prod som standard.** Endpointet `PUT /api/recipes/:id` svarer 405,
indtil `KAGEATELIER_SYNC_TOKEN` er sat som miljøvariabel i Deno Deploy-dashboardet. Sæt
den samme værdi lokalt, når du vil pushe. Resten af API'et er uden login, så lad være med
at lægge noget følsomt i basen.

## Deno Deploy

Appen kører på **https://kage-atelier.netsi1964.deno.net**.

Deno Deploy er koblet direkte til GitHub-repoet og bygger selv ved push til `main` med `main.ts` som entrypoint. Opskrifter gemmes i Deno KV, som er slået til uden opsætning. Der er intet GitHub Action-workflow; `deno task deploy` (deployctl) findes stadig som manuel nødløsning og kræver `DENO_DEPLOY_TOKEN`.

## Læs videre

- `docs/CONTEXT.md` — formål, research og mønstre fra den oprindelige undersøgelse
- `docs/INGREDIENTS.md` — ingrediensernes rolle og 5 parametre
- `docs/ROADMAP.md` — idéer til næste forbedringer
