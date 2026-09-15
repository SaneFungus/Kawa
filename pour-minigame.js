// =============================================================================
// pour-minigame.js — PourMinigame
// Mini-gra nalewania. Produkuje trzy wejścia dla silnika:
//   evenness  — jak równo rozłożyła się woda (dzieli σ)
//   agitation — ile energii trafiło w złoże (mnoży k ekstrakcji)
//   water     — ile gramów FAKTYCZNIE nalano (nadpisuje suwak)
// Tempo osiadania wody liczone z tej samej przepuszczalności, co czas kontaktu
// w BrewEngine — drobniejszy przemiał realnie zalewa złoże.
// =============================================================================
const PourMinigame = (function () {

    const RINGS = 3, SECTORS = 12, NCELLS = RINGS * SECTORS;
    const RING_R = [0, 0.45, 0.75, 1.0];
    const TIME_SCALE  = 3.2;   // 1 s realny = 3,2 s czasu parzenia
    const FLOOD_LEVEL = 85;    // [g] wody stojącej nad złożem = zalanie
    const MAX_LEVEL   = 120;
    const TIME_LIMIT  = 420;   // [s czasu parzenia]
    const KETTLE_MARGIN = 1.20; // czajnik mieści 120% celu — przelanie jest możliwe, ale skończone
    const CV = 360;

    // Idealny udział masowy wody na komórkę = jej udział w powierzchni złoża
    const IDEAL = (function () {
        const arr = [];
        for (let r = 0; r < RINGS; r++) {
            const a = (RING_R[r + 1] * RING_R[r + 1] - RING_R[r] * RING_R[r]) / SECTORS;
            for (let s = 0; s < SECTORS; s++) arr.push(a);
        }
        return arr;
    })();

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    let S = null, cv = null, ctx = null, raf = null, done = null;

    // ---------------- Cykl życia ----------------
    function open(cfg, callback) {
        done = callback;
        S = {
            cfg: cfg,
            phase: 'BLOOM',
            tBrew: 0,
            poured: 0, absorbed: 0, level: 0, wallWater: 0, floodTime: 0,
            cells: new Array(NCELLS).fill(0),
            bloomPoured: 0, bloomCoverage: 0, bloomBroken: false, bloomRest: 30, idle: 0,
            pouring: false, px: CV / 2, py: CV / 2, lastPx: null, lastPy: null,
            speedAcc: 0, speedSamples: 0,
            targetWater: cfg.water,
            kettleCap: cfg.water * KETTLE_MARGIN,
            bloomSkipped: false,
            bloomTarget: +(cfg.dose * 2.5).toFixed(0),
            absorbTarget: cfg.dose * 2.0,
            pourRate: 5.5 * cfg.kettle.pourQuality,
            drainBase: 1.35 * Math.pow(cfg.grind / 700, 1.3) * cfg.dripper.flowMod,
            cx: CV / 2, cy: CV / 2, R: CV * 0.42,
            lastTs: 0, result: null
        };
        document.getElementById('pour-overlay').classList.remove('hidden');
        document.getElementById('pour-summary').classList.add('hidden');
        document.getElementById('pour-stage').classList.remove('hidden');
        document.getElementById('pour-howto').classList.remove('hidden');
        cv = document.getElementById('pour-canvas');
        cv.width = CV; cv.height = CV;
        ctx = cv.getContext('2d');
        bindInput();
        raf = requestAnimationFrame(function (t) { S.lastTs = t; loop(t); });
    }

    function close() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        document.getElementById('pour-overlay').classList.add('hidden');
    }

    function bindInput() {
        const down = e => {
            e.preventDefault();
            hideHowto();
            S.pouring = true;
            move(e);
        };
        const up   = e => { S.pouring = false; S.lastPx = null; };
        const move = e => {
            const t = e.touches ? e.touches[0] : e;
            const r = cv.getBoundingClientRect();
            S.px = (t.clientX - r.left) * cv.width / r.width;
            S.py = (t.clientY - r.top) * cv.height / r.height;
        };
        cv.onpointerdown = down;
        cv.onpointermove = e => { if (S.pouring) { e.preventDefault(); move(e); } };
        cv.onpointerup = up;
        cv.onpointerleave = up;
        cv.onpointercancel = up;
    }

    // Instrukcja obsługi jest nakładką NAD canvasem, nie wierszem w kolumnie —
    // dzięki temu znika po pierwszym dotknięciu złoża, nie przesuwając układu
    // w trakcie gry czasu rzeczywistego.
    function hideHowto() {
        const h = document.getElementById('pour-howto');
        if (h) h.classList.add('hidden');
    }

    // ---------------- Symulacja ----------------
    function deposit(g, x, y) {
        const dx = x - S.cx, dy = y - S.cy;
        const r = Math.hypot(dx, dy) / S.R;
        if (r > 0.97) { S.wallWater += g; return; }   // woda po ściance filtra = bypass złoża
        const ang = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
        const sec = Math.floor(ang / (Math.PI * 2 / SECTORS)) % SECTORS;
        let ring = RINGS - 1;
        for (let i = 0; i < RINGS; i++) if (r >= RING_R[i] && r < RING_R[i + 1]) { ring = i; break; }
        // rozmycie strumienia — realny strumień nie trafia w punkt
        addCell(ring, sec, g * 0.62);
        addCell(ring, sec + 1, g * 0.10); addCell(ring, sec - 1, g * 0.10);
        addCell(ring + 1, sec, g * 0.09); addCell(ring - 1, sec, g * 0.09);
    }
    function addCell(ring, sec, g) {
        ring = clamp(ring, 0, RINGS - 1);
        sec = ((sec % SECTORS) + SECTORS) % SECTORS;
        S.cells[ring * SECTORS + sec] += g;
    }

    function step(dt, dtReal) {
        S.tBrew += dt;

        if (S.pouring && S.poured >= S.kettleCap) S.pouring = false;   // czajnik pusty

        if (S.pouring && S.phase !== 'DONE') {
            const g = Math.min(S.pourRate * dt, S.kettleCap - S.poured);
            deposit(g, S.px, S.py);
            S.poured += g;
            if (S.phase === 'BLOOM') {
                S.bloomPoured += g;
                // Nie da się nazywać bloomem lania bez końca — po 1,8× dozy blooma faza się urywa.
                if (S.bloomPoured > S.bloomTarget * 1.8) {
                    measureBloomCoverage();
                    S.bloomSkipped = true;
                    S.phase = 'POURS';
                }
            }
            if (S.phase === 'BLOOM_REST') { S.bloomBroken = true; S.phase = 'POURS'; }
            // absorpcja: dopóki fusy nie nasiąkną, woda nie tworzy warstwy nad złożem
            if (S.absorbed < S.absorbTarget) S.absorbed += g;
            else S.level += g;
            if (S.lastPx !== null) {
                // Prędkość mierzymy w czasie RZECZYWISTYM (ruch ręki), nie w czasie parzenia.
                const d = Math.hypot(S.px - S.lastPx, S.py - S.lastPy) / S.R;
                S.speedAcc += d / Math.max(dtReal, 0.001);
                S.speedSamples++;
            }
            S.lastPx = S.px; S.lastPy = S.py;
            S.idle = 0;
        } else {
            S.idle += dt;
            S.lastPx = null;
        }

        // drenaż zależny od słupa wody (im wyższy, tym szybciej — prawo Darcy'ego)
        if (S.level > 0) {
            const drain = S.drainBase * (0.30 + S.level / 45) * dt;
            S.level = Math.max(0, S.level - drain);
        }
        if (S.level > FLOOD_LEVEL) S.floodTime += dt;

        // przejścia faz
        if (S.phase === 'BLOOM' && S.idle > 2.0 && S.bloomPoured > S.bloomTarget * 0.3) {
            measureBloomCoverage();
            S.phase = 'BLOOM_REST';
        }
        if (S.phase === 'BLOOM_REST') {
            S.bloomRest -= dt;
            if (S.bloomRest <= 0) S.phase = 'POURS';
        }
        if (S.phase === 'POURS' && S.poured >= S.targetWater * 0.97 && S.level < 10 && S.idle > 2.0) finish();
        if (S.tBrew > TIME_LIMIT) finish();
    }

    function measureBloomCoverage() {
        const dens = spread(S.cells, 2);
        let mean = 0;
        for (let i = 0; i < NCELLS; i++) mean += IDEAL[i] * dens[i];
        mean = mean || 1;
        let wet = 0;
        for (let i = 0; i < NCELLS; i++) if (dens[i] >= 0.45 * mean) wet++;
        S.bloomCoverage = wet / NCELLS;
    }

    // ---------------- Ocena ----------------

    // Boczny rozpływ: woda nalana w punkt nie zostaje w swojej kolumnie — perkoluje
    // na boki przez złoże. Bez tego kroku spirala byłaby karana za coś,
    // co w realnym zaparzaczu samo się wyrównuje.
    function spread(cells, passes) {
        let d = cells.map((v, i) => v / IDEAL[i]);   // gęstość: woda na jednostkę powierzchni
        for (let pass = 0; pass < passes; pass++) {
            const out = d.slice();
            for (let r = 0; r < RINGS; r++) {
                for (let sc = 0; sc < SECTORS; sc++) {
                    const i = r * SECTORS + sc;
                    const nb = [
                        d[r * SECTORS + (sc + 1) % SECTORS],
                        d[r * SECTORS + (sc - 1 + SECTORS) % SECTORS],
                        d[Math.min(RINGS - 1, r + 1) * SECTORS + sc],
                        d[Math.max(0, r - 1) * SECTORS + sc]
                    ];
                    out[i] = 0.58 * d[i] + 0.42 * (nb[0] + nb[1] + nb[2] + nb[3]) / 4;
                }
            }
            d = out;
        }
        return d;
    }

    function evaluate() {
        // Ważony powierzchnią współczynnik zmienności gęstości wody po rozpływie.
        const dens = spread(S.cells, 3);
        let mean = 0;
        for (let i = 0; i < NCELLS; i++) mean += IDEAL[i] * dens[i];
        mean = mean || 1;
        let v = 0;
        for (let i = 0; i < NCELLS; i++) v += IDEAL[i] * Math.pow(dens[i] - mean, 2);
        const cvv = Math.sqrt(v) / mean;
        let even = clamp(1 - 1.15 * cvv, 0, 1);

        const bedWater = S.cells.reduce((a, b) => a + b, 0);
        const wallFrac = S.wallWater / (bedWater + S.wallWater || 1);
        even *= (1 - 0.60 * wallFrac);

        const floodFrac = clamp(S.floodTime / 90, 0, 1);
        even *= (1 - 0.35 * floodFrac);

        const bloomRatio = S.bloomPoured / S.bloomTarget;
        const bloomAmt = clamp(1 - Math.abs(bloomRatio - 1) / 0.6, 0, 1);
        let bloomQ = (S.bloomBroken ? 0.35 : 1.0) * (0.5 * bloomAmt + 0.5 * S.bloomCoverage);
        if (S.bloomSkipped || S.phase === 'BLOOM') bloomQ = 0.05;   // brak kontrolowanego odgazowania
        even *= (0.80 + 0.20 * bloomQ);

        const meanSpeed = S.speedSamples ? S.speedAcc / S.speedSamples : 0;
        const speedNorm = clamp(meanSpeed / 3.5, 0, 1);   // 3,5 promienia złoża na sekundę = już szarpanie

        // Turbulencja: szybki, szarpany strumień rozbija złoże i drąży kanały,
        // nawet jeśli UŚREDNIONE pokrycie wychodzi równo.
        even *= (1 - 0.30 * Math.pow(speedNorm, 1.5));

        return {
            evenness:  +(0.75 + 0.50 * even).toFixed(3),
            agitation: +clamp(0.86 + 0.26 * speedNorm + 0.10 * floodFrac, 0.85, 1.22).toFixed(3),
            water:     +S.poured.toFixed(1),
            cells:     S.cells.slice(),
            detail: {
                evenScore: even, cv: cvv, wallFrac: wallFrac, floodFrac: floodFrac,
                bloomQ: bloomQ, bloomRatio: bloomRatio, bloomCoverage: S.bloomCoverage,
                bloomBroken: S.bloomBroken, bloomSkipped: S.bloomSkipped,
                speedNorm: speedNorm, time: Math.round(S.tBrew)
            }
        };
    }

    function finish() {
        if (S.phase === 'DONE') return;
        if (S.bloomCoverage === 0) measureBloomCoverage();
        S.phase = 'DONE';
        S.result = evaluate();
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        showSummary(S.result);
    }

    // ---------------- Rysowanie ----------------
    function cellColor(v, ideal) {
        const ratio = clamp(v / (ideal * Math.max(S.poured, 1)), 0, 2.2);
        const dry = [138, 106, 74], wet = [48, 33, 22];
        const t = clamp(ratio / 1.2, 0, 1);
        const c = dry.map((d, i) => Math.round(d + (wet[i] - d) * t));
        return 'rgb(' + c.join(',') + ')';
    }

    let HEAT_DENS = null;
    function drawBed(context, cells, mode) {
        const cx = S.cx, cy = S.cy, R = S.R;
        if (mode === 'heat') {
            const d = spread(cells, 3);
            let mean = 0;
            for (let i = 0; i < NCELLS; i++) mean += IDEAL[i] * d[i];
            HEAT_DENS = d.map(v => v / (mean || 1));
        }
        for (let r = 0; r < RINGS; r++) {
            for (let s = 0; s < SECTORS; s++) {
                const i = r * SECTORS + s;
                const a0 = s * (Math.PI * 2 / SECTORS), a1 = a0 + Math.PI * 2 / SECTORS;
                context.beginPath();
                context.arc(cx, cy, R * RING_R[r + 1], a0, a1);
                context.arc(cx, cy, R * RING_R[r], a1, a0, true);
                context.closePath();
                if (mode === 'heat') {
                    const dev = HEAT_DENS[i];   // 1 = idealnie (po uwzględnieniu rozpływu)
                    let col;
                    if (dev < 1) {
                        const t = clamp(1 - dev, 0, 1);
                        col = 'rgb(' + Math.round(40 + 20 * t) + ',' + Math.round(90 + 40 * (1 - t)) + ',' + Math.round(150 + 90 * t) + ')';
                    } else {
                        const t = clamp((dev - 1) / 1.2, 0, 1);
                        col = 'rgb(' + Math.round(120 + 130 * t) + ',' + Math.round(110 - 60 * t) + ',' + Math.round(70 - 40 * t) + ')';
                    }
                    context.fillStyle = col;
                } else {
                    context.fillStyle = cellColor(cells[i], IDEAL[i]);
                }
                context.fill();
                context.strokeStyle = 'rgba(0,0,0,0.25)';
                context.lineWidth = 1;
                context.stroke();
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, CV, CV);
        const cx = S.cx, cy = S.cy, R = S.R;

        // obudowa zaparzacza
        ctx.beginPath(); ctx.arc(cx, cy, R * 1.11, 0, Math.PI * 2);
        ctx.fillStyle = '#1c1917'; ctx.fill();
        ctx.strokeStyle = '#57534e'; ctx.lineWidth = 3; ctx.stroke();

        drawBed(ctx, S.cells, 'wet');

        // warstwa wody
        if (S.level > 1) {
            const a = clamp(S.level / MAX_LEVEL, 0, 1);
            ctx.beginPath(); ctx.arc(cx, cy, R * 0.99, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(90,150,210,' + (0.15 + 0.4 * a).toFixed(2) + ')';
            ctx.fill();
        }
        if (S.level > FLOOD_LEVEL) {
            ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(239,68,68,' + (0.4 + 0.4 * Math.sin(S.tBrew * 6)).toFixed(2) + ')';
            ctx.lineWidth = 5; ctx.stroke();
        }

        // strumień i marker
        if (S.pouring && S.phase !== 'DONE') {
            const grd = ctx.createLinearGradient(S.px, 0, S.px, S.py);
            grd.addColorStop(0, 'rgba(190,225,255,0.15)');
            grd.addColorStop(1, 'rgba(190,225,255,0.85)');
            ctx.strokeStyle = grd; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(S.px, 0); ctx.lineTo(S.px, S.py); ctx.stroke();
            ctx.beginPath();
            ctx.arc(S.px, S.py, 7 + 3 * Math.sin(S.tBrew * 14), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(220,240,255,0.75)'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(S.px, S.py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; ctx.fill();

        updateHud();
    }

    function updateHud() {
        const P = {
            BLOOM:      ['Blooming', 'Zwilż CAŁE złoże, wlej ok. ' + S.bloomTarget + ' g. Puść, gdy skończysz.', 'text-amber-400'],
            BLOOM_REST: ['Odgazowanie', 'Czekaj — CO2 uchodzi ze złoża. Nie lej teraz.', 'text-sky-400'],
            POURS:      ['Nalewanie główne', 'Spirala od środka na zewnątrz. Nie zalej złoża, nie lej po ściance.', 'text-emerald-400'],
            DONE:       ['Koniec', '', 'text-stone-400']
        }[S.phase];
        document.getElementById('pour-phase').textContent = P[0];
        document.getElementById('pour-phase').className = 'font-bold text-sm ' + P[2];
        document.getElementById('pour-hint').textContent = P[1];

        const wEl = document.getElementById('pour-water');
        wEl.textContent = Math.round(S.poured) + ' / ' + S.targetWater + ' g';
        wEl.className = 'mono font-bold ' + (S.poured > S.targetWater * 1.02 ? 'text-red-400' : 'text-stone-200');
        document.getElementById('pour-water-bar').style.width = clamp(S.poured / S.targetWater * 100, 0, 100) + '%';
        document.getElementById('pour-time').textContent = Math.floor(S.tBrew / 60) + ':' + String(Math.floor(S.tBrew % 60)).padStart(2, '0');

        // Etap M6: pasek poziomu zalania jest teraz poziomy (pod polem gry),
        // więc sterujemy szerokością, nie wysokością.
        const lvl = clamp(S.level / MAX_LEVEL * 100, 0, 100);
        const bar = document.getElementById('pour-level-bar');
        bar.style.width = lvl + '%';
        bar.className = 'absolute left-0 top-0 h-full transition-all ' +
            (S.level > FLOOD_LEVEL ? 'bg-red-500' : S.level > FLOOD_LEVEL * 0.7 ? 'bg-amber-500' : 'bg-sky-500');

        const rest = document.getElementById('pour-rest');
        if (S.phase === 'BLOOM_REST') {
            rest.classList.remove('hidden');
            rest.textContent = 'Odgazowanie: ' + Math.ceil(S.bloomRest) + ' s';
        } else rest.classList.add('hidden');
    }

    function loop(ts) {
        const dtReal = Math.min(0.05, (ts - S.lastTs) / 1000);
        S.lastTs = ts;
        step(dtReal * TIME_SCALE, dtReal);
        if (S.phase !== 'DONE') { draw(); raf = requestAnimationFrame(loop); }
    }

    // ---------------- Podsumowanie ----------------
    function showSummary(res) {
        document.getElementById('pour-stage').classList.add('hidden');
        const box = document.getElementById('pour-summary');
        box.classList.remove('hidden');

        const hc = document.getElementById('pour-heatmap');
        hc.width = CV; hc.height = CV;   // rozdzielczość bitmapy; rozmiar na ekranie robi CSS
        const hctx = hc.getContext('2d');
        hctx.clearRect(0, 0, CV, CV);
        hctx.beginPath(); hctx.arc(S.cx, S.cy, S.R * 1.11, 0, Math.PI * 2);
        hctx.fillStyle = '#1c1917'; hctx.fill();
        drawBed(hctx, res.cells, 'heat');

        const d = res.detail;
        const row = (label, val, good) =>
            '<div class="flex justify-between text-xs py-1 border-b border-stone-800">' +
            '<span class="text-stone-400">' + label + '</span>' +
            '<span class="mono font-bold ' + (good ? 'text-emerald-400' : 'text-amber-400') + '">' + val + '</span></div>';

        document.getElementById('pour-stats').innerHTML =
            row('Równomierność rozlewu', (d.evenScore * 100).toFixed(0) + '%', d.evenScore > 0.7) +
            row('Woda po ściance', (d.wallFrac * 100).toFixed(1) + '%', d.wallFrac < 0.05) +
            row('Czas zalania złoża', (d.floodFrac * 60).toFixed(0) + ' s', d.floodFrac < 0.1) +
            row('Pokrycie przy bloomie', (d.bloomCoverage * 100).toFixed(0) + '%', d.bloomCoverage > 0.8) +
            row('Doza blooma', (d.bloomRatio * 100).toFixed(0) + '% celu', Math.abs(d.bloomRatio - 1) < 0.35) +
            (d.bloomBroken ? row('Przerwane odgazowanie', 'TAK', false) : '') +
            (d.bloomSkipped ? row('Bloom pominięty', 'TAK', false) : '') +
            row('Turbulencja strumienia', (d.speedNorm * 100).toFixed(0) + '%', d.speedNorm < 0.6) +
            row('Nalano łącznie', res.water.toFixed(0) + ' g', Math.abs(res.water - S.targetWater) < 12) +
            '<div class="mt-3 pt-3 border-t border-stone-700 grid grid-cols-2 gap-3">' +
            '<div class="bg-black/40 rounded p-2 text-center"><span class="block text-[10px] uppercase text-stone-500">Równomierność</span>' +
            '<span class="mono text-xl font-bold text-amber-400">×' + res.evenness.toFixed(2) + '</span>' +
            '<span class="block text-[10px] text-stone-500">dzieli σ</span></div>' +
            '<div class="bg-black/40 rounded p-2 text-center"><span class="block text-[10px] uppercase text-stone-500">Agitacja</span>' +
            '<span class="mono text-xl font-bold text-sky-400">×' + res.agitation.toFixed(2) + '</span>' +
            '<span class="block text-[10px] text-stone-500">mnoży ekstrakcję</span></div></div>';
    }

    function confirm() {
        const r = S.result;
        close();
        if (done) done(r);
    }

    function abort() {
        if (raf) cancelAnimationFrame(raf);
        raf = null;
        close();
    }

    return { open: open, finish: finish, confirm: confirm, abort: abort };
})();
