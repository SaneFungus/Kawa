# DESIGN.md — WBrC Simulator: Droga Baristy

Żyjący dokument projektowy. Opisuje docelową wizję gry (część A) i plan techniczny,
jak dojść tam z dzisiejszego jednoplikowego prototypu (część B), bez jednorazowego
"wielkiego przepisania" wszystkiego naraz.

Ostatnia aktualizacja: 2026-09-14.

---

# CZĘŚĆ A — Wizja gry

## 1. Rama główna

Gra edukacyjno-ekonomiczna o karierze baristy. Gracz zaczyna od zera w małej
kawiarni i — ucząc się prawdziwej wiedzy o parzeniu — buduje markę, reputację
i sławę aż do startu w World Brewers Cup. Parzenie kawy (dzisiejszy `BrewEngine`)
jest jednym z narzędzi gry, nie całą grą.

## 2. Zasada architektury: profil gracza jako wspólny kontrakt

Cztery moduły (Kawiarnia, Laboratorium, Sklep, Konkursy) mają działać niezależnie —
żaden nie zagląda w wewnętrzną logikę drugiego. Komunikują się wyłącznie przez
wspólny obiekt **PlayerProfile** (pieniądze, reputacja, sława, wiedza, odblokowania,
zapisane receptury, aktywa lokalu). Moduł Kawiarni nie wie, jak liczy się
ekstrakcja — dostaje gotową "jakość naparu" z zapisanej receptury. Moduł Konkursów
nie wie, skąd wzięło się wyposażenie — dostaje z profilu listę tego, co gracz ma.

Szczegóły techniczne tego kontraktu — w Części B.

## 3. Moduł: Kawiarnia (biznes)

**Pętla:** dzień gry = płacisz czynsz, obsługujesz klientów (przy użyciu
*aktywnej receptury* z Laboratorium, nie sztywnego nastawu jak dziś), zarabiasz
proporcjonalnie do jakości i liczby klientów.

**Progresja lokalu:**

| Etap | Miejsce | Charakter |
|---|---|---|
| 1 | Stragan/kiosk, Świdnica | dzisiejszy punkt startowy, 1 stanowisko, mikroskopijny czynsz |
| 2 | Kawiarnia Osiedlowa, Świdnica | pierwszy awans, stały lokal |
| 3 | Lokal w centrum Wrocławia | wyższy czynsz, więcej klientów, 2. stanowisko, można zatrudnić barmana |
| 4 | Własna palarnia + kawiarnia flagowa | najwyższy czynsz i ryzyko, sprzedaż własnej marki |

**Nowe mechaniki:** czynsz jako regularny koszt, wielostanowiskowość (więcej
klientów naraz), decyzja o przeprowadzce (koszt + przestój, wyższy sufit zarobku).

## 4. Moduł: Laboratorium (edukacja + R&D)

Drzewko wiedzy zamiast "suwaków dla siebie". Inwestujesz pieniądze/reputację
w kolejne "kursy":

- Metody parzenia odblokowywane po kolei: V60 (start) → AeroPress → Syfon →
  Chemex → docelowo espresso.
- Głębokość modelu odsłaniana stopniowo — początkujący Marek widzi 4 suwaki,
  ekspert widzi też agitację/evenness/chemię wody osobno.
- Krótkie "czy wiesz, że..." odblokowywane przy kamieniach milowych — właściwy
  komponent edukacyjny (dziś ukryty tylko w liczbach).

**Wyjście modułu:** nazwane receptury (np. "Mój Golden Cup #1") zapisywane
w `PlayerProfile` — to one, nie surowe suwaki, są walutą wymiany z innymi
modułami.

## 5. Moduł: Sklep

Bez zmiany koncepcji, ale:

- Sprzęt i kawa odblokowywane stopniowo wraz z poziomem lokalu/reputacji.
- Ziarno jako **surowiec zużywalny**, nie trwały ekwipunek.
- Slot na **własną markę kawy** — pusty na starcie, pojawia się jako towar
  dopiero po nagrodzie z Konkursów. Spina fabułę z mechaniką: wygrana na
  szczeblu krajowym dosłownie otwiera nowy produkt w Sklepie.

