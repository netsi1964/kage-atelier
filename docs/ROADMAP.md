# Idéer til videre forbedring

Prioriteret efter værdi vs. kompleksitet. Motoren er bevidst en heuristik — næste skridt er at gøre den mere ærlig, mere lærende og mere bagervenlig.

## Hurtige gevinster

1. **Mængde-presets i UI**  
   +10 g / +50 g / “1 æg (50 g)” / “1 tsk” i stedet for kun +50 g.

2. **Portionsskalering**  
   6 / 8 / 12 skiver. Motoren ganger gram og justerer form/tid.

3. **Allergi-filtre**  
   Skjul nødder, laktose, æg. Foreslå solsikkemel, kokosolie, aquafaba med ærlig advarsel om tekstur.

4. **Gem opskrift lokalt**  
   `localStorage` eller fil-export (JSON + den tekstopsrift der allerede genereres).

5. **Sammenlign to deje**  
   Split-view: klassisk chokolade vs. den keto-version brugeren netop byggede.

## Bedre model

6. **Baker’s percent som first-class**  
   Vis % af melvægt. Advar når keto-dej afviger fra kendte vindervinduer (æg 80–180 % af nødde-mel, fedt 40–80 %, sødemiddel 30–60 %).

7. **Kalibrér mod rigtige opskrifter**  
   Tag 20 publicerede keto-kager + 20 klassiske. Fit vægte så “kendt god opskrift” lander på succes 75–90. Gem fixtures i `lib/fixtures/`.

8. **Særskilt kiks-mode**  
   Lavere væske, højere fedt, mindre hævning. Samme motor, andet målinterval.

9. **Frosting som del-opskrift**  
   Flødeost, ganache, smørcreme med egen keto-score, så total pr. skive inkluderer topping.

10. **Usikkerhedsbånd**  
    Vis “tørhed 62 ± 12” i stedet for ét tal, så brugeren forstår at det er et skøn.

## Produkt

11. **Trin-for-trin wizard**  
    Vælg mål: “keto fødselsdag”, “saftig chokolade”, “få æg”. Appen foreslår en base og lader brugeren tune.

12. **Indkøbsliste**  
    Gruppér butikshylder, afrund til pakkestørrelser.

13. **Billeder / mood**  
    Generér eller hent referencefoto ud fra smagsakse (chokolade, citron, gulerod).

14. **Print-stylesheet**  
    Allerede påbegyndt. Gør opskriftssiden til et rent A4-kort.

15. **i18n**  
    Kataloget er dansk. Flyt strenge til `lib/i18n/da.ts` og tilføj en.

## Platform

16. **Deno Deploy med token**  
    `deno task deploy` er klar. Mangler kun `DENO_DEPLOY_TOKEN`.

17. **SQLite / KV til gemte kager**  
    Hvis flere brugere: Deno KV på Deploy.

18. **Streaming-analyse**  
    Unødvendigt nu (analysen er instant), men fint hvis modellen senere kalder LLM til opskriftstekst.

19. **LLM som valgfri lag, ikke kerne**  
    Behold den deterministiske motor. Brug en model kun til at omskrive fremgangsmåden i en venligere tone eller foreslå navne.

20. **Test-fixtures pr. profil**  
    Snapshot af scores for de 6 keto-profiler, så refactors ikke ændrer adfærd i blinde.

## Data der stadig mangler

- Præcise net-carb pr. mærke (Swerve vs. rene erythritol).
- Absorbans for lupinmel, soja-isolat, proteinpulver.
- Æggeerstatninger (aquafaba, chia-gel) med ærlige tekstur-straffe.
- Højde over havet / ovntype — for meget for v1, men bagetid kunne få et “luftig ovn / varmedovn”-multiplier.

## Forslag til første PR efter zip’en

1. Fjern `legacy-monolith.html` når ingen længere har brug for den.  
2. Tilføj 1 æg-knap og skalér til 8/12 skiver.  
3. Skriv 5 fixture-tests på kendte profiler.  
4. Tilføj frosting som valgfri anden bom.  
5. Deploy når token findes.
