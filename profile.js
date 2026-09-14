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
        compUnlocked: false, compsWon: [], best: null,
        inventory: { grinder: 'g1', dripper: 'd1', kettle: 'k1', coffee: 'c1' },
        owned: ['g1', 'd1', 'k1'],
        coffeeStock: { c1: 250 },
        history: { lab: [], comp: [] },
        lastPour: { lab: null, comp: null },
        recipes: [],
        activeRecipeId: null,
        seedCounter: 1,
        locationId: 'l1',
        day: 1,
        dayStats: { customers: 0, earned: 0 },
        hasBarman: false,
        storySeen: []
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

    // ---------------- Ziarno jako surowiec zużywalny (Etap 5) ----------------
    // W przeciwieństwie do sprzętu (kupione = trwałe), ziarno ma skończony zapas
    // w gramach per rodzaj. Zakup dokłada `bagSize` gramów, parzenie ujmuje
    // `dose` gramów z aktualnie wyposażonego rodzaju.
    function getCoffeeStock(id) { return state.coffeeStock[id] || 0; }
    function getCurrentCoffeeStock() { return getCoffeeStock(state.inventory.coffee); }
    function hasEnoughActiveCoffee(grams) { return getCurrentCoffeeStock() >= grams; }
    function buyCoffee(id) {
        const item = database.coffee.find(i => i.id === id);
        if (!spendMoney(item.price)) return false;
        state.coffeeStock[id] = getCoffeeStock(id) + item.bagSize;
        emit('coffee-stock');
        return true;
    }
    function consumeActiveCoffee(grams) {
        const id = state.inventory.coffee;
        state.coffeeStock[id] = Math.max(0, getCoffeeStock(id) - grams);
        emit('coffee-stock');
    }

    // ---------------- Historia pomiarów (wykres) ----------------
    function getHistory(mode) { return state.history[mode]; }
    function pushHistory(mode, entry) {
        state.history[mode].push(entry);
        if (state.history[mode].length > 12) state.history[mode].shift();
        emit('history', { mode: mode });
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

    // ---------------- Drabinka konkursów (Etap 6) ----------------
    // Nagroda (reputacja/sława) przyznawana WYŁĄCZNIE za pierwsze zwycięstwo
    // danego szczebla — powtórne wygrane to tylko satysfakcja/rekord, bez
    // farmienia sławy. `winComp` zwraca, czy to było pierwsze zwycięstwo, żeby
    // wołający mógł dobrać treść modala.
    function hasWonComp(id) { return state.compsWon.includes(id); }
    function getCompsWon() { return state.compsWon; }
    function winComp(id, rewardRep, rewardFame) {
        const firstWin = !state.compsWon.includes(id);
        if (firstWin) {
            state.compsWon.push(id);
            if (rewardRep) addReputation(rewardRep);
            if (rewardFame) addFame(rewardFame);
            emit('comp-won', { id: id });
        }
        return firstWin;
    }
    // Suma `sponsorIncome` ze WSZYSTKICH dotąd wygranych szczebli, które go
    // dają — doliczana codziennie w endDay(). Kilka wygranych szczebli =
    // kilka kontraktów naraz, nie zastępowanie jednego drugim.
    function getSponsorIncome() {
        return COMPETITIONS.reduce((sum, t) => sum + (hasWonComp(t.id) ? (t.sponsorIncome || 0) : 0), 0);
    }

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

    // ---------------- Lokal, czynsz i dzień (Etap 4a) ----------------
    function getLocation() { return LOCATIONS.find(l => l.id === state.locationId); }
    function getDay() { return state.day; }
    function getDayStats() { return state.dayStats; }
    function recordDaySale(money) {
        state.dayStats.customers++;
        state.dayStats.earned += money;
        emit('day-stats');
    }
    function endDay() {
        const sponsor = getSponsorIncome();
        state.money += sponsor;
        const rent = getLocation().rent;
        const wage = state.hasBarman ? BARMAN_WAGE : 0;
        const due = rent + wage;
        const paid = Math.min(due, state.money);
        state.money -= paid;
        const summary = { day: state.day, stats: Object.assign({}, state.dayStats), rent: rent, wage: wage, paid: paid, sponsor: sponsor };
        state.dayStats = { customers: 0, earned: 0 };
        state.day++;
        emit('day-ended');
        return summary;
    }
    function dayCapReached() { return state.dayStats.customers >= getLocation().dailyCap; }
    function hasBarman() { return state.hasBarman; }
    function hireBarman() {
        if (!spendMoney(BARMAN_HIRE_COST)) return false;
        state.hasBarman = true;
        emit('barman');
        return true;
    }
    function moveTo(id) {
        const loc = LOCATIONS.find(l => l.id === id);
        if (!loc) return false;
        if (!spendMoney(loc.moveCost)) return false;
        state.locationId = id;
        emit('location', { id: id });
        return true;
    }

    // ---------------- Fabuła (Etap 7) ----------------
    // Które sceny StoryEvents już pokazał — trzymane tu (nie w story.js), żeby
    // przetrwać zapis/wczytanie jak reszta profilu, tym samym mechanizmem.
    function hasSeenStory(id) { return state.storySeen.includes(id); }
    function markStorySeen(id) {
        if (!state.storySeen.includes(id)) { state.storySeen.push(id); emit('story'); }
    }

    // ---------------- Seed ----------------
    function nextSeed(multiplier) { return (state.seedCounter++ * multiplier) >>> 0; }

    load();

    return {
        on,
        getMoney, addMoney, spendMoney,
        getReputation, addReputation, getFame, addFame,
        getInventory, owns, equip, buy, getCurrentEquipment, getCurrentCoffee,
        getCoffeeStock, getCurrentCoffeeStock, hasEnoughActiveCoffee, buyCoffee, consumeActiveCoffee,
        getHistory, pushHistory, clearHistory,
        getLastPour, setLastPour,
        getBest, updateBest,
        isCompUnlocked, unlockComp, hasWonComp, getCompsWon, winComp, getSponsorIncome,
        getRecipes, getActiveRecipe, saveRecipe, setActiveRecipe,
        getLocation, getDay, getDayStats, recordDaySale, endDay, moveTo, dayCapReached,
        hasBarman, hireBarman,
        hasSeenStory, markStorySeen,
        nextSeed,
        save, load
    };
})();

// Cienkie, wsteczne aliasy — reszta kodu woła te dwie funkcje w dziesiątkach
// miejsc; zamiast wszędzie pisać PlayerProfile.getCurrentEquipment().
function currentEquipment() { return PlayerProfile.getCurrentEquipment(); }
function currentCoffee() { return PlayerProfile.getCurrentCoffee(); }
