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
        const money = Math.round((8 + 26 * q) * PlayerProfile.getLocation().customerValueMult);
        const rep = Math.max(1, Math.round(6 * q));
        PlayerProfile.addMoney(money);
        PlayerProfile.addReputation(rep);
        PlayerProfile.recordDaySale(money);

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

    function renderLocationPanel() {
        const loc = PlayerProfile.getLocation();
        const stats = PlayerProfile.getDayStats();
        const title = document.getElementById('kawiarnia-title');
        if (title) title.textContent = loc.name;

        const next = nextLocation(loc);
        const money = PlayerProfile.getMoney();

        let html = '<h3 class="font-bold text-stone-800 mb-4"><i class="fas fa-shop mr-2"></i>Lokal i czynsz</h3>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
            '<div class="bg-stone-100 p-4 rounded border border-stone-200 text-sm">' +
            '<strong class="text-stone-800 block mb-1">' + loc.name + ', ' + loc.place + '</strong>' +
            '<span class="text-stone-600">Dzień ' + PlayerProfile.getDay() + ' · dziś: ' + stats.customers + ' klientów, ' + stats.earned + ' PLN</span><br>' +
            '<span class="text-stone-600">Czynsz dzienny: <strong class="text-red-700">' + loc.rent + ' PLN</strong></span>' +
            '<button onclick="Kawiarnia.endDay()" class="w-full mt-3 bg-stone-800 hover:bg-black text-white font-semibold py-2 rounded text-sm"><i class="fas fa-moon mr-2"></i>Zakończ dzień</button>' +
            '</div>';

        if (next) {
            const can = money >= next.moveCost;
            const missing = next.moveCost - money;
            html += '<div class="bg-amber-50 p-4 rounded border border-amber-200 text-sm">' +
                '<strong class="text-stone-800 block mb-1">' + next.name + ', ' + next.place + '</strong>' +
                '<p class="text-stone-600 text-xs mb-2">' + next.desc + '</p>' +
                '<span class="text-stone-600">Czynsz tam: ' + next.rent + ' PLN · zarobek ×' + next.customerValueMult.toFixed(2) + '</span>' +
                '<button onclick="Kawiarnia.move(\'' + next.id + '\')" ' + (can ? '' : 'disabled title="Brakuje ' + missing + ' PLN"') +
                ' class="w-full mt-3 font-semibold py-2 rounded text-sm ' + (can ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-stone-200 text-stone-400 cursor-not-allowed') + '">' +
                'Przenieś się (' + next.moveCost + ' PLN)</button>' +
                '</div>';
        }
        html += '</div>';

        document.getElementById('location-panel').innerHTML = html;
    }

    function nextLocation(loc) {
        const idx = LOCATIONS.findIndex(l => l.id === loc.id);
        return LOCATIONS[idx + 1] || null;
    }

    function endDay() {
        const r = PlayerProfile.endDay();
        const net = r.stats.earned - r.paid;
        showModal('Dzień ' + r.day + ' zakończony',
            'Obsłużono ' + r.stats.customers + ' klientów, zarobek dnia ' + r.stats.earned + ' PLN. ' +
            'Czynsz ' + r.rent + ' PLN' + (r.paid < r.rent ? ' (zapłacono tylko ' + r.paid + ' PLN — nie wystarczyło budżetu)' : '') + '. ' +
            'Saldo netto: ' + (net >= 0 ? '+' : '') + net + ' PLN.',
            'fa-moon', 'text-stone-600');
        renderLocationPanel();
    }

    function move(id) {
        const loc = LOCATIONS.find(l => l.id === id);
        if (!PlayerProfile.moveTo(id)) return;
        showModal('Przeprowadzka!', 'Nowy lokal: ' + loc.name + ', ' + loc.place + '. ' + loc.desc, 'fa-truck-fast', 'text-amber-600');
        renderLocationPanel();
        renderEquipmentPanel();
    }

    return { serveCustomer, renderEquipmentPanel, renderLocationPanel, endDay, move };
})();
