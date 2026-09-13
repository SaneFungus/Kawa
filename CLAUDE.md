# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Co to za projekt

Jednoplikowa gra przeglądarkowa — symulator parzenia kawy metodą przelewową w stylu World Brewers Cup (WBrC). Brak build stepu, brak menedżera pakietów, brak testów, nie jest to repozytorium git. Uruchamianie = otwarcie `index.html` wprost w przeglądarce (Tailwind, Font Awesome i Google Fonts ładowane z CDN).

## Struktura plików — WAŻNA pułapka

- `index.html` — cała działająca gra: UI + cztery bloki `<script>` na końcu pliku (BrewEngine, BrewingControlChart, PourMinigame, warstwa gry/UI).
- `engine.js` — osobny plik z modułem `BrewEngine`, logicznie identyczny z blokiem 1/3 wklejonym w `index.html` (różni się tylko nagłówkiem komentarza i linią `module.exports` na końcu, dodaną pod Node/testy jednostkowe).
- **`index.html` NIE ładuje `engine.js`** przez `<script src="...">` — ma własną, ręcznie wklejoną kopię silnika. To celowe przygotowanie pod przyszłe wycięcie do osobnego modułu (komentarz w index.html, ok. linii 185: "Gotowy do wycięcia 1:1 do pliku engine.js (Vite / testy jednostkowe)"), które jeszcze się nie wydarzyło.
- **Konsekwencja:** zmiana fizyki/wzorów tylko w `engine.js` nie wpłynie na działającą grę, i odwrotnie. Przy każdej zmianie w `BrewEngine` edytuj obie kopie (`engine.js` oraz blok 1/3 w `index.html`, ok. linii 188–397) albo wyraźnie zapytaj użytkownika, którą wersję traktować jako źródło prawdy.

## Architektura silnika (`BrewEngine`, IIFE, zero zależności od DOM)

Pipeline `brew(params, eq, coffee, seed)`:
1. `makeRng(seed)` — deterministyczny PRNG (mulberry32); ten sam seed daje ten sam wynik, żeby gracz mógł się uczyć nastawu, a nie zgadywać losowość.
2. Dryf temperatury czajnika (`eq.kettle.tempDrift`) losowany z seeda i dodawany do zadanej temperatury.
3. `particleBins(d50, gsd)` — rozkład wielkości cząstek przemiału jako histogram log-normalny (17 koszy); `gsd` młynka to jedyny parametr różnicujący młynki w modelu.
4. `contactTime(...)` — czas kontaktu wody ze złożem jest WYNIKIEM modelu (opór złoża wg złagodzonego Kozeny–Carman, zapylenie < 200 µm, odgazowanie CO2 świeżej kawy), nie osobnym suwakiem ustawianym przez gracza.
5. `extract(...)` — kinetyka dwukompartmentowa: frakcja szybka (rozpuszczalne z powierzchni, prawie natychmiastowe) + frakcja wolna (dyfuzja z wnętrza ziarna, silnie zależna od średnicy cząstki). Zwraca średni Extraction Yield i `sigma` (rozrzut ekstrakcji między cząstkami = sensoryczny odpowiednik kanałowania/nierównego złoża).
6. `sensory(...)` — mapuje EY/TDS/sigma/jakość ziarna na siedem osi karty WBrC (aroma, flavor, aftertaste, acidity, body, balance, overall), skala 0–9.
7. `describe(...)` — werbalny werdykt złożony z warunków na EY/TDS/sigma.

Wejścia techniki nalewania (`agitation`, `evenness`) pochodzą z jednego z dwóch źródeł: z `PourMinigame` (parzenie ręczne) albo — w trybie auto-parzenia — z `eq.kettle.pourQuality` jako zastępczej wartości obu.

Kalibracja odniesienia wpisana w komentarz kodu: 15 g kawy / 250 g wody / 700 µm mediana przemiału / 93°C / Hario V60 / Comandante C40 → EY 20,0%, TDS 1,36%, σ 0,83, czas kontaktu 169 s. Przy zmianie stałych fizycznych (`K0`, `DIFF_EXP`, `PERM_EXP`, `F_FAST`, `K_FAST`, `EA` itd.) warto sprawdzić, czy ten punkt odniesienia nadal wychodzi sensownie — nie ma do tego automatycznego testu.

## PourMinigame (mini-gra nalewania)

Złoże kawy modelowane jako siatka 3 pierścienie × 12 sektorów (36 komórek, `RINGS`/`SECTORS`/`NCELLS`). Śledzi w czasie rzeczywistym: pozycję strumienia, fazę parzenia (`BLOOM` → `BLOOM_REST` → `POURS` → `DONE`), poziom zalania złoża (Darcy — im wyższy słup wody, tym szybszy drenaż) i prędkość ruchu ręki (turbulencja/agitacja). Na koniec `evaluate()` liczy `evenness` i `agitation` z faktycznego rozkładu wody po złożu — z rozpływem bocznym przez `spread()`, żeby woda nalana w punkt nie była karana za coś, co realnie samo się rozlewa. Te dwie liczby (razem z faktycznie nalaną wodą) nadpisują parametry przekazywane do `BrewEngine.brew()`.

## Warstwa gry (blok 4/4 w `index.html`)

- `database` — statyczna tabela sprzętu (`grinder`, `dripper`, `kettle`) i ziarna (`coffee`). Każdy przedmiot mapuje się 1:1 na konkretny parametr fizyczny modelu (`gsd`, `flowMod`, `bedArea`, `tempDrift`, `eyMax`, `quality`...) — nie ma abstrakcyjnych "bonusów" niepowiązanych z silnikiem.
- `gameState` — mutowalny globalny obiekt (pieniądze, reputacja, ekwipunek, historia pomiarów na wykresie). Trzymany wyłącznie w pamięci karty przeglądarki — brak `localStorage` i jakiegokolwiek zapisu; odświeżenie strony zeruje postęp.
- Trzy widoki korzystające z tego samego `BrewEngine`, ale z inną prezentacją i regułami: **Laboratorium** (auto-parzenie do szybkiej iteracji + mini-gra, pełny odczyt liczbowy EY/TDS/sigma/czasu), **Konkurs** (wyłącznie parzenie ręczne przez mini-grę, próg 68% sumy karty sensorycznej odblokowuje wygraną, wymaga wcześniej 50 pkt reputacji z Kawiarni), **Kawiarnia** (automatyczne parzenie na stałym, "rozsądnym" nastawie 15 g/250 g/700 µm/93°C — wynik jakości przekłada się bezpośrednio na PLN i reputację).

## Język

Cały kod (nazwy zmiennych rdzenia domenowego, komentarze, UI) jest po polsku i używa terminologii branży kawowej/WBrC (EY, TDS, brew ratio, bloom, kanałowanie). Zachowuj tę konwencję przy edycjach zamiast mieszać z angielskimi odpowiednikami.
