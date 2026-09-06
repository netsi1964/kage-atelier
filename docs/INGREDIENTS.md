# Ingredienser: rolle, parametre og unikke egenskaber

Sorteret efter typisk hyppighed i de undersøgte kager. De fem parametre er de samme for alle:

1. Struktur / binding  
2. Smag og aroma  
3. Tekstur og mundfølelse  
4. Kemisk / bageteknisk funktion  
5. Bidrag til popularitet eller keto-egnethed  

Tal i kataloget (`lib/ingredients.ts`) er pr. 100 g: `net`, `fat`, `prot`, `fib`, `cal`, plus effekt-skalaer brugt af motoren.

## 1. Sukker (hvidt / brunt)

Hyppighed: næsten alle klassiske kager.

| Parameter | Rolle |
|---|---|
| Struktur | Tenderiserer, hæmmer gluten |
| Smag | Primær sødme, brunt sukker giver melasse |
| Tekstur | Holder fugt (hygroskopisk) |
| Kemi | Creaming-luft, Maillard, karamel |
| Popularitet | Forventet “kage-smag”, slår keto ihjel |

Unikt: for lidt = tør/sej, for meget = kollaps og klæg midte.

Keto-erstatninger i kataloget: erythritol, allulose, monk fruit-blend.

## 2. Æg (hele, hvide, blommer)

Hyppighed: 85–95 %.

| Parameter | Rolle |
|---|---|
| Struktur | Proteinkoagulation, skelet |
| Smag | Mild rigdom, blomme |
| Tekstur | Fugt + emulsion |
| Kemi | Lecithin emulgerer fedt/vand, pisket luft hæver |
| Popularitet / keto | Uundværlig i keto, især med kokosmel |

Unikt: kokosmel-kager kræver ofte 5–6 æg pr. 60 g kokosmel. Hvider giver volumen (angel food). Blommer giver fløjl.

## 3. Hvedemel / cakemel

Hyppighed: 80–85 % af klassiske kager.

| Parameter | Rolle |
|---|---|
| Struktur | Gluten-net fanger CO₂ |
| Smag | Neutral base |
| Tekstur | Cakemel (7–8 % protein) = fin krumme |
| Kemi | Stivelsesgelatinisering |
| Popularitet / keto | Klassisk volumen, keto-score ≈ 0 |

Unikt: uden gluten skal æg + xanthan/psyllium tage over.

Keto-mel i kataloget: mandel, kokos, hasselnød, valnød, pecan, solsikke, hørfrø + blendede custom-mel.

## 4. Fedt (smør, olie, kokosolie)

Hyppighed: 70–85 %.

| Parameter | Rolle |
|---|---|
| Struktur | Forkorter gluten / mørner |
| Smag | Smør = aroma, olie = neutral |
| Tekstur | Fugt og coating i munden |
| Kemi | Creaming fanger luft, olie holder fugt længere |
| Popularitet / keto | Rigdom. Fedt er keto-venligt |

Unikt: smør+olie sammen bruges ofte i “bedste” moderne kager.

## 5. Vanilje

Hyppighed: 60–75 %.

| Parameter | Rolle |
|---|---|
| Struktur | Ingen |
| Smag | Løfter sødme og dækker æg/mel |
| Tekstur | Ingen |
| Kemi | Aromastoffer i lille dosis |
| Popularitet | Perception af kvalitet |

Unikt: lille mængde, stor effekt på smags-score.

## 6. Hævemiddel (bagepulver / natron / cream of tartar)

| Parameter | Rolle |
|---|---|
| Struktur | Udvider luftceller |
| Smag | For meget = bittert |
| Tekstur | Porøs krumme |
| Kemi | CO₂. Natron kræver syre |
| Popularitet | Forventet “hævet kage” |

Unikt: natron + kærnemælk/kakao er red velvet-logikken.

## 7. Salt

| Parameter | Rolle |
|---|---|
| Struktur | Lille gluten-styrke |
| Smag | Skærper sødme |
| Tekstur | Ingen |
| Kemi | Smagsbalance |
| Popularitet | Kagen smager “færdig” |

## 8. Mælk / kærnemælk / fløde / mandelmælk

| Parameter | Rolle |
|---|---|
| Struktur | Hydrering |
| Smag | Kærnemælk = syre |
| Tekstur | Damp + saftighed |
| Kemi | Aktiverer soda, fortynder dej |
| Popularitet / keto | Tres leches-effekt. Sødmælk er ikke streng keto |

## 9. Kakao / mørk chokolade

| Parameter | Rolle |
|---|---|
| Struktur | Lidt tørrende (kakao) |
| Smag | Intens bitter-sød akse |
| Tekstur | Smelt og fedme (chokolade) |
| Kemi | Reagerer med soda, mørk farve |
| Popularitet | Verdens mest søgte kageprofil |

## 10. Flødeost og syrlige mejeriprodukter

| Parameter | Rolle |
|---|---|
| Struktur | Blød, tæt |
| Smag | Syre som kontrast til sødme |
| Tekstur | Cremet frosting / cheesecake |
| Kemi | Fedt + protein, lidt net-carb |
| Popularitet | Signature på red velvet, gulerod, cheesecake |

## 11. Bindemidler (xanthan, psyllium, hørfrø)

| Parameter | Rolle |
|---|---|
| Struktur | Gluten-erstatning |
| Smag | Næsten neutral (psyllium kan smage lidt) |
| Tekstur | Mindre smuldring |
| Kemi | Gelerer vand |
| Keto | Næsten 0 net-carb |

Unikt: 1–3 g xanthan er nok. For meget = slim.

## 12. Frugt, grønt og nøddepynt

Gulerod, banan, bær, pekan, valnød.