## 6. Moduł: Konkursy (drabinka kariery)

| Szczebel | Nazwa robocza | Nagroda |
|---|---|---|
| 1. Lokalny | Otwarte Mistrzostwa Świdnicy | reputacja, pierwsze zainteresowanie sponsora |
| 2. Regionalny | Puchar Dolnego Śląska (Wrocław) | sława (nowa waluta), kontrakt reklamowy (pasywny dochód) |
| 3. Krajowy | Mistrzostwa Polski Baristów | duża sława, odblokowanie własnej marki kawy w Sklepie |
| 4. Światowy | World Brewers Cup | cel finałowy gry |

Każdy szczebel: trudniejsze ziarno/wymogi, surowsi sędziowie (węższe okno
Golden Cup, więcej ocenianych osi), wymóg minimalnego poziomu sprzętu/wiedzy,
żeby w ogóle wystartować.

**Sława** jako osobna waluta od reputacji: reputacja = zaufanie lokalnych
klientów (napędza Kawiarnię), sława = rozpoznawalność w branży (odblokowuje
sponsorów i własną markę). Obie mają osobne, wciąż rosnące zastosowanie —
żadna nie staje się martwą liczbą po przekroczeniu jednego progu.

## 7. Fabuła: Marek Księżarek

Fotograf z Świdnicy, pracuje dla portalu Urzędu Miasta Wrocławia. Podczas
fotografowania wydarzenia miejskiego pierwszy raz pije naprawdę dobrze
zaparzoną kawę przelewową — olśnienie. Zaczyna dorabiać przy budce z kawą
w Świdnicy (dzisiejszy punkt startowy gry, tylko z twarzą i miejscem) —
przeprowadzka do osiedlowej kawiarni to już jego pierwszy sukces, nie punkt
zerowy.

**Pięć aktów** spiętych z drabinką konkursów i lokalu:

1. **Prolog — Olśnienie.** Fotograf odkrywa kawę, zaczyna pracę przy budce
   z kawą.
2. **Nauka rzemiosła.** Mentorka — Pani Basia, doświadczona baristka — uczy go,
   że parzenie to nauka, nie przypadek (otwiera Laboratorium).
3. **Pierwszy konkurs.** Otwarte Mistrzostwa Świdnicy. Wygrana albo porażka —
   obie ścieżki dają narrację, nie tylko liczby.
4. **Rozbudowa i rywalizacja.** Przeprowadzka do Wrocławia, rozbudowa lokalu.
   Pojawia się rywal — Radek Ziarno, barista sieciówki, uosabiający
   "przemysłową kawę" kontra rzemiosło Marka. Napędza konkursy regionalne
   i krajowe.
5. **Droga na szczyt.** Mistrzostwa Polski, własna marka, World Brewers Cup —
   finał gry.

**Haczyk z zawodu Marka:** fotografia jako lekka mechanika, nie tylko
backstory — "dokumentowanie drogi" (zdjęcia idealnego naparu, momentów
z konkursów) daje niewielkie bonusy do sławy/reputacji. Jedyna postać w grze,
dla której akurat ta umiejętność ma sens.

## 8. Mapowanie na wcześniejszy audyt (Tier 3)

Ta wizja domyka wprost następujące punkty z audytu pięciu doradców:

- ✅ "Nauka nie napędza zarobku" → receptury z Lab używane w Kawiarni (§3, §4)
- ✅ "Ziarno jako trwały ekwipunek" → surowiec zużywalny (§5)
- ✅ "Brak kolejnego szczebla konkursu / złamana obietnica" → pełna drabinka (§6)
- ✅ "Brak protagonisty i łuku fabularnego" → Marek Księżarek (§7)
- ⏳ Enkapsulacja stanu (`gameState`) → wymuszona przez wymóg niezależności
  modułów, patrz Część B
