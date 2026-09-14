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
                html += '<div class="bg-white p-4 rounded-xl shadow-sm border ' + (equipped ? 'border-amber-500' : 'border-stone-200') + ' flex flex-col">' +
                    '<div class="flex items-center gap-2 mb-2"><i class="fas ' + item.icon + ' text-stone-500"></i>' +
                    '<h4 class="font-bold text-sm text-stone-800 leading-tight">' + item.name + '</h4></div>' +
                    '<p class="text-xs text-stone-600 mb-2">' + item.desc + '</p>' +
                    '<p class="text-[11px] text-amber-800 bg-amber-50 rounded px-2 py-1 mb-4 border border-amber-100"><i class="fas fa-sliders mr-1"></i>' + item.effect + '</p>' +
                    btn + '</div>';
            }
            html += '</div></div>';
        }
        host.innerHTML = html;
    }

    function buy(cat, id) {
        const item = database[cat].find(i => i.id === id);
        if (!PlayerProfile.spendMoney(item.price)) return;
        PlayerProfile.buy(cat, id);
        equip(cat, id);
        showModal('Zakup udany', item.effect, 'fa-box-open', 'text-emerald-500');
    }

    function equip(cat, id) {
        PlayerProfile.equip(cat, id);
        render();
        refreshReadouts('lab');
        refreshReadouts('comp');
    }

    return { render, buy, equip };
})();
