# Keto: kildekontrol og integrationsnoter

Research: Codex, 6. september 2026. Filfordeling aftalt med Claude i `dialog.md`: Codex ejer denne research; Claude integrerer katalog, motorlister, oversættelser og tests. Dette dokument beskriver forslag og fund, ikke en erklæring om at appændringerne er færdige.

## Appens natur

Kageatelier er et eksperimenterende kageværksted: gram ind, estimeret smag, krumme, keto-score og opskrift ud. Udvidelser bør bevare de otte ingredienskategorier og beregningerne i `lib/`. Prioritér råvarer, der gør en konkret forskel for kagens smag, struktur eller fugt. Ingen kostplaner eller løfter om ketose er nødvendige.

Næringsdeklarationer kan dokumentere `net`, `fat`, `prot`, `fib` og `cal`. De dokumenterer **ikke** appens numeriske `abs`, `structure`, `moisture`, `crumb`, `rise`, `flavor` og `keto`. Disse skal fortsat betegnes som modelskøn og senere kalibreres gennem prøvebagning.

## Verificerede råvarer til kataloget

Alle tal er pr. 100 g; makronæringsstoffer i gram, energi i kcal. Tallene tilhører det konkrete producentprodukt og må ikke fremstilles som universelle værdier for råvaren. `net` nedenfor er producentens deklarerede kulhydrat for disse produkter uden polyolsødning; kostfibre trækkes ikke fra igen. Brug den aktuelle emballage ved et specifikt produkt.

