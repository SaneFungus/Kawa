// =============================================================================
// profile.js — PlayerProfile
// Jedyne miejsce, które trzyma stan gracza. Moduły (Kawiarnia, Laboratorium,
// Sklep, Konkursy) czytają i zapisują WYŁĄCZNIE przez te metody — żaden moduł
// nie grzebie bezpośrednio w cudzym stanie ani w obiekcie stanu tego pliku.
//
// Każda zmiana emituje zdarzenie (i zapisuje stan do localStorage). Zamiast
// każdej funkcji w grze pamiętać "wywołaj updateTopBar() po tej zmianie",
// main.js subskrybuje się raz: PlayerProfile.on('change', updateTopBar).
// =============================================================================
const PlayerProfile = (function () {

    const STORAGE_KEY = 'wbrc-save-v1';

    const state = {
        money: 0, rep: 0, fame: 0,
        compUnlocked: false, compWon: false, best: null,
        inventory: { grinder: 'g1', dripper: 'd1', kettle: 'k1', coffee: 'c1' },
        owned: ['g1', 'd1', 'k1', 'c1'],
        history: { lab: [], comp: [] },
        lastPour: { lab: null, comp: null },
        recipes: [],
        activeRecipeId: null,
        seedCounter: 1
    };

    // ---------------- Zdarzenia + zapis ----------------
    const listeners = {};
    function on(event, cb) { (listeners[event] = listeners[event] || []).push(cb); }
    function emit(event, payload) {
        save();
        (listeners[event] || []).forEach(cb => cb(payload));
        if (event !== 'change') (listeners['change'] || []).forEach(cb => cb(event, payload));
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* np. tryb prywatny */ }
    }
    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) Object.assign(state, JSON.parse(raw));
        } catch (e) { /* zły/uszkodzony zapis — startujemy od domyślnego stanu */ }
    }

    // ---------------- Pieniądze ----------------
    function getMoney() { return state.money; }
    function addMoney(n) { state.money += n; emit('money'); }
    function spendMoney(n) {
        if (state.money < n) return false;
        state.money -= n; emit('money'); return true;
    }

    // ---------------- Reputacja / sława ----------------
    function getReputation() { return state.rep; }
    function addReputation(n) { state.rep += n; emit('reputation'); }
    function getFame() { return state.fame; }
    function addFame(n) { state.fame += n; emit('fame'); }

    // ---------------- Ekwipunek ----------------
    function getInventory() { return state.inventory; }
    function owns(cat, id) { return state.owned.includes(id); }
    function equip(cat, id) { state.inventory[cat] = id; emit('inventory'); }
    function buy(cat, id) {
        if (!state.owned.includes(id)) state.owned.push(id);
        emit('inventory');
    }
    function getCurrentEquipment() {
        return {
            grinder: database.grinder.find(i => i.id === state.inventory.grinder),
            dripper: database.dripper.find(i => i.id === state.inventory.dripper),
            kettle:  database.kettle.find(i => i.id === state.inventory.kettle)
        };
    }
    function getCurrentCoffee() {
        return database.coffee.find(i => i.id === state.inventory.coffee);
    }

    // ---------------- Historia pomiarów (wykres) ----------------
    function getHistory(mode) { return state.history[mode]; }
    function pushHistory(mode, entry) {
        state.history[mode].push(entry);
        if (state.history[mode].length > 12) state.history[mode].shift();
        emit('history');
    }
    function clearHistory(mode) { state.history[mode] = []; emit('history'); }

    // ---------------- Ostatnie parzenie ręczne ----------------
    function getLastPour(mode) { return state.lastPour[mode]; }
    function setLastPour(mode, pour) { state.lastPour[mode] = pour; }

    // ---------------- Rekord ----------------
    function getBest() { return state.best; }
    function updateBest(total) {
        if (state.best === null || total > state.best) { state.best = total; emit('best'); }
    }

    // ---------------- Konkurs ----------------
    function isCompUnlocked() { return state.compUnlocked; }
    function unlockComp() { state.compUnlocked = true; emit('comp-unlocked'); }
    function isCompWon() { return state.compWon; }
    function setCompWon() { state.compWon = true; emit('comp-won'); }

    // ---------------- Receptury (Etap 3: Lab -> Kawiarnia) ----------------
    // Receptura to zapamiętany NASTAW (dose/water/grind/temp), nie technika ręki
    // z mini-gry — Kawiarnia zostaje automatycznym parzeniem, tylko już nie na
    // sztywno wpisanym w kod nastawie.
    function getRecipes() { return state.recipes; }
    function getActiveRecipe() {
        return state.recipes.find(r => r.id === state.activeRecipeId) || null;
    }
    function saveRecipe(name, brewParams, result) {
        const id = Date.now();
        state.recipes.push({
            id: id,
            name: name,
            params: { dose: brewParams.dose, water: brewParams.water, grind: brewParams.grind, temp: brewParams.temp },
            result: result,
            ts: id
        });
        if (state.activeRecipeId === null) state.activeRecipeId = id;
        emit('recipes');
    }
    function setActiveRecipe(id) {
        state.activeRecipeId = id;
        emit('recipes');
    }

    // ---------------- Seed ----------------
    function nextSeed(multiplier) { return (state.seedCounter++ * multiplier) >>> 0; }

    load();

    return {
        on,
        getMoney, addMoney, spendMoney,
        getReputation, addReputation, getFame, addFame,
        getInventory, owns, equip, buy, getCurrentEquipment, getCurrentCoffee,
        getHistory, pushHistory, clearHistory,
        getLastPour, setLastPour,
        getBest, updateBest,
        isCompUnlocked, unlockComp, isCompWon, setCompWon,
        getRecipes, getActiveRecipe, saveRecipe, setActiveRecipe,
        nextSeed,
        save, load
    };
})();

// Cienkie, wsteczne aliasy — reszta kodu woła te dwie funkcje w dziesiątkach
// miejsc; zamiast wszędzie pisać PlayerProfile.getCurrentEquipment().
function currentEquipment() { return PlayerProfile.getCurrentEquipment(); }
function currentCoffee() { return PlayerProfile.getCurrentCoffee(); }
