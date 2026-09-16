// =============================================================================
// module-lab.js — moduł Laboratorium.
// Odpowiada wyłącznie za panel eksperymentowania i odczyt analityczny.
// Pipeline parzenia (launchPour/startBrewing) jest współdzielony w ui-shared.js
// — ten moduł dostaje gotowy wynik i decyduje, jak go pokazać.
// =============================================================================
const Lab = (function () {
    const mode = 'lab';
    let lastResult = null;

    function buildControls() {
        document.getElementById(mode + '-controls').innerHTML = buildControlsSkeleton(mode);

        // Etap M3: receptury to osobna karta, nie ogon panelu nastawu — panel
        // wędruje na telefonie do szuflady, a zapisaną recepturę czyta się
        // razem z wynikiem parzenia.
        document.getElementById('lab-recipes').innerHTML =
            '<h3 class="font-bold text-stone-700 text-sm uppercase tracking-wider border-b pb-2"><i class="fas fa-bookmark mr-2"></i>Receptury</h3>' +
            '<div class="flex gap-2">' +
            '<input id="recipe-name-input" type="text" placeholder="Nazwa receptury..." class="flex-1 min-w-0 border border-stone-300 rounded px-3 py-2 text-sm">' +
            '<button id="btn-save-recipe" onclick="Lab.saveCurrentRecipe()" disabled class="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 px-4 rounded shadow text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"><i class="fas fa-bookmark mr-2"></i>Zapisz</button>' +
            '</div>' +
            '<div id="recipe-list" class="space-y-1"></div>';
        buildDock();
        buildResultTabs(mode, { wynik: 'Odczyt', sensoryka: 'Sensoryka', wykres: 'Wykres' });
        refreshReadouts(mode);
        renderRecipeList();
    }

    // Etap M2: oba tryby parzenia siedzą w doku przyklejonym do dołu ekranu.
    // Ręczne jest akcją główną (szersze, wyróżnione), auto — szybkim skrótem
    // do iterowania nastawem. Etykieta ręcznego skraca się na wąskim ekranie,
    // żeby oba przyciski zmieściły się w jednym wierszu.
    function buildDock() {
        renderDock('dock-' + mode,
            setupSummaryHtml(mode) +
            progressBarHtml(mode) +
            '<div class="flex gap-2">' +
            '<button id="btn-pour-lab" onclick="launchPour(\'lab\')" class="flex-[2] min-w-0 bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 px-3 rounded-lg shadow active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">' +
            '<i class="fas fa-hand-holding-droplet mr-2"></i>Parz ręcznie<span class="hidden sm:inline"> (technika)</span></button>' +
            '<button id="btn-brew-lab" onclick="startBrewing(\'lab\')" class="flex-1 min-w-0 bg-stone-800 hover:bg-black text-white font-semibold py-3 px-3 rounded-lg shadow text-sm active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">' +
            '<i class="fas fa-bolt mr-1"></i>Auto</button>' +
            '</div>');
    }

    function saveCurrentRecipe() {
        if (!lastResult) return;
        const input = document.getElementById('recipe-name-input');
        const name = (input.value || '').trim() || ('Moja receptura #' + (PlayerProfile.getRecipes().length + 1));
        PlayerProfile.saveRecipe(name, params[mode], { ey: lastResult.ey, tds: lastResult.tds, pct: lastResult.sensory.pct });
        input.value = '';
        renderRecipeList();
    }

    function setActiveRecipe(id) {
        PlayerProfile.setActiveRecipe(id);
        renderRecipeList();
    }

    function renderRecipeList() {
        const host = document.getElementById('recipe-list');
        if (!host) return;
        const recipes = PlayerProfile.getRecipes();
        const activeId = PlayerProfile.getActiveRecipe() ? PlayerProfile.getActiveRecipe().id : null;
        if (recipes.length === 0) {
            host.innerHTML = '<p class="text-xs text-stone-500 italic pt-1">Brak zapisanych receptur — Kawiarnia parzy na domyślnym nastawie.</p>';
            return;
        }
        host.innerHTML = recipes.slice().reverse().map(r => {
            const active = r.id === activeId;
            return '<div class="flex items-center justify-between gap-2 text-xs bg-white border ' + (active ? 'border-amber-500' : 'border-stone-200') + ' rounded px-3 py-2">' +
                '<div><strong class="text-stone-800">' + r.name + '</strong>' +
                '<span class="text-stone-500 mono"> EY ' + r.result.ey + '% · TDS ' + r.result.tds.toFixed(2) + '%</span></div>' +
                (active
                    ? '<span class="text-emerald-600 font-semibold whitespace-nowrap"><i class="fas fa-check-circle mr-1"></i>aktywna</span>'
                    : '<button onclick="Lab.setActiveRecipe(' + r.id + ')" class="text-amber-700 hover:text-amber-900 font-semibold whitespace-nowrap">Ustaw jako aktywną</button>') +
                '</div>';
        }).join('');
    }

    function showResult(r) {
        lastResult = r;
        const saveBtn = document.getElementById('btn-save-recipe');
        if (saveBtn) saveBtn.disabled = false;

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

    return { mode, buildControls, showResult, clearHistory, saveCurrentRecipe, setActiveRecipe };
})();