- ⏳ Chemia wody, poprawka modelu σ → niezależne od tej wizji, można robić
  równolegle (fizyka silnika, nie struktura gry)

---

# CZĘŚĆ B — Plan wdrożenia technicznego

Zasada: **każdy etap jest samodzielnie grywalny i testowalny**. Żadnego
"wielkiego wybuchu" — po każdym etapie otwierasz `index.html` i gra dalej
działa, tylko coraz porządniej poukładana.

Etapy 0–2 to czysty refaktor (zero widocznej zmiany w rozgrywce, tylko
porządkowanie kodu pod przyszłe moduły). Od etapu 3 zaczynają się realne nowe
mechaniki z Części A.

## Etap 0 — Podział na pliki

Dziś: `index.html` (cała gra) + `engine.js` (nieużywany duplikat). Przeglądarka
bez problemu ładuje wiele plików `.js` przez `<script src="...">` nawet bez
żadnego bundlera — to jedyna zmiana potrzebna, żeby przejść z "jednego pliku"
na "moduły w osobnych plikach".

Docelowa struktura plików:

```
index.html          — tylko markup + <script src="..."> w kolejności ładowania
engine.js            — BrewEngine (już istnieje) — JEDYNA kopia, bez duplikatu w index.html
profile.js           — PlayerProfile: wspólny stan + API (nowy plik)
chart.js             — BrewingControlChart (wydzielone z index.html)
pour-minigame.js      — PourMinigame (wydzielone z index.html)
module-kawiarnia.js  — logika i render widoku Kawiarnia
module-lab.js        — logika i render widoku Laboratorium
module-sklep.js      — logika i render widoku Sklep
module-konkursy.js   — logika i render widoku Konkurs
story.js             — treści fabularne (dane: akty, postacie, dialogi)
ui-shared.js         — modal, metricCard, renderSensory — wspólne prezentacyjne helpery
main.js              — bootstrap: switchView, window.onload, spinanie modułów
```

Pierwsza konkretna czynność: podmienić wklejony blok 1/3 w `index.html` na
`<script src="engine.js"></script>` — to od razu likwiduje ryzyko cichego
rozjazdu silnika, które siedziało w kodzie od początku.

## Etap 1 — PlayerProfile bez zmiany zachowania

Nowy plik `profile.js`. Owija dzisiejsze pola `gameState` w metody zamiast
gołych właściwości:

- `getMoney()`, `addMoney(n)`, `spendMoney(n)` (zwraca sukces/porażkę)
- `getReputation()`, `addReputation(n)`
- `getFame()`, `addFame(n)` — nowe pole, na razie bez efektu ubocznego
- `getInventory()`, `equip(cat, id)`, `owns(cat, id)`, `buy(cat, id)`
- `getRecipes()`, `saveRecipe(name, params, result)` — na razie może nic nie
  robić poza zapisem, dopóki Etap 3 nie zacznie z tego realnie korzystać
- `on(event, callback)` — prosty event emitter

Dzięki `on()`/emitowaniu zdarzeń przy każdej zmianie, pasek u góry
(`updateTopBar()`) przestaje wymagać, żeby każda funkcja *pamiętała* go
wywołać — subskrybuje się raz i reaguje sama. To bezpośrednio naprawia
"brak enkapsulacji" z audytu inżyniera gier.

**Test etapu:** zagraj całą grę od początku do końca, sprawdź, że liczby się
zgadzają — zero widocznej zmiany.

## Etap 1b — Zapis stanu (localStorage)

Skoro kariera ma trwać godziny, a nie jedną sesję, brak zapisu (dziś: brak
w ogóle) staje się bolesny. Dzięki temu, że stan już siedzi w jednym miejscu
(`PlayerProfile`) z systemem zdarzeń z Etapu 1, dopisanie zapisu jest tanie:
serializuj cały profil do `localStorage` przy każdym zdarzeniu zmiany, wczytaj
przy starcie. Bez tego etapu 4+ wsteczne nie ma sensu — nikt nie ukończy
kariery w jednej sesji przeglądarki.

