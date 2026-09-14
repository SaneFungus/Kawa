// =============================================================================
// chart.js — BrewingControlChart
// Renderer SVG. Zależy tylko od danych, nie od stanu gry.
// =============================================================================
const BrewingControlChart = (function () {

    const EY_MIN = 14, EY_MAX = 26;
    const TDS_MIN = 0.80, TDS_MAX = 1.80;
    const W = 520, H = 400;
    const PAD = { l: 52, r: 16, t: 18, b: 44 };
    const PW = W - PAD.l - PAD.r;
    const PH = H - PAD.t - PAD.b;

    const x = ey  => PAD.l + ((ey - EY_MIN) / (EY_MAX - EY_MIN)) * PW;
    const y = tds => PAD.t + ((TDS_MAX - tds) / (TDS_MAX - TDS_MIN)) * PH;

    // TDS = EY / (ratio - LRR)  — linie stałego brew ratio są proste przez początek układu.
    function ratioLine(ratio) {
        const denom = ratio - BrewEngine.LRR;
        const pts = [];
        for (const ey of [EY_MIN, EY_MAX]) pts.push([ey, ey / denom]);
        return pts;
    }

    function render(containerId, data) {
        const el = document.getElementById(containerId);
        if (!el) return;
        const history = data.history || [];
        const current = data.current || null;
        const liveRatio = data.liveRatio || null;

        let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full h-auto" style="max-height:380px">';

        // tło
        s += '<rect x="' + PAD.l + '" y="' + PAD.t + '" width="' + PW + '" height="' + PH + '" fill="#0c0a09" stroke="#292524"/>';

        // strefy: za słabe / za mocne / niedo- / nad-
        s += '<rect x="' + x(EY_MIN) + '" y="' + PAD.t + '" width="' + (x(18) - x(EY_MIN)) + '" height="' + PH + '" fill="#3b82f6" opacity="0.07"/>';
        s += '<rect x="' + x(22) + '" y="' + PAD.t + '" width="' + (x(EY_MAX) - x(22)) + '" height="' + PH + '" fill="#ef4444" opacity="0.07"/>';

        // okno akceptowalne (TDS do 1.55)
        s += '<rect x="' + x(18) + '" y="' + y(1.55) + '" width="' + (x(22) - x(18)) + '" height="' + (y(1.15) - y(1.55)) + '" fill="#22c55e" opacity="0.08" stroke="#22c55e" stroke-opacity="0.3" stroke-dasharray="3 3"/>';
        // Golden Cup
        s += '<rect x="' + x(18) + '" y="' + y(1.35) + '" width="' + (x(22) - x(18)) + '" height="' + (y(1.15) - y(1.35)) + '" fill="#22c55e" opacity="0.16" stroke="#22c55e" stroke-opacity="0.7"/>';
        s += '<text x="' + ((x(18) + x(22)) / 2) + '" y="' + (y(1.25) + 4) + '" fill="#4ade80" font-size="11" text-anchor="middle" font-weight="700" opacity="0.9">GOLDEN CUP</text>';

        // linie brew ratio
        for (const r of [12, 14, 16, 18, 20, 24]) {
            const p = ratioLine(r);
            const x1 = x(p[0][0]), y1 = y(p[0][1]), x2 = x(p[1][0]), y2 = y(p[1][1]);
            s += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#57534e" stroke-width="1" stroke-dasharray="2 4"/>';
            const ly = y(EY_MAX / (r - BrewEngine.LRR));
            if (ly > PAD.t + 8 && ly < PAD.t + PH - 4) {
                s += '<text x="' + (PAD.l + PW - 4) + '" y="' + (ly - 3) + '" fill="#78716c" font-size="9" text-anchor="end">1:' + r + '</text>';
            }
        }

        // linia ratio aktualnego nastawu
        if (liveRatio) {
            const p = ratioLine(liveRatio);
            s += '<line x1="' + x(p[0][0]) + '" y1="' + y(p[0][1]) + '" x2="' + x(p[1][0]) + '" y2="' + y(p[1][1]) + '" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="6 3" opacity="0.8"/>';
        }

        // siatka i osie
        for (let ey = EY_MIN; ey <= EY_MAX; ey += 2) {
            s += '<line x1="' + x(ey) + '" y1="' + PAD.t + '" x2="' + x(ey) + '" y2="' + (PAD.t + PH) + '" stroke="#292524" stroke-width="0.5"/>';
            s += '<text x="' + x(ey) + '" y="' + (PAD.t + PH + 16) + '" fill="#a8a29e" font-size="10" text-anchor="middle">' + ey + '</text>';
        }
        for (let t = TDS_MIN; t <= TDS_MAX + 0.001; t += 0.2) {
            s += '<line x1="' + PAD.l + '" y1="' + y(t) + '" x2="' + (PAD.l + PW) + '" y2="' + y(t) + '" stroke="#292524" stroke-width="0.5"/>';
            s += '<text x="' + (PAD.l - 8) + '" y="' + (y(t) + 3) + '" fill="#a8a29e" font-size="10" text-anchor="end">' + t.toFixed(2) + '</text>';
        }
        s += '<text x="' + (PAD.l + PW / 2) + '" y="' + (H - 8) + '" fill="#d6d3d1" font-size="11" text-anchor="middle" font-weight="600">Extraction Yield [%]</text>';
        s += '<text x="14" y="' + (PAD.t + PH / 2) + '" fill="#d6d3d1" font-size="11" text-anchor="middle" font-weight="600" transform="rotate(-90 14 ' + (PAD.t + PH / 2) + ')">TDS [%]</text>';

        // etykiety stref
        s += '<text x="' + (x(15.9)) + '" y="' + (PAD.t + 16) + '" fill="#60a5fa" font-size="9" text-anchor="middle" opacity="0.8">NIEDOEKSTRAHOWANE</text>';
        s += '<text x="' + (x(24.1)) + '" y="' + (PAD.t + 16) + '" fill="#f87171" font-size="9" text-anchor="middle" opacity="0.8">PRZEEKSTRAHOWANE</text>';
        s += '<text x="' + (PAD.l + 6) + '" y="' + (PAD.t + PH - 8) + '" fill="#78716c" font-size="9">słabe</text>';
        s += '<text x="' + (PAD.l + 6) + '" y="' + (PAD.t + 14) + '" fill="#78716c" font-size="9">mocne</text>';

        // historia
        history.forEach((h, i) => {
            const op = 0.15 + 0.4 * (i / Math.max(1, history.length - 1));
            s += '<circle cx="' + x(clampEy(h.ey)) + '" cy="' + y(clampTds(h.tds)) + '" r="3.5" fill="#f59e0b" opacity="' + op.toFixed(2) + '"/>';
        });

        // punkt aktualny + wąs rozrzutu (σ)
        if (current) {
            const cx = x(clampEy(current.ey)), cy = y(clampTds(current.tds));
            const x1 = x(clampEy(current.ey - current.sigma));
            const x2 = x(clampEy(current.ey + current.sigma));
            s += '<line x1="' + x1 + '" y1="' + cy + '" x2="' + x2 + '" y2="' + cy + '" stroke="#fbbf24" stroke-width="2" opacity="0.55"/>';
            s += '<line x1="' + x1 + '" y1="' + (cy - 4) + '" x2="' + x1 + '" y2="' + (cy + 4) + '" stroke="#fbbf24" stroke-width="2" opacity="0.55"/>';
            s += '<line x1="' + x2 + '" y1="' + (cy - 4) + '" x2="' + x2 + '" y2="' + (cy + 4) + '" stroke="#fbbf24" stroke-width="2" opacity="0.55"/>';
            s += '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#fbbf24" opacity="0.25"/>';
            s += '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>';
        }

        s += '</svg>';
        el.innerHTML = s;
    }

    const clampEy  = v => Math.max(EY_MIN + 0.1, Math.min(EY_MAX - 0.1, v));
    const clampTds = v => Math.max(TDS_MIN + 0.01, Math.min(TDS_MAX - 0.01, v));

    return { render };
})();
