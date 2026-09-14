// =============================================================================
// engine.js — silnik symulacji ekstrakcji (WBrC Simulator v3)
// Czysty modul: zero zaleznosci od DOM, deterministyczny, testowalny.
// Wejscia techniki (agitation / evenness) pochodza z PourMinigame albo,
// w trybie auto, z jakosci nalewania czajnika.
// =============================================================================

const BrewEngine = (function () {

    // ---------- Stałe fizyczne / kalibracyjne ----------
    const LRR        = 2.0;     // liquid retained ratio [g wody / g kawy] zatrzymane w fusach
    const D_REF      = 700;     // referencyjna mediana przemiału [µm]
    const T_REF      = 93;      // referencyjna temperatura [°C]
    const T_BASE     = 165;     // referencyjny czas kontaktu [s] dla setupu odniesienia
    const K0         = 0.00394; // stała szybkości ekstrakcji frakcji wolnej [1/s] przy D_REF
    const DIFF_EXP   = 0.70;    // wykładnik zależności k od średnicy cząstki
    const PERM_EXP   = 1.30;    // wykładnik przepuszczalności złoża (Kozeny–Carman, złagodzony)
    const F_FAST     = 0.42;    // udział frakcji szybkiej (powierzchnia + rozbite komórki)
    const K_FAST     = 0.055;   // stała szybkości frakcji szybkiej [1/s]
    const Z_RANGE    = 2.2;     // obcięcie ogonów rozkładu log-normalnego
    const EA         = 52000;   // energia aktywacji [J/mol] dla rozpuszczalnych
    const R_GAS      = 8.314;

    // ---------- Chemia wody (Etap 8) ----------
    // GH (twardość ogólna, Ca2+/Mg2+ jako CaCO3 [ppm]) chelatuje kwasy z kawy
    // i lekko PODNOSI szybkość ekstrakcji. KH (zasadowość/bufor wodorowęglanowy
    // jako CaCO3 [ppm]) neutralizuje kwasy w filiżance — wysoka zasadowość
    // przygasza kwasowość i smak, niska odsłania ostrość. Referencje wg
    // standardu SCA Water Quality (GH ~100 ppm, KH ~40 ppm).
    const GH_REF        = 100;
    const KH_REF        = 40;
    const GH_EXP        = 0.12; // czułość szybkości ekstrakcji na twardość
    const KH_FLAT_SPAN  = 120;  // ppm KH nad referencją do pełnego "przygaszenia"
    const CHANNEL_SIGMA_COEF = 2.0; // skala rozrzutu z kanałowania (patrz extract())

    // Kalibracja odniesienia: 15 g / 250 g / 700 µm / 93°C / V60 / Comandante C40,
    // woda referencyjna (GH 100 / KH 40 ppm) => EY 20,95% · TDS 1,43% · σ 0,87 ·
    // czas kontaktu 165 s. Przy zmianie stałych fizycznych (K0, DIFF_EXP,
    // PERM_EXP, F_FAST, K_FAST, EA, GH_EXP, KH_FLAT_SPAN, CHANNEL_SIGMA_COEF)
    // warto sprawdzić, czy ten punkt odniesienia nadal wychodzi sensownie —
    // nie ma do tego automatycznego testu.

    // ---------- Deterministyczny RNG (mulberry32) ----------
    // Powtarzalne wyniki = gracz może się uczyć, a nie zgadywać.
    function makeRng(seed) {
        let a = seed >>> 0;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const gauss = (x, mu, s) => Math.exp(-((x - mu) * (x - mu)) / (2 * s * s));

    // ---------- 1. Rozkład wielkości cząstek ----------
    // Przemiał modelujemy rozkładem log-normalnym masy.
    // gsd (geometric standard deviation) to JEDYNY parametr odróżniający młynki.
    // Ostrzowy ~2.1 (szeroki, dużo pyłu), żarna wysokiej klasy ~1.25 (wąski).
    function particleBins(d50, gsd, nBins) {
        nBins = nBins || 17;
        const mu = Math.log(d50);
        const s  = Math.log(gsd);
        const zMin = -Z_RANGE, zMax = Z_RANGE;
        const step = (zMax - zMin) / nBins;
        const bins = [];
        let total = 0;
        for (let i = 0; i < nBins; i++) {
            const z = zMin + step * (i + 0.5);
            const w = Math.exp(-0.5 * z * z);
            bins.push({ d: Math.exp(mu + s * z), w: w });
            total += w;
        }
        for (const b of bins) b.w /= total;
        return bins;
    }

    // Udział masowy frakcji poniżej 200 µm — to ona zatyka złoże i przeparza się.
    function finesFraction(bins) {
        return bins.reduce((acc, b) => acc + (b.d < 200 ? b.w : 0), 0);
    }

    // ---------- 2. Temperatura: czynnik Arrheniusa ----------
    function tempFactor(T) {
        const Tk = T + 273.15, T0 = T_REF + 273.15;
        return Math.exp((-EA / R_GAS) * (1 / Tk - 1 / T0));
    }

    // Chelatacja jonów Ca2+/Mg2+ ułatwia rozpuszczanie — twardsza woda = szybsza
    // kinetyka, mnoży się tak samo jak tempFactor. Przy GH=GH_REF factor=1.
    function waterKineticFactor(gh) {
        return Math.pow(Math.max(gh, 1) / GH_REF, GH_EXP);
    }
    // Wysoka zasadowość (KH) buforuje/neutralizuje kwasy w filiżance — przygasza.
    function waterFlatness(kh) {
        return clamp((kh - KH_REF) / KH_FLAT_SPAN, 0, 1);
    }
    // Niska zasadowość nie buforuje nic — kwasowość wybrzmiewa ostrzej.
    function waterBrightness(kh) {
        return clamp((KH_REF - kh) / KH_REF, 0, 1);
    }

    // ---------- 3. Czas kontaktu jako WYNIK, nie wejście ----------
    // Kozeny–Carman: przepuszczalność złoża rośnie z kwadratem średnicy cząstki.
    // Dodatkowo: pył blokuje przepływ, a świeża kawa wydziela CO2 i spowalnia zwilżanie.
    function contactTime(p, eq, coffee, bins) {
        const perm      = Math.pow(p.grind / D_REF, PERM_EXP);
        const fines     = finesFraction(bins);
        const finesClog = 1 + 2.4 * fines;
        const co2       = 1 + 0.45 * Math.exp(-coffee.daysOffRoast / 4);
        const bedDepth  = Math.pow((p.dose / 15) * (33 / eq.dripper.bedArea), 0.6);
        const volume    = p.water / 250;
        const t = T_BASE * bedDepth * volume * finesClog * co2 / (perm * eq.dripper.flowMod);
        return clamp(t, 20, 900);
    }

    // ---------- 4. Ekstrakcja: kinetyka pierwszego rzędu, osobno dla każdej frakcji ----------
    // EY_i(t) = EY_max * (1 - exp(-k_i * t)),  k_i ∝ (1/d)^1.8
    // Wynikiem jest ROZKŁAD ekstrakcji, nie jedna liczba.
    function extract(p, eq, coffee, bins, t, water) {
        const agit = eq.dripper.agitation * (p.agitation || 1.0);
        const tf   = tempFactor(p.temp) * waterKineticFactor(water.gh);
        // Model dwukompartmentowy:
        //  - frakcja SZYBKA (F_FAST): rozpuszczalne z powierzchni i rozbitych komórek,
        //    schodzą niemal natychmiast, niezależnie od średnicy cząstki,
        //  - frakcja WOLNA: dyfuzja z wnętrza ziarna, silnie zależna od średnicy.
        // Dzięki temu nawet gruby przemiał nie daje EY bliskiego zeru — tak jak w realu.
        const fastTerm = F_FAST * (1 - Math.exp(-K_FAST * tf * agit * t));
        let mean = 0;
        const yields = [];
        for (const b of bins) {
            const k    = K0 * Math.pow(D_REF / b.d, DIFF_EXP) * tf * agit;
            const frac = fastTerm + (1 - F_FAST) * (1 - Math.exp(-k * t));
            const ey   = coffee.eyMax * frac;
            yields.push(ey);
            mean += ey * b.w;
        }
        let varianceGrind = 0;
        for (let i = 0; i < bins.length; i++) {
            varianceGrind += bins[i].w * Math.pow(yields[i] - mean, 2);
        }
        // Kanałowanie (nierówna dystrybucja wody po złożu) i rozrzut z przemiału
        // to DWA NIEZALEŻNE źródła nierówności — łączy się je przez sumę wariancji,
        // nie przez dzielenie jednego przez drugie (dzielenie dawało fizyczny
        // nonsens: idealny przemiał + fatalna technika wychodziły jako "równe",
        // a bardzo dobra geometria zaparzacza zjadała wariancję przemiału poniżej
        // fizycznego dna). agitation i evenness to DWIE NIEZALEŻNE osi techniki
        // nalewania: gwałtowny, chaotyczny strumień = wysoka agitacja, niska
        // równomierność. channelFactor >= 1 (referencyjny V60 + dobra technika,
        // albo lepsza geometria typu Kalita) => zero dodatkowego rozrzutu;
        // kanałowanie dokłada wariancję TYLKO gdy technika/geometria są gorsze
        // od referencji.
        const channelFactor  = eq.dripper.evenness * (p.evenness || 1.0);
        const channelDeficit = Math.max(0, 1 - channelFactor);
        const sigmaChannel   = CHANNEL_SIGMA_COEF * channelDeficit;
        const sigma = Math.sqrt(varianceGrind + sigmaChannel * sigmaChannel);
        return { mean: mean, sigma: sigma };
    }

    // ---------- 5. Model sensoryczny: 7 osi karty WBrC ----------
    function sensory(ey, tds, sigma, coffee, p, water) {
        const sweet = gauss(ey, 20.0, 2.4);
        const sour  = clamp((19.0 - ey) / 4.5, 0, 1);
        const bitter= clamp((ey - 21.0) / 4.5, 0, 1);
        const astr  = clamp((sigma - 0.62) / 1.70, 0, 1); // próg: poniżej σ 0,62 złoże jest sensorycznie jednorodne
        const bodyI = clamp((tds - 0.95) / 0.55, 0, 1);

        const q     = coffee.quality;
        const fresh = clamp(0.55 + 0.45 * gauss(coffee.daysOffRoast, 12, 9), 0, 1);
        const tempQ = clamp(0.6 + 0.4 * gauss(p.temp, 93.5, 4.0), 0, 1);
        const flat   = waterFlatness(water.kh);
        const bright = waterBrightness(water.kh);

        const s = {
            aroma:      9 * q * fresh * tempQ * (1 - 0.2 * astr),
            flavor:     9 * q * (0.22 + 0.78 * sweet) * (1 - 0.45 * astr) * (1 - 0.25 * bitter) * (1 - 0.15 * flat),
            aftertaste: 9 * q * Math.pow(sweet, 1.1) * (1 - 0.5 * bitter) * (1 - 0.5 * astr) * (0.4 + 0.6 * bodyI),
            acidity:    9 * q * coffee.acidity * (1 - 0.7 * sour) * (0.35 + 0.65 * gauss(ey, 19.6, 3.0)) * (1 - 0.3 * bitter) * (1 - 0.55 * flat + 0.2 * bright),
            body:       9 * coffee.body * (0.3 + 0.7 * gauss(tds, 1.33, 0.25)),
            balance:    9 * q * (1 - 0.6 * astr) * gauss(ey, 20.0, 3.0) * (1 - 0.35 * Math.abs(sour - bitter))
        };
        const avg = (s.aroma + s.flavor + s.aftertaste + s.acidity + s.body + s.balance) / 6;
        s.overall = avg * (0.85 + 0.15 * q);

        for (const key in s) s[key] = Math.round(clamp(s[key], 0, 9) * 4) / 4;
        const total = Object.values(s).reduce((a, b) => a + b, 0);
        return {
            scores: s,
            total: Math.round(total * 4) / 4,
            pct: total / 63,
            intensities: { sweet, sour, bitter, astr, bodyI }
        };
    }

    // ---------- 6. Opis słowny ----------
    function describe(ey, tds, sigma, i) {
        const parts = [];
        if (sigma > 2.0)      parts.push('Filiżanka jest rozdarta: jednocześnie kwaśna i ściągająca — to podpis nierównego przemiału, a nie złego nastawu.');
        else if (sigma > 1.25) parts.push('Wyczuwalna lekka ściągalność na finiszu — część pyłu przeekstrahowała się przed resztą złoża.');

        if (ey < 17.5)       parts.push('Wyraźna niedoekstrakcja: kwas warzywny, trawiastość, brak słodyczy, krótki finisz.');
        else if (ey > 22.5)  parts.push('Nadekstrakcja: ciężkie fenole, gorycz, popiołowy posmak i suchość podniebienia.');
        else if (i.sweet > 0.75) parts.push('Czyste okno ekstrakcji — słodycz niesie kwasowość, finisz długi i syropowaty.');
        else                 parts.push('Poprawna ekstrakcja, ale bez szczytowej słodyczy — napar jest technicznie czysty i nieco płaski.');

        if (tds < 1.12)      parts.push('Stężenie zbyt niskie: tekstura wodnista, smak rozmyty.');
        else if (tds > 1.38) parts.push('Stężenie bardzo wysokie: napar gęsty i nieczytelny, nuty się zlewają.');
        return parts.join(' ');
    }

    // ---------- API ----------
    // brew({dose, water, grind, temp, technique}, {grinder, dripper, kettle}, coffee, seed, water?)
    // Piąty argument (chemia wody: {gh, kh} jako ppm CaCO3) jest opcjonalny —
    // bez niego używana jest referencja SCA (GH_REF/KH_REF), więc wywołania bez
    // tego argumentu (cała dzisiejsza gra) mają zero zmiany zachowania.
    function brew(params, eq, coffee, seed, water) {
        const rng = makeRng(seed >>> 0);
        const w = {
            gh: (water && water.gh !== undefined) ? water.gh : GH_REF,
            kh: (water && water.kh !== undefined) ? water.kh : KH_REF
        };

        // Czajnik bez kontroli temperatury = dryf temperatury (deterministyczny per seed).
        const drift = (rng() - 0.5) * 2 * eq.kettle.tempDrift;
        const realTemp = clamp(params.temp + drift, 75, 100);

        const p = {
            dose: params.dose,
            water: params.water,
            grind: params.grind,
            temp: realTemp,
            // Bez mini-gry technika jest pochodną czajnika (tryb auto-parzenia).
            agitation: params.agitation !== undefined ? params.agitation : eq.kettle.pourQuality,
            evenness:  params.evenness  !== undefined ? params.evenness  : eq.kettle.pourQuality
        };

        const bins  = particleBins(p.grind, eq.grinder.gsd);
        const time  = contactTime(p, eq, coffee, bins);
        const ex    = extract(p, eq, coffee, bins, time, w);

        const brewMass = Math.max(1, p.water - p.dose * LRR * eq.dripper.retention);
        const tds = (ex.mean / 100) * (p.dose / brewMass) * 100;

        const sens = sensory(ex.mean, tds, ex.sigma, coffee, p, w);

        return {
            ey: +ex.mean.toFixed(2),
            sigma: +ex.sigma.toFixed(2),
            tds: +tds.toFixed(3),
            time: Math.round(time),
            realTemp: +realTemp.toFixed(1),
            tempDrift: +drift.toFixed(1),
            brewMass: Math.round(brewMass),
            ratio: +(p.water / p.dose).toFixed(1),
            fines: +(finesFraction(bins) * 100).toFixed(1),
            agitation: +p.agitation.toFixed(3),
            evenness: +p.evenness.toFixed(3),
            water: w,
            sensory: sens,
            verdict: describe(ex.mean, tds, ex.sigma, sens.intensities)
        };
    }

    return { brew, particleBins, contactTime, tempFactor, makeRng, LRR, constants: { D_REF, T_REF, GH_REF, KH_REF } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BrewEngine;
