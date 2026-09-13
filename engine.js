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

    // Kalibracja odniesienia: 15 g / 250 g / 700 µm / 93°C / V60 / Comandante C40
    // => EY 20,0% · TDS 1,36% · σ 0,83 · czas kontaktu 169 s

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
    function extract(p, eq, coffee, bins, t) {
        const agit = eq.dripper.agitation * (p.agitation || 1.0);
        const tf   = tempFactor(p.temp);
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
        let variance = 0;
        for (let i = 0; i < bins.length; i++) {
            variance += bins[i].w * Math.pow(yields[i] - mean, 2);
        }
        // Nierównomierność złoża (kanałowanie) dokłada rozrzut, nie zmieniając średniej.
        // agitation i evenness to DWIE NIEZALEŻNE osi techniki nalewania:
        // gwałtowny, chaotyczny strumień = wysoka agitacja, niska równomierność.
        const channel = eq.dripper.evenness * (p.evenness || 1.0);
        const sigma = Math.sqrt(variance) / channel;
        return { mean: mean, sigma: sigma };
    }

    // ---------- 5. Model sensoryczny: 7 osi karty WBrC ----------
    function sensory(ey, tds, sigma, coffee, p) {
        const sweet = gauss(ey, 20.0, 2.4);
        const sour  = clamp((19.0 - ey) / 4.5, 0, 1);
        const bitter= clamp((ey - 21.0) / 4.5, 0, 1);
        const astr  = clamp((sigma - 0.62) / 1.70, 0, 1); // próg: poniżej σ 0,62 złoże jest sensorycznie jednorodne
        const bodyI = clamp((tds - 0.95) / 0.55, 0, 1);

        const q     = coffee.quality;
        const fresh = clamp(0.55 + 0.45 * gauss(coffee.daysOffRoast, 12, 9), 0, 1);
        const tempQ = clamp(0.6 + 0.4 * gauss(p.temp, 93.5, 4.0), 0, 1);

        const s = {
            aroma:      9 * q * fresh * tempQ * (1 - 0.2 * astr),
            flavor:     9 * q * (0.22 + 0.78 * sweet) * (1 - 0.45 * astr) * (1 - 0.25 * bitter),
            aftertaste: 9 * q * Math.pow(sweet, 1.1) * (1 - 0.5 * bitter) * (1 - 0.5 * astr) * (0.4 + 0.6 * bodyI),
            acidity:    9 * q * coffee.acidity * (1 - 0.7 * sour) * (0.35 + 0.65 * gauss(ey, 19.6, 3.0)) * (1 - 0.3 * bitter),
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
    // brew({dose, water, grind, temp, technique}, {grinder, dripper, kettle}, coffee, seed)
    function brew(params, eq, coffee, seed) {
        const rng = makeRng(seed >>> 0);

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
        const ex    = extract(p, eq, coffee, bins, time);

        const brewMass = Math.max(1, p.water - p.dose * LRR * eq.dripper.retention);
        const tds = (ex.mean / 100) * (p.dose / brewMass) * 100;

        const sens = sensory(ex.mean, tds, ex.sigma, coffee, p);

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
            sensory: sens,
            verdict: describe(ex.mean, tds, ex.sigma, sens.intensities)
        };
    }

    return { brew, particleBins, contactTime, tempFactor, makeRng, LRR, constants: { D_REF, T_REF } };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BrewEngine;
