# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co to za projekt

Gra przeglądarkowa — symulator parzenia kawy metodą przelewową w stylu World
Brewers Cup (WBrC). Brak build stepu, brak menedżera pakietów, brak testów
jednostkowych w repo. Uruchamianie = otwarcie `index.html` wprost w przeglądarce
(Tailwind, Font Awesome i Google Fonts ładowane z CDN).

## Struktura plików

`index.html` to sam szkielet UI plus lista `<script src>` — cała logika siedzi
w osobnych plikach, ładowanych w kolejności z końca `index.html`:

| Plik | Odpowiedzialność |
|---|---|
| `engine.js` | `BrewEngine` — model fizyczny, zero zależności od DOM |
| `database.js` | statyczne tabele: sprzęt, ziarno, lokale, drabinka konkursów, etykiety |
| `chart.js` | `BrewingControlChart` — rysowanie wykresu BCC |
| `pour-minigame.js` | `PourMinigame` — mini-gra nalewania |
| `profile.js` | `PlayerProfile` — cały stan gracza + zapis do `localStorage` |
| `ui-shared.js` | wspólne helpery prezentacyjne, panel nastawu, dok akcji, szuflada, pipeline parzenia |
| `module-sklep.js`, `module-lab.js`, `module-konkursy.js`, `module-kawiarnia.js` | cztery widoki gry |
| `story.js` | `StoryEvents` — warstwa fabularna |
| `main.js` | bootstrap: przełączanie widoków, górny pasek, dolne zakładki |

Kolejność `<script>` ma znaczenie tylko tam, gdzie kod wykonuje się natychmiast
przy wczytaniu. Wywołania między modułami w reakcji na klik działają niezależnie
od kolejności — uruchamiają się dopiero po `window.onload`.

`engine.js` kończy się linią `module.exports` pod Node/testy jednostkowe.
Historycznie `index.html` miał własną, ręcznie wklejoną kopię silnika — **już jej
nie ma**, silnik jest ładowany przez `<script src="engine.js">`. Jeśli natkniesz
się na dokumentację mówiącą o dwóch kopiach do synchronizowania, jest nieaktualna.

Zobacz `DESIGN.md` po pełną wizję gry (Część A) i historię etapów wdrożenia
(Część B).

## Architektura silnika (`BrewEngine`, IIFE, zero zależności od DOM)

Pipeline `brew(params, eq, coffee, seed)`:
1. `makeRng(seed)` — deterministyczny PRNG (mulberry32); ten sam seed daje ten
   sam wynik, żeby gracz mógł się uczyć nastawu, a nie zgadywać losowość.
2. Dryf temperatury czajnika (`eq.kettle.tempDrift`) losowany z seeda i dodawany
   do zadanej temperatury.
3. `particleBins(d50, gsd)` — rozkład wielkości cząstek przemiału jako histogram
   log-normalny (17 koszy); `gsd` młynka to jedyny parametr różnicujący młynki.
4. `contactTime(...)` — czas kontaktu wody ze złożem jest WYNIKIEM modelu (opór
   złoża wg złagodzonego Kozeny–Carman, zapylenie < 200 µm, odgazowanie CO2
   świeżej kawy), nie osobnym suwakiem ustawianym przez gracza.
5. `extract(...)` — kinetyka dwukompartmentowa: frakcja szybka (rozpuszczalne
   z powierzchni, prawie natychmiastowe) + frakcja wolna (dyfuzja z wnętrza
   ziarna, silnie zależna od średnicy cząstki). Zwraca średni Extraction Yield
   i `sigma` (rozrzut ekstrakcji między cząstkami = sensoryczny odpowiednik
   kanałowania/nierównego złoża).
6. `sensory(...)` — mapuje EY/TDS/sigma/jakość ziarna na siedem osi karty WBrC
   (aroma, flavor, aftertaste, acidity, body, balance, overall), skala 0–9.
7. `describe(...)` — werbalny werdykt złożony z warunków na EY/TDS/sigma.

Wejścia techniki nalewania (`agitation`, `evenness`) pochodzą z jednego z dwóch
źródeł: z `PourMinigame` (parzenie ręczne) albo — w trybie auto-parzenia —
z `eq.kettle.pourQuality` jako zastępczej wartości obu.

Kalibracja odniesienia wpisana w komentarz kodu: 15 g kawy / 250 g wody / 700 µm
mediana przemiału / 93°C / Hario V60 / Comandante C40 → EY 20,0%, TDS 1,36%,
σ 0,83, czas kontaktu 169 s. Przy zmianie stałych fizycznych (`K0`, `DIFF_EXP`,
`PERM_EXP`, `F_FAST`, `K_FAST`, `EA` itd.) warto sprawdzić, czy ten punkt
odniesienia nadal wychodzi sensownie — nie ma do tego automatycznego testu.

## PourMinigame (mini-gra nalewania)

Złoże kawy modelowane jako siatka 3 pierścienie × 12 sektorów (36 komórek,
`RINGS`/`SECTORS`/`NCELLS`). Śledzi w czasie rzeczywistym: pozycję strumienia,
fazę parzenia (`BLOOM` → `BLOOM_REST` → `POURS` → `DONE`), poziom zalania złoża
(Darcy — im wyższy słup wody, tym szybszy drenaż) i prędkość ruchu ręki
(turbulencja/agitacja). Na koniec `evaluate()` liczy `evenness` i `agitation`
z faktycznego rozkładu wody po złożu — z rozpływem bocznym przez `spread()`,
żeby woda nalana w punkt nie była karana za coś, co realnie samo się rozlewa.
Te dwie liczby (razem z faktycznie nalaną wodą) nadpisują parametry przekazywane
do `BrewEngine.brew()`.

