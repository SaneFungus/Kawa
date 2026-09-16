# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co to za projekt

Gra przeglądarkowa — symulator parzenia kawy metodą przelewową w stylu World
Brewers Cup (WBrC). Brak build stepu, brak menedżera pakietów; jedyny test
jednostkowy to `test-engine.js` (`node test-engine.js`, zero frameworka).
Uruchamianie gry = otwarcie `index.html` wprost w przeglądarce (Tailwind,
Font Awesome i Google Fonts ładowane z CDN).

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

`engine.js` i `database.js` kończą się linią `module.exports` pod Node —
z tego korzysta jedyny test w repo, `test-engine.js` (patrz „Weryfikacja
zmian" niżej). Ta gałąź `module.exports` jest no-opem w przeglądarce
(`typeof module !== 'undefined'` jest tam fałszywe), więc nie zmienia
ładowania przez `<script src="...">`.
Historycznie `index.html` miał własną, ręcznie wklejoną kopię silnika — **już jej
nie ma**, silnik jest ładowany przez `<script src="engine.js">`. Jeśli natkniesz
się na dokumentację mówiącą o dwóch kopiach do synchronizowania, jest nieaktualna.

Zobacz `DESIGN.md` po pełną wizję gry (Część A), historię etapów wdrożenia
mechanik (Część B) i plan przebudowy mobilnej M0–M8 wraz ze stanem realizacji
(Część C).

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
mediana przemiału / 93°C / Hario V60 / Comandante C40 / kawa jak Brazylia
Fazenda 83 / woda referencyjna SCA (GH 100, KH 40 ppm) → EY 20,95%, TDS 1,43%,
σ 0,87, czas kontaktu 165 s. Przy zmianie stałych fizycznych (`K0`, `DIFF_EXP`,
`PERM_EXP`, `F_FAST`, `K_FAST`, `EA`, `GH_EXP`, `KH_FLAT_SPAN`,
`CHANNEL_SIGMA_COEF` itd.) uruchom `node test-engine.js` — pilnuje właśnie
tego punktu i albo potwierdzi, że zmiana wyszła zgodnie z zamiarem, albo
pokaże, o ile się przesunął.

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

### Układ mobilny (etapy M0–M8)

Gra jest projektowana mobile-first; desktop to ten sam kod z szerszym układem.
Siedem elementów niesie tę konstrukcję i warto ich nie rozmontować przy edycjach:

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
- **Kontrolery nastawu** (`SLIDERS` w `ui-shared.js`) — każdy parametr ma
  stepper minus/plus i, gdzie ma to sens, presety. `step` to rozdzielczość
  suwaka, `bump` to skok jednego tapnięcia. **`bump` MUSI być wielokrotnością
  `step`**, bo `setParam()` przyciąga wynik do kroku — przy step 10 i bump 25
  tapnięcie przesuwało nastaw raz o 20, raz o 30 µm. `setParam()` jest jedynym
  wejściem dla suwaka, steppera i presetów (przycina do zakresu, przyciąga do
  kroku, odświeża odczyt).
- **Karta wyniku** (`buildResultTabs`/`showResultPane`) — odczyt, karta
  sensoryczna i wykres to trzy panele o wspólnych kluczach (`wynik`,
  `sensoryka`, `wykres`) w obu trybach; różnią się wyłącznie etykiety.
  Na telefonie dzielą jedno miejsce i przełącza się je zakładkami, na
  desktopie stoją obok siebie w siatce. Po zakończeniu parzenia
  `startBrewing()` sam przełącza na panel `wynik` i podciąga kartę pod górną
  krawędź. Wykres ma stały `viewBox`, więc renderowanie go w ukrytej zakładce
  jest bezpieczne.

- **Mini-gra na pełnym ekranie** (`.pour-shell`) — jedyny ekran gry czasu
  rzeczywistego, więc nic tu nie może wypaść pod krawędź: powłoka jest kolumną
  flex na `100dvh`, overlay ma `overflow: hidden`, pole gry zabiera całą wolną
  wysokość, a paski i przyciski mają stałą. Canvas trzyma kwadrat przez
  `aspect-ratio` z `max-width`/`max-height` — **nie używaj `object-fit`**:
  dotyk jest mapowany przez `getBoundingClientRect()` CAŁEGO elementu, więc
  letterboxing rozjechałby współrzędne strumienia względem złoża. Rozdzielczość
  bitmapy (`CV`) jest stała i niezależna od rozmiaru CSS, dlatego skalowanie
  nie wymaga żadnej zmiany w logice mini-gry.

- **Sklep na dotyk** (`Sklep.showCategory`/`toggleDetails`) — cztery kategorie
  jako zakładki (jedna sekcja naraz) i szczegóły przedmiotu zwinięte pod
  tapnięcie; na desktopie pasek znika, a wszystkie sekcje i opisy są widoczne.
  `activeCat` żyje poza `render()`, bo `render()` leci po każdym zakupie
  i nie może wyrzucać gracza z kategorii, w której właśnie kupował.
  **Powód blokady przycisku musi być widoczny w treści** — atrybut `title`
  nie istnieje na dotyku, a był jedyną informacją o tym, ile brakuje pieniędzy.

Warstwy nakładania: `#tabbar` z-30, szuflada z-40, modal z-50, mini-gra z-60.
Escape zamyka to, co na wierzchu.

### Pułapka: własny CSS kontra klasy Tailwinda

Blok `<style>` w `index.html` stoi w arkuszu PO Tailwindzie, więc przy równej
specyficzności wygrywa. To już dwa razy dało cichą regresję:

- `.result-tabs { display: flex }` nadpisywało klasę `md:hidden` — pasek
  zakładek pokazywał się na desktopie. Widoczność takich elementów chowaj
  w swojej własnej regule `@media`, nie klasą w markupie.
- własny `gap` NIE zastępuje klasy `space-y-*`, tylko się do niej dodaje,
  bo selektor Tailwinda `.space-y-5 > :not([hidden]) ~ :not([hidden])` jest
  bardziej specyficzny niż `> * + *`. Żeby go nadpisać, użyj tego samego
  kształtu selektora.
- klasy `flex` i `hidden` Tailwinda mają tę samą specyficzność, więc o wyniku
  decyduje kolejność w arkuszu. Tam, gdzie kod przełącza widoczność przez
  `classList.toggle('hidden')` na elemencie, który ma też być kolumną flex
  (`#pour-stage`, `#pour-summary`), rozstrzygnij to własną regułą z selektorem
  po `id`, zamiast liczyć na kolejność.

Po każdej zmianie w układzie sprawdź OBA warianty — regresja pokazuje się
tylko na jednym z nich.

### Pułapka: rozmiary czcionek w `chart.js` są w jednostkach viewBoxa

Wykres ma `viewBox` 520 jednostek i renderuje się na 260–317 px CSS, czyli
w skali 0,50–0,61. `font-size="11"` dawał na telefonie **5,5 px na ekranie**.
Wartości 19/21 w kodzie dają 9,5–12,8 px i są poprawne — nie zmniejszaj ich
dlatego, że w kodzie wyglądają na duże. Po każdej zmianie rozmiaru czcionki
sprawdź też `PAD` i odstępy etykiet od osi: skalują się razem z czcionką,
a przy poprzedniej wartości podpis osi TDS wchodził na liczby.

### Kontrast: dwa tła nie przechodzą AA z białym tekstem

`bg-amber-600` daje 3,19:1, a `bg-emerald-600` 3,77:1 — oba poniżej progu 4,5.
Przyciski z białym tekstem używają `amber-700` (5,02:1) i `emerald-700`
(5,48:1). Analogicznie na ciemnych kartach `text-stone-500` daje 3,65:1 —
tam idzie `stone-400` (6,93:1), a na jasnym tle odwrotnie: `stone-400` ma
2,41:1, więc minimum to `stone-500`.

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

Nie ma lintera. Jest jeden test automatyczny (`test-engine.js`, czysty Node,
zero frameworka) — pilnuje punktu kalibracyjnego `BrewEngine` opisanego wyżej.
Minimum przed uznaniem zmiany za gotową:

- `for f in *.js; do node --check "$f"; done` — składnia.
- Przy zmianie czegokolwiek w `engine.js`: `node test-engine.js`.
- Otwarcie `index.html` i przeklikanie ścieżki, której dotyczy zmiana.
- Przy zmianach w układzie: sprawdzenie na wąskim ekranie (360×640) ORAZ na
  desktopie — oba układy dzielą ten sam kod i łatwo naprawić jeden kosztem
  drugiego.