| Parameter | Rolle |
|---|---|
| Struktur | Lidt masse, kan gøre midten våd |
| Smag | Sødme, syre, ristet nød |
| Tekstur | Fugt eller knas |
| Kemi | Extra vand og sukkerarter |
| Popularitet / keto | Gulerod/banan driver klassiske hits. Banan er dårlig keto |

## Katalogfelter i koden

Hver ingrediens i `INGREDIENTS` har:

```
id, name, cat,
net, fat, prot, fib, cal,   // pr. 100 g
abs,                         // absorbans 0–10
structure, moisture, crumb, sweet, rich, rise, flavor, keto,
impact                       // dansk forklaring til UI
```

Nye ingredienser tilføjes i `lib/ingredients.ts`. Motoren behøver ikke kende dem ved navn, undtagen særlige cases (kokosmel, hvedemel, chokolade, æg).

## Keto-udvidelse (6. september 2026)

Kataloget er udvidet fra 43 til 94 ingredienser, blenderen fra 6 til 9 råvarer og 4 til 7 fibre, og de tilfældige keto-profiler fra 6 til 14. Alle nye rækker følger samme felter som før. `net` er producentens eller USDA's kulhydrat minus fiber; for polyoler regnes erythritol som 0 og xylitol/tagatose som 25 g net pr. 100 g (delvis optagelse). Effekt-skalaer (`abs`, `structure`, `moisture` …) er modelskøn, ikke målte værdier.

| Kategori | Nye id'er |
|---|---|
| Mel & blender | `almondLowFat`, `sesameFlour`, `chiaMeal`, `oatFiber`, `lupin`, `inulin`, `wheyProtein`, `eggWhiteProtein` |
| Sødt | `xylitol`, `sweetBlend`, `powderedSweet`, `brownSweet`, `tagatose`, `fiberSyrup` |
| Fedt | `ghee`, `mctOil`, `avocadoOil`, `almondButter`, `peanutButter`, `tahini` |
| Æg & mejeri | `coconutCream`, `coconutMilk`, `mascarpone`, `greekYogurt`, `skyr`, `ricotta` |
| Bindemiddel | `gelatin` |
| Smag | `cardamom`, `ginger`, `nutmeg`, `orangeZest`, `lime`, `almondExtract`, `cocoaMass`, `sugarFreeChips`, `vinegar` |
| Frugt & pynt | `raspberries`, `strawberries`, `blueberries`, `rhubarb`, `zucchini`, `pumpkinPuree`, `avocado`, `coconutShred`, `macadamia`, `pumpkinSeeds`, `sunflowerSeeds`, `sesameSeeds`, `almondFlakes`, `cocoaNibs`, `freezeDriedRaspberry` |

Valg der er taget bevidst:

- **Chiamel, havrefiber og inulin ligger i "Mel & blender", ikke "Bindemiddel".** Motoren ganger alle gram i Bindemiddel med en stærk anti-smuldre-faktor, som passer til 1–4 g xanthan/psyllium, men ikke til 10–30 g fiber. Kun `gelatin` er kommet i Bindemiddel, med lav typisk dosis.
- **Ren stevia og munkefrugt-ekstrakt er ikke i kataloget.** Motoren regner sødme pr. gram, og 1 g ekstrakt ville score som ingenting. I stedet findes 1:1-blandingen `sweetBlend`, og vidensbasen forklarer hvorfor.
- **Blenderen peger nu på råvaren, ikke på affedtet mel.** `coconutRaw` giver revet kokos (66 g fedt) i stedet for kokosfibermel (15 g), og `sunflowerRaw` giver hele kerner (51 g fedt) i stedet for affedtet solsikkemel (3 g). De gamle mel-id'er er uændrede, så gemte opskrifter virker stadig.
- **Vidensbasen læses fra `public/i18n/*.json`.** Nye punkter er derfor lagt i alle fire sprogfiler og spejlet i `getCatalog()`.
- **Motoren kender de nye id'er** i `WET_IDS`, fedt-/smagslisterne, køkkenmål, titler og arbejdstrin (inkl. et nyt trin for vådt fyld: squash, rabarber, bær). Scoring-formlerne er ikke ændret.

### Kilder

Producenttal (Sukrin, Urtekram, Funktionel Mad, Arla, Galbani, Lily's/ChocZero) og USDA FoodData Central-poster er samlet med links i `docs/KETO-SOURCE-AUDIT.md` (Codex' kildeaudit) og i research-noterne bag denne udvidelse. De vigtigste referencer:

- USDA FoodData Central (SR Legacy): macadamia 170178, græskarkerner 170556, mandler 170567, hindbær 167755, jordbær 167762, blåbær 171711, rabarber 167758, squash 169291, græskar (dåse) 168450, avokado 171705, revet kokos 170170, ghee 173412, ricotta 01036, mandelsmør 12195, peanutbutter 16098, tahin 12166, kardemomme, ingefær, muskatnød, appelsinskal 169103, lime 168155, æblecidereddike 173469, gelatine 172429.
- Sukrin produktsider: sesammel, havrefiber, fedtreduceret mandelmel, Sukrin Gold, Melis, sødemiddelguide.
- Wholesome Yum: sødemiddel-konverteringstabel, æggeerstatninger, kokosmelkage.
- KetoDiet Blog: sødemiddelguide og konverteringstabel.
- Sugar Free Londoner, All Day I Dream About Food, gnom-gnom, My Sweet Keto: bageregler om ovntemperatur, allulose-bruning, erythritol-krystallisering, æggesmag, grøn/lilla farvning, drænet frugt.
- BAKERpedia: erythritol og cikoriefiber.
- EU-forordning 1169/2011 (bilag I) om deklaration af kulhydrat, fiber og polyoler.
