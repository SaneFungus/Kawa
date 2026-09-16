// =============================================================================
// module-kawiarnia.js — moduł Kawiarni.
// Obsługa klientów na N stanowiskach (Etap 4b) + panel aktualnego setupu.
// =============================================================================
const Kawiarnia = (function () {

    // Dawka z aktywnej receptury (albo domyślnego, rozsądnego nastawu) — ta sama
    // wartość musi być użyta przy sprawdzaniu zapasu i przy jego zużyciu.
    function activeDose() {
        const recipe = PlayerProfile.getActiveRecipe();
        return recipe ? recipe.params.dose : 15;
    }

    function serveCustomer(i, isBarman) {
        const btn = document.getElementById('btn-work-' + i);
        const cont = document.getElementById('work-progress-container-' + i);
        const bar = document.getElementById('work-progress-' + i);
        if (!cont || !cont.classList.contains('hidden')) return; // stanowisko już zajęte
        const dose = activeDose();
        if (!PlayerProfile.hasEnoughActiveCoffee(dose)) {
            if (!isBarman) showModal('Brak ziarna', 'Zabrakło ' + currentCoffee().name + ' w zapasie (potrzeba ' + dose + ' g). Dokup w Sklepie.', 'fa-seedling', 'text-red-500');
            return;
        }
        if (btn) btn.disabled = true;
        cont.classList.remove('hidden');
        bar.style.width = '0%';
        let p = 0;
        const iv = setInterval(() => {
            p += 5;
            bar.style.width = p + '%';
            if (p >= 100) { clearInterval(iv); completeOrder(i, cont, isBarman); }
        }, 80);
    }

    function completeOrder(i, cont, isBarman) {
        // Zarobek liczony z FAKTYCZNEJ jakości naparu przy aktywnej recepturze
        // z Laboratorium (albo domyślnym, rozsądnym nastawie, gdy gracz jeszcze
        // żadnej nie zapisał).
        const recipe = PlayerProfile.getActiveRecipe();
        const brewParams = recipe ? recipe.params : { dose: 15, water: 250, grind: 700, temp: 93 };
        PlayerProfile.consumeActiveCoffee(brewParams.dose);
        const seed = PlayerProfile.nextSeed(2246822519);
        const r = BrewEngine.brew(brewParams, currentEquipment(), currentCoffee(), seed);
        const q = r.sensory.pct;
        const money = Math.round(PlayerProfile.getLocation().cupPrice * (0.5 + 0.8 * q));
        const rep = Math.max(1, Math.round(6 * q));
        PlayerProfile.addMoney(money);
        PlayerProfile.addReputation(rep);
        PlayerProfile.recordDaySale(money);

        const log = document.getElementById('work-log');
        if (log.children.length === 1 && log.children[0].classList.contains('italic')) log.innerHTML = '';
        const li = document.createElement('li');
        li.className = 'border-b border-stone-100 pb-1 text-xs';
        li.innerHTML = '<span class="text-stone-800 font-semibold">' + (isBarman ? 'Barman: ' : '') + 'Przelew' + (recipe ? ' (' + recipe.name + ')' : '') + ' ' + (q * 100).toFixed(0) + '%</span> ' +
            '<span class="text-emerald-600">+' + money + ' PLN</span> <span class="text-amber-600">+' + rep + ' Rep</span>';
        log.prepend(li);
        if (log.children.length > 6) log.lastChild.remove();

        setTimeout(() => { cont.classList.add('hidden'); updateStationButtons(); }, 250);
    }

    // Limit klientów na dzień (`dailyCap` z LOCATIONS) — bez niego czynsz przy
    // "Zakończ dzień" byłby czystym kosztem: nic nie stałoby na przeszkodzie,
    // żeby nigdy dnia nie kończyć. Bezpieczne do wołania w każdej chwili (tylko
    // disabled + tekst, nigdy nie przebudowuje stanowisk), więc nie zaburza
    // animacji parzenia w toku.
    function updateStationButtons() {
        const loc = PlayerProfile.getLocation();
        const status = document.getElementById('queue-status');
        const left = loc.dailyCap - PlayerProfile.getDayStats().customers;
        const dose = activeDose();
        const enoughCoffee = PlayerProfile.hasEnoughActiveCoffee(dose);
        const playerStations = PlayerProfile.hasBarman() ? loc.stations - 1 : loc.stations;
        for (let i = 0; i < playerStations; i++) {
            const btn = document.getElementById('btn-work-' + i);
            if (btn) btn.disabled = left <= 0 || !enoughCoffee;
        }
        if (!status) return;
        status.textContent = left <= 0
            ? 'Kolejka na dziś zamknięta — zakończ dzień, żeby wrócić do pracy.'
            : !enoughCoffee
                ? 'Zabrakło ' + currentCoffee().name + ' w zapasie — dokup w Sklepie.'
                : 'Możesz jeszcze obsłużyć ' + left + ' klientów dzisiaj.';
    }

    // Przebudowuje same stanowiska (liczba/rodzaj się zmienia tylko przy
    // przeprowadzce albo zatrudnieniu barmana) — osobno od updateStationButtons(),
    // żeby zwykłe odświeżenie panelu (na każdą zmianę stanu gracza) nie zrywało
    // animacji parzenia w toku na innym stanowisku.
    // Etap M2: stanowiska przeniesione do doku przyklejonego do dołu ekranu —
    // obsługa klienta to najczęściej powtarzana akcja w całej grze, więc nie
    // może odjeżdżać wraz ze scrollem logu zamówień czy panelu lokalu.
    // Stanowiska stoją obok siebie w jednym wierszu (maksymalnie dwa wg
    // LOCATIONS), a status kolejki jest podpisem pod nimi.
    function renderStations() {
        const loc = PlayerProfile.getLocation();
        const host = document.getElementById('stations-panel');
        let html = '<div class="flex gap-2 items-stretch">';
        for (let i = 0; i < loc.stations; i++) {
            const isBarmanSlot = (i === loc.stations - 1 && PlayerProfile.hasBarman());
            if (isBarmanSlot) {
                html += '<div class="flex-1 min-w-0 flex flex-col justify-center text-center bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-2">' +
                    '<p class="text-xs font-semibold text-emerald-700 leading-tight"><i class="fas fa-user-tie mr-1"></i>Barman pracuje</p>' +
                    '<div class="mt-1.5 h-2 w-full bg-emerald-100 rounded-full overflow-hidden hidden" id="work-progress-container-' + i + '">' +
                    '<div id="work-progress-' + i + '" class="h-full bg-emerald-500 progress-bar-fill" style="width:0%"></div></div>' +
                    '</div>';
            } else {
                html += '<div class="flex-1 min-w-0">' +
                    '<button id="btn-work-' + i + '" onclick="Kawiarnia.serveCustomer(' + i + ')" class="w-full bg-amber-700 hover:bg-amber-800 text-white font-bold py-3 px-3 rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-sm md:text-base"><i class="fas fa-coffee"></i><span>Zaparz przelew</span></button>' +
                    '<div class="mt-1.5 h-2 w-full bg-stone-200 rounded-full overflow-hidden hidden" id="work-progress-container-' + i + '">' +
                    '<div id="work-progress-' + i + '" class="h-full bg-amber-500 progress-bar-fill" style="width:0%"></div></div>' +
                    '</div>';
            }
        }
        html += '</div><p id="queue-status" class="text-xs text-stone-500 mt-2 text-center"></p>';
        host.innerHTML = html;
        updateStationButtons();
    }

    // Barman: jedno stanowisko obsługiwane automatycznie, bez klikania.
    // Warunki sprawdzane na każdym tyku — bezpieczne nawet po przeprowadzce
    // czy zwolnieniu, bez osobnego mechanizmu start/stop.
    setInterval(() => {
        if (!PlayerProfile.hasBarman()) return;
        const loc = PlayerProfile.getLocation();
        if (loc.stations < 2) return;
        if (PlayerProfile.dayCapReached()) return;
        if (!PlayerProfile.hasEnoughActiveCoffee(activeDose())) return;
        serveCustomer(loc.stations - 1, true);
    }, 2600);

    // Log zamówień jest domyślnie otwarty (to jedyna informacja zwrotna
    // o zarobku), ale daje się zwinąć — na telefonie odzyskuje to miejsce
    // graczom, którzy tylko klikają kolejnych klientów (Etap M7).
    function toggleLog() {
        const log = document.getElementById('work-log');
        const collapsed = log.classList.toggle('log-collapsed');
        document.getElementById('work-log-chevron').className =
            'fas text-xs text-stone-400 ' + (collapsed ? 'fa-chevron-down' : 'fa-chevron-up');
    }

    function renderEquipmentPanel() {
        const eq = currentEquipment(), coffee = currentCoffee();
        const recipe = PlayerProfile.getActiveRecipe();
        const panel = document.getElementById('eq-panel');
        const rows = [
            ['Młynek', eq.grinder.name, 'σg ' + eq.grinder.gsd.toFixed(2)],
            ['Zaparzacz', eq.dripper.name, 'przepływ ×' + eq.dripper.flowMod.toFixed(2)],
            ['Czajnik', eq.kettle.name, 'dryf ±' + eq.kettle.tempDrift + '°C'],
            ['Ziarno', coffee.name, 'jakość ' + coffee.quality.toFixed(2) + ' · zapas ' + PlayerProfile.getCoffeeStock(coffee.id) + ' g'],
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
        const hasBarman = PlayerProfile.hasBarman();

        let html = '<h3 class="font-bold text-stone-800 mb-4"><i class="fas fa-shop mr-2"></i>Lokal i czynsz</h3>' +
            '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">' +
            '<div class="bg-stone-100 p-4 rounded border border-stone-200 text-sm">' +
            '<strong class="text-stone-800 block mb-1">' + loc.name + ', ' + loc.place + '</strong>' +
            '<span class="text-stone-600">Dzień ' + PlayerProfile.getDay() + ' · dziś: ' + stats.customers + '/' + loc.dailyCap + ' klientów, ' + stats.earned + ' PLN</span><br>' +
            '<span class="text-stone-600">Czynsz dzienny: <strong class="text-red-700">' + loc.rent + ' PLN</strong>' +
            (hasBarman ? ' + barman <strong class="text-red-700">' + BARMAN_WAGE + ' PLN</strong>' : '') +
            ' · Cena filiżanki: <strong>' + loc.cupPrice + ' PLN</strong></span>' +
            '<button onclick="Kawiarnia.endDay()" class="w-full mt-3 bg-stone-800 hover:bg-black text-white font-semibold py-2 rounded text-sm"><i class="fas fa-moon mr-2"></i>Zakończ dzień</button>' +
            '</div>';

        if (next) {
            const can = money >= next.moveCost;
            const missing = next.moveCost - money;
            html += '<div class="bg-amber-50 p-4 rounded border border-amber-200 text-sm">' +
                '<strong class="text-stone-800 block mb-1">' + next.name + ', ' + next.place + '</strong>' +
                '<p class="text-stone-600 text-xs mb-2">' + next.desc + '</p>' +
                '<span class="text-stone-600">Czynsz tam: ' + next.rent + ' PLN · cena filiżanki ' + next.cupPrice + ' PLN · limit ' + next.dailyCap + ' klientów/dzień</span>' +
                '<button onclick="Kawiarnia.move(\'' + next.id + '\')" ' + (can ? '' : 'disabled title="Brakuje ' + missing + ' PLN"') +
                ' class="w-full mt-3 font-semibold py-2 rounded text-sm ' + (can ? 'bg-amber-700 hover:bg-amber-800 text-white' : 'bg-stone-200 text-stone-400 cursor-not-allowed') + '">' +
                'Przenieś się (' + next.moveCost + ' PLN)</button>' +
                '</div>';
        }

        if (loc.stations >= 2 && !hasBarman) {
            const canHire = money >= BARMAN_HIRE_COST;
            const missingHire = BARMAN_HIRE_COST - money;
            html += '<div class="bg-emerald-50 p-4 rounded border border-emerald-200 text-sm">' +
                '<strong class="text-stone-800 block mb-1"><i class="fas fa-user-tie mr-1"></i>Zatrudnij barmana</strong>' +
                '<p class="text-stone-600 text-xs mb-2">Automatycznie obsługuje drugie stanowisko, bez klikania. Koszt: ' + BARMAN_HIRE_COST + ' PLN jednorazowo + ' + BARMAN_WAGE + ' PLN/dzień.</p>' +
                '<button onclick="Kawiarnia.hireBarman()" ' + (canHire ? '' : 'disabled title="Brakuje ' + missingHire + ' PLN"') +
                ' class="w-full font-semibold py-2 rounded text-sm ' + (canHire ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-stone-200 text-stone-400 cursor-not-allowed') + '">' +
                'Zatrudnij (' + BARMAN_HIRE_COST + ' PLN)</button>' +
                '</div>';
        }
        html += '</div>';

        document.getElementById('location-panel').innerHTML = html;
        updateStationButtons();
    }

    function nextLocation(loc) {
        const idx = LOCATIONS.findIndex(l => l.id === loc.id);
        return LOCATIONS[idx + 1] || null;
    }

    function endDay() {
        const r = PlayerProfile.endDay();
        const net = r.stats.earned + r.sponsor - r.paid;
        const due = r.rent + r.wage;
        showModal('Dzień ' + r.day + ' zakończony',
            'Obsłużono ' + r.stats.customers + ' klientów, zarobek dnia ' + r.stats.earned + ' PLN. ' +
            (r.sponsor > 0 ? 'Sponsoring: +' + r.sponsor + ' PLN. ' : '') +
            'Czynsz ' + r.rent + ' PLN' + (r.wage > 0 ? ' + barman ' + r.wage + ' PLN' : '') +
            (r.paid < due ? ' (zapłacono tylko ' + r.paid + ' PLN — nie wystarczyło budżetu)' : '') + '. ' +
            'Saldo netto: ' + (net >= 0 ? '+' : '') + net + ' PLN.',
            'fa-moon', 'text-stone-600');
        renderLocationPanel();
    }

    function move(id) {
        const loc = LOCATIONS.find(l => l.id === id);
        if (!PlayerProfile.moveTo(id)) return;
        showModal('Przeprowadzka!', 'Nowy lokal: ' + loc.name + ', ' + loc.place + '. ' + loc.desc, 'fa-truck-fast', 'text-amber-600');
        renderStations();
        renderLocationPanel();
        renderEquipmentPanel();
    }

    function hireBarman() {
        if (!PlayerProfile.hireBarman()) return;
        showModal('Barman zatrudniony!', 'Drugie stanowisko będzie teraz obsługiwane automatycznie, bez klikania — kosztem ' + BARMAN_WAGE + ' PLN/dzień.', 'fa-user-tie', 'text-emerald-600');
        renderStations();
        renderLocationPanel();
    }

    return { serveCustomer, renderEquipmentPanel, renderLocationPanel, renderStations, endDay, move, hireBarman, toggleLog };
})();