| Råvare / variant | net | fat | prot | fib | cal | Kilde |
|---|---:|---:|---:|---:|---:|---|
| Græskarkerner, Urtekram | 2 | 46 | 36 | 9,4 | 568 | [Producent](https://www.urtekram.dk/Foedevarer/beans-seeds-and-lentils/graskarkerner/) |
| Chiafrø, Urtekram | 1,8 | 34 | 21 | 40,9 | 447 | [Midsona](https://www.midsonafoodservice.dk/produkter/fro-kerner/chiafro/) |
| Sesamfrø, uafskallede, Urtekram | 12 | 50 | 18 | 12 | 573 | [Producent](https://www.urtekram.dk/Foedevarer/beans-seeds-and-lentils/-oko-sesamfro/) |
| Sesammel, afskallet og affedtet, Sukrin | 3,8 | 28 | 46 | 14 | 481 | [Producent](https://sukrin.com/en/products/sesame-flour) |
| Havrefiber, Sukrin | 0 | 0,3 | 0,2 | 98 | 200 | [Producent](https://sukrin.com/en/products/oat-fibre) |
| Mandelmel, fedtreduceret, Sukrin | 11 | 10 | 51 | 13 | 366 | [Producent](https://sukrin.com/en/products/fat-reduced-almond-flour) |
| Kokosfibermel, fedtreduceret, Sukrin | 18 | 14 | 19 | 40 | 354 | [Producent](https://sukrin.com/en/products/coconut-flour) |
| Tørret, revet kokos, Urtekram | 11 | 66 | 6,4 | 13 | 690 | [Producent](https://www.urtekram.dk/Foedevarer/kokos/groft-kokosmel/) |
| Solsikkekerner, Urtekram | 17 | 53 | 19 | 2,7 | 614 | [Midsona](https://www.midsonafoodservice.dk/produkter/fro-kerner/solsikkekerner2/) |

**Kildekonflikter:** Sukrins sesamside skriver 6 % kulhydrat i introduktionen, men 3,8 g i næringstabellen. Tabellen ovenfor bruger næringstabellen; verificér emballage ved produktbinding. Solsikkesidens 2670 kJ og 614 kcal stemmer ikke indbyrdes ved simpel enhedsomregning; de 614 er transskriberet, ikke korrigeret eller valideret. Ved integration er en anden dokumenteret, konsistent kilde bedre end at blande næringstal fra flere produkter. DTU Fridas enkeltsider omdirigerede under denne undersøgelse til en JavaScript-side uden læsbar næringstabel; tallene ovenfor er derfor ikke præsenteret som Frida-data.

## Bageroller og foreslået anvendelse

Følgende kombinationer er udviklingsforslag, ikke prøvebagte opskrifter:

- **Græskarkerner:** mild frøsmag, som producenten anbefaler til bagning. Forslag: formalet del af melblandingen i kakao-/kanelkage. Blenderen skal bruge hele kerners næringsprofil, medmindre produktet faktisk er affedtet.
- **Chia:** producenten beskriver kraftig væskebinding og foreslår ekstra væske eller 20 minutters iblødsætning. Forslag: lidt i en citronkage for fugt og binding. Behandl ikke chia som en dokumenteret erstatning for æggets hævning. [Chia](https://www.midsonafoodservice.dk/produkter/fro-kerner/chiafro/)
- **Sesam:** hele frø og affedtet mel skal have forskellige id'er. Forslag: sesam, kakao og vanilje. Sesam er selv et allergen; betegnelsen nøddealternativ må ikke blive til allergifri. [Sesammel](https://sukrin.com/en/products/sesame-flour)
- **Havrefiber:** producenten beskriver neutral smag og fylde. Forslag: mindre supplement til nøddemel. Det er en anden råvare end havremel, og fibertal alene gør det ikke til en xanthan-lignende gelbinder. [Havrefiber](https://sukrin.com/en/products/oat-fibre)
- **Fedtreduceret mandelmel:** giver en særskilt valgmulighed fra appens fuldfede mandelmel. Producenten beskriver større væskebehov og anbefaler binder ved større mængder. Forslag: vanilje-/citronkage med tilpasset væske. [Mandelmel](https://sukrin.com/en/products/fat-reduced-almond-flour)
- **Tørret kokos:** egnet til kokos-/chokoladesmag og tekstur. Det er revet frugtkød, ikke kokosfibermel. [Tørret kokos](https://www.urtekram.dk/Foedevarer/kokos/groft-kokosmel/)

## Vigtige rettelser i den eksisterende model

1. `NUTS.coconutRaw.mapsTo` peger ved audit på `coconutFlour`, men navnet er tørret kokos. De to producenteksempler ovenfor har henholdsvis 66 og 14 g fedt. Tilføj særskilt råvare og ret mapping. Bevar eksisterende id til gemte opskrifter.
2. `NUTS.sunflowerRaw.mapsTo` peger på `sunflower` med 3 g fedt. Hele kerner er ikke affedtet mel. Tilføj en separat kerneprofil og ret mapping; samme princip gælder sesam.
3. `getCatalog().knowledge` bliver erstattet af JSON-oversættelserne i `localizeCatalog`. Nye videnspunkter skal ind i alle fire locale-filer for at nå brugeren.
4. Motoren bruger konkrete id-lister til våde råvarer og arbejdstrin. Nye bær, cremer og nødder kræver integration dér, ikke kun en katalogrække. Køkkenmål kan falde tilbage til gram, indtil en troværdig vægtfylde er fundet.
5. `binderG` tæller alle gram i kategorien Bindemiddel ens. Store mængder havrefiber, chia eller gelatine bør ikke uden videre få samme behandling som 1–3 g xanthan. Vælg kategori og test virkningen, før profiler udvides.
6. `sweetG` afhænger af gram sødemiddel. Ren stevia eller dråber har meget lidt masse: giv dem ikke en almindelig 60–80 g sødemiddelportion eller en 1:1-blendprofil. Producentens guide skelner mellem sødme og fylde. [Sødemiddelguide](https://sukrin.com/en/information/sweetener-guide)
7. `netPer100` bruger samlet ingrediensvægt før bagning. Vandtab under bagning er ikke beregnet. `netPerSlice` er samlet beregnet kulhydrat delt med antal portioner. Forklar forskellen i vidensbasen frem for at kalde tallet en målt værdi for færdig kage.

## Korte danske videnspunkter klar til oversættelse

- "Kokosfibermel og almindeligt revet kokos er forskellige råvarer. Fibermel suger langt mere væske; vælg den variant, du faktisk har."
- "Hjemmeblendede nødder og kerner beholder fedtet. De kan ikke regnes som industrielt affedtet mel."
- "Chia binder væske. Lad frøene hydrere eller tilpas væsken, så de ikke tager fugten fra resten af dejen."
- "Havrefiber giver fylde, men er ikke det samme som havremel eller et stærkt gelbindemiddel."
- "Sødemidler varierer i både sødme og fylde. En koncentreret sødning kan derfor ikke byttes gram for gram med bagesødning."
- "Næringstal varierer mellem produkter. Brug emballagens kulhydrattal; kostfibre står særskilt på EU-deklarationer og skal ikke trækkes fra endnu en gang."
- "Kulhydrat pr. 100 g er beregnet ud fra ingrediensernes vægt før bagning. Kagen mister vand i ovnen; pr. stykke afhænger tallet af, hvor mange stykker du deler den i."
- "Keto-scoren og krummens egenskaber er vejledende modelskøn. Prøvebagning afgør, hvordan netop din råvareblanding fungerer."

EU-deklarationer angiver kulhydrat og fibre særskilt; polyoler kan også fremgå. Anvend ikke en universel fratrækningsregel på alle sødemidler. Se [Kommissionens oversigt](https://food.ec.europa.eu/food-safety/labelling-and-nutrition/food-information-consumers-legislation/nutrition-labelling_en) og [forordningens definitioner, bilag I](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32011R1169).

Meludskiftninger er opskriftsafhængige. Sukrins kokosvejledning og King Arthurs bagevejledning understøtter tilpasset væske og afprøvede opskrifter, ikke en universel regel om en fjerdedel mel og et bestemt antal æg. [Kokosfibermel](https://sukrin.com/en/products/coconut-flour), [glutenfri bagning](https://www.kingarthurbaking.com/blog/2015/02/13/gluten-free-baking-tips).

## Afgrænset opfølgning

Allulose findes allerede i katalog og tilfældige profiler. Denne audit har ikke fastslået en aktuel dansk/EU-markedsstatus. En ansøgning eller EFSA-vurdering er ikke i sig selv en markedsføringstilladelse; brug [Kommissionens gældende unionsliste](https://food.ec.europa.eu/food-safety/novel-food/authorisations/union-list-novel-foods_en), før der skrives konkrete tilgængelighedsudsagn. Producenters gamle chia-FAQ om 2013-regler skal tilsvarende ikke kopieres som aktuelle regler.

Ved integration: kontrollér unikke id'er, gyldige blender-/profilreferencer, alle fire sprogs navne og impacts, samt at de nye råvarer faktisk nævnes i opskriftens arbejdstrin. For en prøveopskrift skal fordobling af portioner halvere kulhydrat pr. stykke uden at ændre samlet kulhydrat. Ernæringstabeller og heuristiske bageparametre skal fortsat kunne spores hver for sig.
