// =============================================================================
// module-lab.js — moduł Laboratorium.
// Odpowiada wyłącznie za panel eksperymentowania i odczyt analityczny.
// Pipeline parzenia (launchPour/startBrewing) jest współdzielony w ui-shared.js
// — ten moduł dostaje gotowy wynik i decyduje, jak go pokazać.
// =============================================================================
const Lab = (function () {
    const mode = 'lab';

    function buildControls() {
        const host = document.getElementById(mode + '-controls');
        let html = buildControlsSkeleton(mode);
        html += '<button id="btn-pour-lab" onclick="launchPour(\'lab\')" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-4 rounded shadow disabled:opacity-50 disabled:cursor-not-allowed"><i class="fas fa-hand-holding-droplet mr-2"></i>Parz ręcznie (technika)</button>';
        html += '<button id="btn-brew-lab" onclick="startBrewing(\'lab\')" class="w-full bg-stone-800 hover:bg-black text-white font-semibold py-2 px-4 rounded shadow text-sm disabled:opacity-50 disabled:cursor-not-allowed">Auto-parzenie (szybka iteracja)</button>';
        html += progressBarHtml(mode);
        host.innerHTML = html;
        refreshReadouts(mode);
    }

    function showResult(r) {
        document.getElementById('lab-idle').classList.add('hidden');
        const m = document.getElementById('lab-metrics');
        m.classList.remove('hidden');
        m.classList.add('grid');

        const eyOk = r.ey >= 18 && r.ey <= 22;
        const tdsOk = r.tds >= 1.15 && r.tds <= 1.55;
        const sigOk = r.sigma < 1.10;

        m.innerHTML =
            metricCard('Extraction Yield', r.ey + '%', eyOk, 'norma 18–22%') +
            metricCard('TDS', r.tds.toFixed(2) + '%', tdsOk, 'Golden Cup 1,15–1,35%') +
            metricCard('Rozrzut ekstrakcji σ', '±' + r.sigma.toFixed(2), sigOk, sigOk ? 'złoże równe' : 'złoże nierówne') +
            metricCard('Czas kontaktu', Math.floor(r.time / 60) + ':' + String(r.time % 60).padStart(2, '0'), null, 'wynik oporu złoża') +
            metricCard('Masa naparu', r.brewMass + ' g', null, 'ratio 1:' + r.ratio) +
            metricCard('Realna temp.', r.realTemp + '°C', Math.abs(r.tempDrift) < 1, 'dryf ' + (r.tempDrift >= 0 ? '+' : '') + r.tempDrift + '°C') +
            metricCard('Równomierność', '×' + r.evenness.toFixed(2), r.evenness > 1.0, r.pour ? 'z mini-gry' : 'tryb auto') +
            metricCard('Agitacja', '×' + r.agitation.toFixed(2), null, r.pour ? 'z mini-gry' : 'tryb auto');

        renderSensory('lab-sensory', r.sensory);
        const v = document.getElementById('lab-verdict');
        v.textContent = r.verdict;
        v.className = 'mt-4 text-sm italic text-stone-600 border-l-4 pl-3 py-1 ' +
            (r.sensory.pct > 0.75 ? 'border-emerald-500' : r.sensory.pct > 0.6 ? 'border-amber-500' : 'border-red-400');
    }

    function clearHistory() {
        PlayerProfile.clearHistory(mode);
        drawChart(mode, null, params[mode].water / params[mode].dose);
    }

    return { mode, buildControls, showResult, clearHistory };
})();
