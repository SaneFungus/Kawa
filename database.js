// =============================================================================
// database.js — statyczne dane gry: katalog sprzętu/kawy, etykiety, progi.
// Czyste dane, zero logiki i zero odwołań do DOM. Wspólne dla wszystkich modułów.
// =============================================================================

// Każdy przedmiot mapuje się na KONKRETNY parametr modelu. Brak abstrakcyjnych bonusów.
const database = {
    grinder: [
        { id: 'g1', type: 'grinder', name: 'Bosch MKM6003', price: 0,    gsd: 2.10, icon: 'fa-blender',
          desc: 'Młynek ostrzowy. Tnie losowo: obok gruboziarnistych kawałków powstaje dużo pyłu.',
          effect: 'Rozrzut przemiału σg = 2,10 — bardzo szeroki rozkład cząstek.' },
        { id: 'g2', type: 'grinder', name: 'Timemore C2', price: 250,  gsd: 1.48, icon: 'fa-cog',
          desc: 'Stalowe żarna stożkowe. Solidny wstęp do świadomego parzenia.',
          effect: 'σg = 1,48 — pył ograniczony, złoże przepuszcza wodę równiej.' },
        { id: 'g3', type: 'grinder', name: '1Zpresso JX-Pro', price: 800,  gsd: 1.34, icon: 'fa-cogs',
          desc: 'Precyzyjna regulacja skokowa, wąski rozkład cząstek.',
          effect: 'σg = 1,34 — wąskie okno ekstrakcji staje się powtarzalne.' },
        { id: 'g4', type: 'grinder', name: 'Comandante C40', price: 1600, gsd: 1.26, icon: 'fa-gear',
          desc: 'Żarna Nitro Blade. Standard konkursowy dla metod przelewowych.',
          effect: 'σg = 1,26 — rozrzut ekstrakcji poniżej 1 pp.' }
    ],
    dripper: [
        { id: 'd1', type: 'dripper', name: 'Melitta 1x2 (plastik)', price: 0, icon: 'fa-filter',
          flowMod: 0.70, bedArea: 26, agitation: 0.85, evenness: 0.85, retention: 1.05,
          desc: 'Mały otwór wylotowy, wysokie złoże, słaba kontrola przepływu.',
          effect: 'Przepływ ×0,70, głębokie złoże, nierówna dystrybucja.' },
        { id: 'd2', type: 'dripper', name: 'Hario V60-02', price: 80, icon: 'fa-glass-water',
          flowMod: 1.00, bedArea: 33, agitation: 1.00, evenness: 1.00, retention: 1.00,
          desc: 'Stożek 60°, duży otwór, spiralne żebrowanie. Przepływ kontrolujesz nalewaniem.',
          effect: 'Referencja modelu: przepływ ×1,00.' },
        { id: 'd3', type: 'dripper', name: 'Kalita Wave 185', price: 180, icon: 'fa-water',
          flowMod: 0.86, bedArea: 45, agitation: 0.95, evenness: 1.18, retention: 1.02,
          desc: 'Płaskie dno i trzy otwory. Wybacza błędy nalewania.',
          effect: 'Płytkie złoże + wyrównanie: rozrzut ekstrakcji ÷1,18.' },
        { id: 'd4', type: 'dripper', name: 'Origami + filtr falisty', price: 340, icon: 'fa-star',
          flowMod: 1.10, bedArea: 40, agitation: 1.06, evenness: 1.12, retention: 0.97,
          desc: 'Żebra falistego filtra odsuwają papier od ścianek — szybki, czysty przepływ.',
          effect: 'Szybki przepływ ×1,10 i dobra równomierność.' }
    ],
    kettle: [
        { id: 'k1', type: 'kettle', name: 'Zwykły czajnik', price: 0, icon: 'fa-mug-saucer',
          pourQuality: 0.80, tempDrift: 3.5,
          desc: 'Szeroki wylew, brak termometru. Lejesz na oślep.',
          effect: 'Jakość nalewania 0,80; temperatura błądzi ±3,5°C.' },
        { id: 'k2', type: 'kettle', name: 'Brewista Gooseneck', price: 200, icon: 'fa-faucet',
          pourQuality: 0.96, tempDrift: 1.5,
          desc: 'Wąska gęsia szyja daje precyzyjny, cienki strumień.',
          effect: 'Jakość nalewania 0,96; dryf ±1,5°C.' },
        { id: 'k3', type: 'kettle', name: 'Fellow Stagg EKG', price: 950, icon: 'fa-temperature-half',
          pourQuality: 1.02, tempDrift: 0.3,
          desc: 'Sterowanie PID z dokładnością do 1°C. Temperatura przestaje być zmienną losową.',
          effect: 'Jakość nalewania 1,02; dryf ±0,3°C.' }
    ],
    coffee: [
        { id: 'c1', type: 'coffee', name: 'Market Blend', price: 0, icon: 'fa-seedling',
          quality: 0.55, eyMax: 31.0, acidity: 0.45, body: 1.05, daysOffRoast: 75,
          desc: 'Towarowa arabica z robustą, ciemno wypalona, 75 dni po wypale.',
          effect: 'Jakość 0,55 · EYmax 31% (ciemny wypał rozpuszcza się szybko) · stęchła.' },
        { id: 'c2', type: 'coffee', name: 'Brazylia Fazenda 83', price: 60, icon: 'fa-leaf',
          quality: 0.76, eyMax: 30.0, acidity: 0.60, body: 1.10, daysOffRoast: 21,
          desc: 'Klasyczna Brazylia, natural. Orzech, mleczna czekolada, niska kwasowość.',
          effect: 'Jakość 0,76 · mocne body · wybaczająca w nastawie.' },
        { id: 'c3', type: 'coffee', name: 'Etiopia Guji washed 87', price: 190, icon: 'fa-spa',
          quality: 0.92, eyMax: 28.5, acidity: 1.00, body: 0.85, daysOffRoast: 12,
          desc: 'Jasny wypał, wysoka gęstość ziarna. Bergamotka, jaśmin, brzoskwinia.',
          effect: 'Jakość 0,92 · EYmax 28,5% (trudniej ekstrahować) · wysoka kwasowość.' },
        { id: 'c4', type: 'coffee', name: 'Kolumbia Gesha 90 (lot konkursowy)', price: 900, icon: 'fa-award',
          quality: 1.00, eyMax: 28.0, acidity: 1.05, body: 0.90, daysOffRoast: 9,
          desc: 'Mikrolot na aukcji. Wąskie okno ekstrakcji, ale sufit smaku bardzo wysoko.',
          effect: 'Jakość 1,00 · karze każdy błąd, nagradza precyzję.' }
    ]
};

