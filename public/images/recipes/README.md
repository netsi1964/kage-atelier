# Billeder til opskrifter

Læg et billede her, så kobles det automatisk til opskriften. Navnet er opskriftens **slug**:

```
public/images/recipes/<slug>.jpg      (eller .jpeg / .png / .webp)
```

Slug'en står på opskriftskortet i biblioteket (`/opskrifter.html`) og i API-svaret som `slug` / `imagePath`. Eksempel: `chokolade-avokado-fudge-222c856f.jpg`. Filnavnet `<opskrift-id>.jpg` virker også.

Nemmeste vej lokalt: kør `deno task dev`, åbn biblioteket, og brug **Upload billede** på kortet. Filen lander her med det rigtige navn. Commit og push, så er billedet med på Deno Deploy.

Hold filerne små (maks. 8 MB, gerne 1200 px bredde og JPEG/WebP), da de ligger i git.