## Etap 2 — Rozbicie UI/logiki na pliki modułów

Przenieś istniejące funkcje 1:1 do właściwych plików, bez zmiany działania:

- `serveCustomer`, `completeOrder` → `module-kawiarnia.js`
- `buildControls('lab')`, `refreshReadouts`, `launchPour`, `startBrewing`,
  `showLabResult` → `module-lab.js`
- odpowiedniki dla `comp` → `module-konkursy.js`
- `renderShop`, `buyItem`, `equipItem` → `module-sklep.js`
- `metricCard`, `renderSensory`, `drawChart`, obsługa modala → `ui-shared.js`
  (to są czysto prezentacyjne helpery używane przez kilka modułów — dzielenie
  ich nie łamie niezależności, dopóki nie trzymają logiki gry)

**Test etapu:** znowu — zero widocznej zmiany, to czyste przesunięcie kodu.

## Etap 3 — Prawdziwe receptury (Lab → Kawiarnia)

Pierwsza realna zmiana rozgrywki. `completeOrder()` w Kawiarni używa
`PlayerProfile.getActiveRecipe()` zamiast sztywnych `{dose:15, water:250,...}`.
W Lab dochodzi przycisk "Zapisz recepturę" i oznaczenie jednej jako aktywnej.
To domyka lukę "nauka nie napędza zarobku" z audytu.

## Etap 4 — Czynsz i poziomy lokalu

Prosty model bez zegara czasu rzeczywistego: przycisk "Zakończ dzień" w
Kawiarni rozlicza czynsz i podsumowuje zarobek dnia. `PlayerProfile` dostaje
pole `locationTier`, każdy poziom ma zdefiniowany czynsz i limit
klientów/stanowisk. UI do przeprowadzki analogiczne do dzisiejszego Sklepu.

## Etap 5 — Ziarno jako surowiec zużywalny

Zamiast `owned` (trwałe) — `coffeeStock` (ilość) per rodzaj ziarna w
`PlayerProfile`, zużywane przy każdym parzeniu, uzupełniane w Sklepie.

## Etap 6 — Drabinka konkursów

Rozszerzenie `module-konkursy.js` o dane szczebli (próg, wymagane ziarno,
nagrody), logikę odblokowań między szczeblami, sponsoring/sławę, flagę
"własna marka" konsumowaną przez `module-sklep.js`.

## Etap 7 — Warstwa fabularna

Nowy `story.js`: definicje aktów przypięte do kamieni milowych (np. osiągnięcie
poziomu lokalu 2, wygrana szczebla 1). Mały moduł `StoryEvents` nasłuchuje
zdarzeń z `PlayerProfile` (np. `location-upgraded`, `competition-won:tier2`)
i w odpowiednim momencie pokazuje treść fabularną przez `ui-shared.js`.
Moduły mechaniczne nie wiedzą nic o fabule — tylko emitują zdarzenia.

## Etap 8 — Poprawki fizyki z audytu (równolegle, niezależnie)

Chemia wody jako nowy parametr, poprawka modelu σ (rozdzielenie wariancji
z przemiału i z kanałowania), rekalibracja `DIFF_EXP`/`PERM_EXP` — to zmiany
wyłącznie w `engine.js`, nie zależą od żadnego z powyższych etapów i mogą być
robione w dowolnym momencie równolegle.

---

## Otwarte decyzje do podjęcia przed startem

1. **Git.** Ten katalog nie jest repozytorium git. Przy tak dużym refaktorze
   (wiele nowych plików, wiele etapów) mocno rekomenduję `git init` +
   commit po każdym etapie, żeby dało się bezpiecznie wracać. Nie zrobiłem
   tego sam — to zmiana strukturalna repo, chcę Twojego potwierdzenia.
2. **Czas w grze.** Zaproponowałem ręczne "Zakończ dzień" zamiast żywego
   zegara (prościej, bez dodatkowej pętli czasu rzeczywistego do
   synchronizowania z zapisem stanu). Do potwierdzenia, czy to pasuje do
   wizji, czy jednak chcesz czas płynący samoczynnie.