// Poziomy lokalu Kawiarni (Etap 4a). `cupPrice` to referencyjna cena filiżanki
// przy 100% jakości naparu, `dailyCap` to limit klientów na dzień — bez niego
// czynsz płacony przy "Zakończ dzień" byłby czystym kosztem bez żadnej
// przeciwwagi (nic nie stało na przeszkodzie, żeby nigdy dnia nie kończyć).
// `stations` na razie tylko zapisane, nieużywane — konsumuje je Etap 4b.
const LOCATIONS = [
    { id: 'l1', tier: 1, name: 'Budka z kawą', place: 'Świdnica',
      cupPrice: 6, dailyCap: 6, rent: 5, moveCost: 0, stations: 1,
      desc: 'Zaczynasz od zera. Mikroskopijny ruch, ale też mikroskopijne ryzyko.' },
    { id: 'l2', tier: 2, name: 'Kawiarnia Osiedlowa', place: 'Świdnica',
      cupPrice: 10, dailyCap: 12, rent: 20, moveCost: 80, stations: 1,
      desc: 'Stały lokal, więcej stałych klientów.' },
    { id: 'l3', tier: 3, name: 'Lokal w centrum Wrocławia', place: 'Wrocław',
      cupPrice: 16, dailyCap: 25, rent: 55, moveCost: 300, stations: 2,
      desc: 'Więcej klientów i wyższe ceny, ale i wyższy czynsz. Drugie stanowisko i barman — Etap 4b.' }
];

const CATEGORY_LABELS = { grinder: 'Młynki', dripper: 'Zaparzacze', kettle: 'Czajniki', coffee: 'Ziarno' };

const SENSORY_LABELS = {
    aroma: 'Aromat', flavor: 'Smak', aftertaste: 'Posmak', acidity: 'Kwasowość',
    body: 'Body', balance: 'Balans', overall: 'Ogólne wrażenie'
};

const REQ_REP_COMP = 50;
const COMP_THRESHOLD = 0.68;

const BARMAN_HIRE_COST = 250; // jednorazowo
const BARMAN_WAGE = 15;       // PLN/dzień, doliczane do czynszu przy "Zakończ dzień"