## Stan gracza (`PlayerProfile`)

Jedyne źródło prawdy o graczu: pieniądze, reputacja, sława, ekwipunek, zapas
ziarna, receptury, lokal, dzień, wygrane konkursy, historia pomiarów na wykresie.
Każda zmiana emituje zdarzenie i zapisuje stan do `localStorage` — postęp
przeżywa odświeżenie strony. Zamiast wołać „odśwież pasek u góry" z każdego
miejsca w kodzie, `main.js` subskrybuje się raz przez `PlayerProfile.on('change')`.

Stan czysto UI (pozycje suwaków w `params`, `brewingInProgress`, otwarta
szuflada) celowo NIE jest częścią `PlayerProfile`.

## Warstwa UI

- `database` mapuje każdy przedmiot 1:1 na konkretny parametr fizyczny modelu
  (`gsd`, `flowMod`, `bedArea`, `tempDrift`, `eyMax`, `quality`...) — nie ma
  abstrakcyjnych bonusów niepowiązanych z silnikiem.
- Cztery widoki korzystają z tego samego `BrewEngine`, ale z inną prezentacją
  i regułami: **Kawiarnia** (automatyczne parzenie na aktywnej recepturze
  z Laboratorium albo domyślnym nastawie — jakość przekłada się na PLN
  i reputację), **Sklep**, **Laboratorium** (auto-parzenie do szybkiej iteracji
  + mini-gra, pełny odczyt EY/TDS/sigma/czasu), **Konkurs** (wyłącznie parzenie
  ręczne, drabinka szczebli, wymaga 50 pkt reputacji z Kawiarni).

### Układ mobilny (etapy M0–M3)

Gra jest projektowana mobile-first; desktop to ten sam kod z szerszym układem.
Trzy elementy niosą tę konstrukcję i warto ich nie rozmontować przy edycjach:

- **Powłoka aplikacji** — `body` to kolumna flex: chudy nagłówek, przewijany
  `<main>`, dolny pasek zakładek `#tabbar`. Wysokości liczone w `dvh`
  (pasek adresu mobilnej przeglądarki zmienia viewport w trakcie scrollowania),
  wcięcia przez `env(safe-area-inset-*)`, minimalny cel dotykowy w `--tap`.
  Nawigacja istnieje w DWÓCH kompletach: `#nav-*` (desktop, pod nagłówkiem)
  i `#tab-*` (telefon, dół). `switchView()` musi utrzymywać stan aktywny
  w obu.
- **Dok akcji** (`.action-dock`, `renderDock()`) — główna, powtarzalna akcja
  widoku jest przyklejona (`position: sticky`) do dolnej krawędzi `<main>`,
  poza przewijaną treścią. Dlatego `<main>` ma wyzerowany dolny padding:
  element sticky nie zejdzie niżej niż dolna krawędź swojego kontenera.
  Nie przenoś przycisków parzenia z powrotem do panelu nastawu — to cofnięcie
  całego sensu etapu M2.
- **Szuflada nastawu** (`openSheet`/`closeSheet`) — na telefonie panel suwaków
  jest PRZENOSZONY w DOM do `#sheet-body` i z powrotem, nie duplikowany.
  Dwa komplety suwaków o tych samych identyfikatorach rozjechałyby
  `refreshReadouts()`, które adresuje je po `id`. Miejsce powrotu trzymane
  przez kotwicę (`nextSibling`).

Warstwy nakładania: `#tabbar` z-30, szuflada z-40, modal z-50, mini-gra z-60.
Escape zamyka to, co na wierzchu.

## Język

Cały kod (nazwy zmiennych rdzenia domenowego, komentarze, UI) jest po polsku
i używa terminologii branży kawowej/WBrC (EY, TDS, brew ratio, bloom,
kanałowanie). Zachowuj tę konwencję przy edycjach zamiast mieszać z angielskimi
odpowiednikami.

**Cudzysłowy:** w stringach JavaScript nie używaj angielskich cudzysłowów
typograficznych — otwierającego U+201C ani zamykającego U+201D. Niektóre
środowiska traktują je jak zwykły delimiter `"` i wywracają składnię pliku.
Ten sam problem dotyczy polskiego cudzysłowu zamykającego, który jest tym samym
znakiem U+201D. W polskim tekście osadzonym w JS używaj `« »` albo template
literal (backtick nie koliduje z żadnym cudzysłowem).

Skan przed commitem:

```bash
python3 -c "
import glob
for f in sorted(glob.glob('*.js') + glob.glob('*.html')):
    for n, l in enumerate(open(f, encoding='utf-8'), 1):
        for ch in ('“', '”'):
            if ch in l: print(f, n, repr(ch))
"
```

## Weryfikacja zmian

Nie ma testów automatycznych ani lintera. Minimum przed uznaniem zmiany
za gotową:

- `for f in *.js; do node --check "$f"; done` — składnia.
- Otwarcie `index.html` i przeklikanie ścieżki, której dotyczy zmiana.
- Przy zmianach w układzie: sprawdzenie na wąskim ekranie (360×640) ORAZ na
  desktopie — oba układy dzielą ten sam kod i łatwo naprawić jeden kosztem
  drugiego.
