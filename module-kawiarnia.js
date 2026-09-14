// =============================================================================
// module-kawiarnia.js — moduł Kawiarni.
// Obsługa klientów przy stałym, "rozsądnym" nastawie + panel aktualnego setupu.
// =============================================================================
const Kawiarnia = (function () {

    function serveCustomer() {
        const btn = document.getElementById('btn-work');
        const cont = document.getElementById('work-progress-container');
        const bar = document.getElementById('work-progress');
        btn.disabled = true;
        cont.classList.remove('hidden');
        bar.style.width = '0%';
        let p = 0;
        const iv = setInterval(() => {
            p += 5;
            bar.style.width = p + '%';
            if (p >= 100) { clearInterval(iv); completeOrder(btn, cont); }
        }, 80);
    }

    function completeOrder(btn, cont) {
        // Zarobek liczony z FAKTYCZNEJ jakości naparu przy aktywnej recepturze
        // z Laboratorium (albo domyślnym, rozsądnym nastawie, gdy gracz jeszcze
        // żadnej nie zapisał).
        const recipe = PlayerProfile.getActiveRecipe();
        const brewParams = recipe ? recipe.params : { dose: 15, water: 250, grind: 700, temp: 93 };
        const seed = PlayerProfile.nextSeed(2246822519);
        const r = BrewEngine.brew(brewParams, currentEquipment(), currentCoffee(), seed);
        const q = r.sensory.pct;
        const money = Math.round(8 + 26 * q);
        const rep = Math.max(1, Math.round(6 * q));
        PlayerProfile.addMoney(money);
        PlayerProfile.addReputation(rep);

        const log = document.getElementById('work-log');
        if (log.children.length === 1 && log.children[0].classList.contains('italic')) log.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'border-b border-stone-100 pb-1 text-xs';
        li.innerHTML = '<span class="text-stone-800 font-semibold">Przelew' + (recipe ? ' (' + recipe.name + ')' : '') + ' ' + (q * 100).toFixed(0) + '%</span> ' +
            '<span class="text-emerald-600">+' + money + ' PLN</span> <span class="text-amber-600">+' + rep + ' Rep</span>';
        log.prepend(li);
        if (log.children.length > 6) log.lastChild.remove();

        setTimeout(() => { cont.classList.add('hidden'); btn.disabled = false; }, 250);
    }

    function renderEquipmentPanel() {
        const eq = currentEquipment(), coffee = currentCoffee();
        const recipe = PlayerProfile.getActiveRecipe();
        const panel = document.getElementById('eq-panel');
        const rows = [
            ['Młynek', eq.grinder.name, 'σg ' + eq.grinder.gsd.toFixed(2)],
            ['Zaparzacz', eq.dripper.name, 'przepływ ×' + eq.dripper.flowMod.toFixed(2)],
            ['Czajnik', eq.kettle.name, 'dryf ±' + eq.kettle.tempDrift + '°C'],
            ['Ziarno', coffee.name, 'jakość ' + coffee.quality.toFixed(2)],
            ['Aktywna receptura', recipe ? recipe.name : 'domyślny nastaw', recipe ? ('EY ' + recipe.result.ey + '%') : '15g/250g/700µm/93°C']
        ];
        panel.innerHTML = rows.map(r =>
            '<div class="bg-stone-100 p-3 rounded border border-stone-200">' +
            '<span class="block text-stone-500 text-[10px] uppercase tracking-wider">' + r[0] + '</span>' +
            '<strong class="text-stone-800 text-sm block leading-tight">' + r[1] + '</strong>' +
            '<span class="text-[11px] text-amber-700 mono">' + r[2] + '</span></div>').join('');
    }

    return { serveCustomer, renderEquipmentPanel };
})();