3. **Kolejność wdrażania.** Plan zakłada Etapy 0→2 najpierw (czysty porządek),
   potem 3+ (nowe mechaniki). Można to złamać, jeśli wolisz zobaczyć nową
   mechanikę szybciej kosztem tymczasowego bałaganu w kodzie.

---

# CZĘŚĆ C — Przebudowa mobilna (etapy M0–M8)

Osobna oś od Części B: tamta dokładała mechaniki, ta zmienia formę wizualną.
Punkt wyjścia: interfejs był zaprojektowany pod desktop i na telefonie wymagał
przewijania, żeby sięgnąć po akcje powtarzane w każdej iteracji rozgrywki.

Diagnoza na ekranie 375×667 przed zmianami:

| Objaw | Miara |
|---|---|
| Nagłówek z pięcioma kafelkami statystyk i nawigacją w dwóch rzędach | 249 px, czyli 37% ekranu |
| Przycisk « Parz ręcznie » na końcu panelu nastawu | 319 px przewinięcia, żeby go dosięgnąć |
| Przycisk obsługi klienta i parzenia znikały przy przewinięciu treści | poza ekranem na dole obu widoków |
| Suwak przemiału 350–1200 µm krokiem 10 µm | 1 px ekranu ≈ 3 µm, nietrafialne palcem |

## Zasada prowadząca

Mobile-first: jedna kolumna jest kanonem, desktop to ten sam kod z szerszym
układem. Nie utrzymujemy dwóch równoległych układów — każda zmiana musi być
sprawdzona na 360×640 ORAZ na desktopie.

## Etapy

| Etap | Zakres | Stan |
|---|---|---|
| **M0** | Fundament: `dvh`, `viewport-fit=cover`, safe-area, zmienna `--tap` | zrobione |
| **M1** | Powłoka aplikacji: chudy nagłówek + dolny pasek zakładek | zrobione |
| **M2** | Dok akcji przyklejony do dołu w trzech widokach | zrobione |
| **M3** | Szuflada nastawu + pasek podsumowania w doku | zrobione |
| **M4** | Kontrolery dotykowe: stepper, presety, throttle rAF | zrobione |
| **M5** | Karta wyniku z zakładkami, auto-otwarcie po parzeniu | zrobione |
| **M6** | Mini-gra pełnoekranowa bez przewijania, canvas skalowany do viewportu | zrobione |
| **M7** | Sklep na dotyk (tap zamiast hover), Kawiarnia z zwijanym logiem | do zrobienia |
| **M8** | Przegląd typografii i kontrastu, testy na 360×640 i 390×844 | do zrobienia |

## Decyzje, które warto znać przed dalszymi zmianami

- **Dok akcji** musi zostać poza przewijaną treścią. Przeniesienie przycisków
  parzenia z powrotem do panelu nastawu cofa cały sens etapu M2.
- **Szuflada** przenosi panel suwaków w DOM, nie duplikuje go — dwa komplety
  suwaków o tych samych identyfikatorach rozjechałyby `refreshReadouts()`.
- **`bump` musi być wielokrotnością `step`** w tabeli `SLIDERS`, bo `setParam()`
  przyciąga wynik do kroku suwaka.
- **Zakładki wyniku** istnieją tylko na telefonie; na desktopie te same panele
  stoją obok siebie w siatce. Jeden DOM, dwa układy przez CSS.

## Weryfikacja

W repo nie ma testów, ale zmiany układu były sprawdzane skryptem Playwright
na czterech wiewportach (360×640, 375×667, 390×844, 1280×900): pozycje akcji
na obu krańcach przewijania, brak przewijania poziomego, brak błędów JS,
cele dotykowe i przejście pełnej ścieżki rozgrywki. Skrypty są jednorazowe
(katalog tymczasowy), nie wchodzą do repo — Tailwind trzeba do nich zbudować
lokalnie, bo w grze jest ładowany z CDN.
