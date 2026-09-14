// =============================================================================
// module-sklep.js — moduł Sklepu.
// Jedyne miejsce, które zna szczegóły renderowania oferty i decyzji zakupowej.
// Czyta/zapisuje stan WYŁĄCZNIE przez PlayerProfile i dane z database.js.
// =============================================================================
const Sklep = (function () {

    function render() {
        const host = document.getElementById('shop-container');
        let html = '';
        for (const cat in CATEGORY_LABELS) {
            html += '<div><h3 class="text-xl font-bold text-stone-700 mb-4 border-b pb-2">' + CATEGORY_LABELS[cat] + '</h3>' +
                    '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">';
            for (const item of database[cat]) {
                html += cat === 'coffee' ? renderCoffeeCard(item) : renderEquipmentCard(cat, item);
            }
            html += '</div></div>';
        }
        host.innerHTML = html;
    }

    // Sprzęt: trwała własność — raz kupiony, można się między posiadanymi
    // pozycjami przełączać bez ponownego płacenia.
    function renderEquipmentCard(cat, item) {
        const owned = PlayerProfile.owns(cat, item.id);
        const equipped = PlayerProfile.getInventory()[cat] === item.id;
        let btn;
        if (equipped) btn = '<button disabled class="mt-auto bg-stone-800 text-white font-bold py-2 rounded text-sm">W użyciu</button>';
        else if (owned) btn = '<button onclick="Sklep.equip(\'' + cat + '\',\'' + item.id + '\')" class="mt-auto bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold py-2 rounded text-sm">Wyposaż</button>';
        else {
            const can = PlayerProfile.getMoney() >= item.price;
            const missing = item.price - PlayerProfile.getMoney();
            btn = '<button onclick="Sklep.buy(\'' + cat + '\',\'' + item.id + '\')" ' + (can ? '' : 'disabled title="Brakuje ' + missing + ' PLN"') +
                  ' class="mt-auto ' + (can ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-stone-200 text-stone-400 cursor-not-allowed') +
                  ' font-bold py-2 rounded text-sm">' + item.price + ' PLN</button>';
        }
        return '<div class="bg-white p-4 rounded-xl shadow-sm border ' + (equipped ? 'border-amber-500' : 'border-stone-200') + ' flex flex-col">' +
            '<div class="flex items-center gap-2 mb-2"><i class="fas ' + item.icon + ' text-stone-500"></i>' +
            '<h4 class="font-bold text-sm text-stone-800 leading-tight">' + item.name + '</h4></div>' +
            '<p class="text-xs text-stone-600 mb-2">' + item.desc + '</p>' +
            '<p class="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 mb-4 border border-amber-100"><i class="fas fa-sliders mr-1"></i>' + item.effect + '</p>' +
            btn + '</div>';
    }

    // Ziarno (Etap 5): surowiec zużywalny — zapas w gramach, nie trwała
    // własność. Dokup i wybór aktywnego rodzaju to dwie osobne akcje, bo
    // dokupienie zapasu nie musi oznaczać przełączenia się na ten rodzaj.
    function renderCoffeeCard(item) {
        if (item.unlockedBy && !PlayerProfile.hasWonComp(item.unlockedBy)) return renderLockedCoffeeSlot(item);
        const stock = PlayerProfile.getCoffeeStock(item.id);
        const equipped = PlayerProfile.getInventory().coffee === item.id;

        let equipBtn;
        if (equipped) equipBtn = '<button disabled class="flex-1 bg-stone-800 text-white font-bold py-2 rounded text-sm">W użyciu</button>';
        else if (stock > 0) equipBtn = '<button onclick="Sklep.equip(\'coffee\',\'' + item.id + '\')" class="flex-1 bg-amber-100 text-amber-800 hover:bg-amber-200 font-bold py-2 rounded text-sm">Wybierz</button>';
        else equipBtn = '<button disabled title="Brak zapasu" class="flex-1 bg-stone-200 text-stone-400 cursor-not-allowed font-bold py-2 rounded text-sm">Brak zapasu</button>';

        const can = PlayerProfile.getMoney() >= item.price;
        const missing = item.price - PlayerProfile.getMoney();
        const buyBtn = '<button onclick="Sklep.buyCoffee(\'' + item.id + '\')" ' + (can ? '' : 'disabled title="Brakuje ' + missing + ' PLN"') +
            ' class="flex-1 ' + (can ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-stone-200 text-stone-400 cursor-not-allowed') +
            ' font-bold py-2 rounded text-sm">+' + item.bagSize + 'g · ' + item.price + ' PLN</button>';

        return '<div class="bg-white p-4 rounded-xl shadow-sm border ' + (equipped ? 'border-amber-500' : 'border-stone-200') + ' flex flex-col">' +
            '<div class="flex items-center gap-2 mb-2"><i class="fas ' + item.icon + ' text-stone-500"></i>' +
            '<h4 class="font-bold text-sm text-stone-800 leading-tight">' + item.name + '</h4></div>' +
            '<p class="text-xs text-stone-600 mb-2">' + item.desc + '</p>' +
            '<p class="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 mb-2 border border-amber-100"><i class="fas fa-sliders mr-1"></i>' + item.effect + '</p>' +
            '<p class="text-[11px] mono mb-4 ' + (stock > 0 ? 'text-stone-600' : 'text-red-600 font-semibold') + '"><i class="fas fa-weight-hanging mr-1"></i>Zapas: ' + stock + ' g</p>' +
            '<div class="flex gap-2 mt-auto">' + equipBtn + buyBtn + '</div></div>';
    }

    // Pusty slot (Etap 6, wizja §5): "pojawia się jako towar dopiero po
    // nagrodzie z Konkursów" — więc dopóki `unlockedBy` nie jest wygrane,
    // karta nie pokazuje żadnych statystyk ani cen, tylko warunek odblokowania.
    function renderLockedCoffeeSlot(item) {
        const comp = COMPETITIONS.find(c => c.id === item.unlockedBy);
        return '<div class="bg-stone-100 p-4 rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center text-center text-stone-400 min-h-[180px]">' +
            '<i class="fas fa-lock text-2xl mb-2"></i>' +
            '<p class="text-xs font-semibold">Pusty slot na własną markę</p>' +
            '<p class="text-[11px] mt-1">Odblokowanie: wygraj<br><strong>' + (comp ? comp.name : 'nieznany konkurs') + '</strong></p>' +
            '</div>';
    }

    function buy(cat, id) {
        const item = database[cat].find(i => i.id === id);
        if (!PlayerProfile.spendMoney(item.price)) return;
        PlayerProfile.buy(cat, id);
        equip(cat, id);
        showModal('Zakup udany', item.effect, 'fa-box-open', 'text-emerald-500');
    }

    function buyCoffee(id) {
        const item = database.coffee.find(i => i.id === id);
        if (!PlayerProfile.buyCoffee(id)) return;
        render();
        refreshReadouts('lab');
        refreshReadouts('comp');
        showModal('Zakup udany', 'Dokupiono ' + item.bagSize + ' g: ' + item.name + '.', 'fa-box-open', 'text-emerald-500');
    }

    function equip(cat, id) {
        PlayerProfile.equip(cat, id);
        render();
        refreshReadouts('lab');
        refreshReadouts('comp');
    }

    return { render, buy, buyCoffee, equip };
})();
