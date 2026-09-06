# Kontekst fra udviklingschatten

Dette dokument gemmer formålet og den viden, der blev bygget op, før koden.

## Oprindeligt mål

1. Undersøg mindst 25 kager og find mønstre i ingredienser.
2. Lav en tabel sorteret efter mest anvendte ingrediens.
3. For hver ingrediens: 5 parametre + unikke egenskaber.
4. Brug det til at pege mod den mest populære og bedst smagende kage.
5. Byg en webapp hvor man tilføjer ingredienser og skaber en ny kage.
6. Live vurdering af effektivitet/succes.
7. Keto-venlighed.
8. Random-knap til velsmagende keto-kager.
9. Forventede værdier: tør, smuldrende, m.m.
10. Mulighed for at lave mel ved at blende nødder og andet.
11. Løbende forslag til hvad der kan tilføjes + beskrivelse af hver ingrediens’ påvirkning.
12. Appen skal skrive selve opskriften.
13. Logik som Deno-modul. Backend udregner. Frontend er visning. Deno serverer det hele.
14. Forsøg på Deno Deploy (kræver bruger-token).
15. Pakkes som zip til videre udvikling.

## Kager der blev undersøgt (28+)

Chokoladekage, red velvet, gulerodskage, banankage, ananas upside-down, Black Forest, citrondrys, Victoria sponge, NY-/basque-/japansk cheesecake og sernik, kladdkaka, torta caprese, tres leches, sachertorte, tiramisu, pavlova, lamington, pound cake, angel food, devil’s food / tysk chokoladekage, frugtkage/Dundee, kaffekage, chiffon, opera cake, hummingbird, Boston cream pie, medovik, prinsesstårta, madeira.

Populæritet (globale søgninger, Leisure 2019 og senere lister):

1. Chokoladekage
2. Red velvet
3. Gulerodskage
4. Banankage
5. Ananas upside-down
6. Black Forest
7. Ice cream cake
8. Bundt
9. Citrondrys
10. Sponge / Victoria sponge

## Mønsteret bag en “vinderkage”

De fleste succesfulde kager balancerer:

- strukturbyggere: mel + æggehvide + ev. bindemiddel
- strukturbrydere: sukker/sødemiddel + fedt
- væske til hydrering og damp
- hævning (kemisk eller pisket æg)
- en klar smagsakse (vanilje, kakao, citron, krydderi)
- salt som smagsfinisher

Chokolade vinder popularitet pga. intens smag og emotionel appel. Red velvet og gulerod vinder på kontrast (syrlig flødeost-frosting) + fugt (olie/buttermilk/frugt).

Keto-kager erstatter hvedemel med mandelmel + lidt kokosmel, sukker med erythritol/allulose/monk fruit, og kompenserer manglende gluten med æg + xanthan/psyllium.

## Keto-bagning der blev indlejret i motoren

- Mandelmel: ca. 8–11 g net-carb/100 g. Fugtig og mør. Smuldrer uden æg/binder.
- Kokosmel: 3–4× mere absorberende. Brug ca. ¼ mængde og mange flere æg.
- Typisk blend: 2 dele mandelmel : 1/3–¼ kokosmel.
- Erythritol: 0 net-carb, kølig eftersmag, tørrere krumme.
- Allulose: bager mere som sukker og holder fugt bedre.
- Xanthan 1–3 g eller psyllium erstatter glutens lim.

## Scoring (heuristik, ikke lab)

Motoren i `lib/engine.ts` vægter:

- hydreringsratio vs. mels absorbans
- æg-til-mel, især ved kokosmel
- tilstedeværelse af fedt, sødemiddel, smagsgiver, hævemiddel, binder
- net-carb pr. 100 g og pr. 8 skiver
- hvedemel/sukker/banan slår keto i bund

Tallene er bevidst en model til at styre efter — ikke en kemisk garanti.

## Hvor koden står nu

Monolitten fra første UI-udgave ligger som `legacy-monolith.html` (reference). Den kørende app er Deno + `public/`.
