// =============================================================================
// module-konkursy.js — moduł Konkursów.
// Odpowiada za drabinkę szczebli (Etap 6), panel aktywnego konkursu i werdykt
// sędziowski. Pipeline parzenia (launchPour/startBrewing) jest współdzielony
// w ui-shared.js — ten moduł dostaje gotowy wynik i decyduje, jak go ocenić.
// =============================================================================
const Konkursy = (function () {
    const mode = 'comp';
    // Który szczebel gracz aktualnie ogląda/rozgrywa — czysto UI, nie stan
    // gracza (PlayerProfile trzyma tylko to, co WYGRANE, nie to, co wybrane).
    let activeTierId = null;

    function isTierUnlocked(t) {
        if (t.tier === 1) return PlayerProfile.getReputation() >= t.reqRep;
        const prev = COMPETITIONS.find(c => c.tier === t.tier - 1);
        return !!prev && PlayerProfile.hasWonComp(prev.id);
    }

    function activeTier() {
        return COMPETITIONS.find(t => t.id === activeTierId) || COMPETITIONS[0];
    }

    // Warunek startu PREZENTACJI (nie odblokowania szczebla na drabince) —
    // "trudniejsze ziarno" z wizji, sprawdzane przez istniejące pole jakości
    // kawy zamiast twardo wpisanych id sprzętu.
    function checkEntry() {
        const t = activeTier();
        const coffee = currentCoffee();
        if (coffee.quality < t.minCoffeeQuality) {
            return { ok: false, reason: 'Sędziowie na tym szczeblu wymagają ziarna o jakości min. ' + t.minCoffeeQuality.toFixed(2) + ' (masz ' + coffee.name + ', jakość ' + coffee.quality.toFixed(2) + ').' };
        }
        return { ok: true };
    }

    function buildControls() {
        const host = document.getElementById(mode + '-controls');
        host.innerHTML = buildControlsSkeleton(mode);

        // Etap M2: start prezentacji w doku przyklejonym do dołu ekranu.
        // `btn-brew-comp` zostaje ukrytą atrapą — refreshReadouts() blokuje
        // oba przyciski trybu jednym kodem wspólnym z Laboratorium, a na
        // zawodach auto-parzenie nie istnieje.
        renderDock('dock-' + mode,
            setupSummaryHtml(mode) +
            progressBarHtml(mode) +
            '<button id="btn-pour-comp" onclick="launchPour(\'comp\')" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3.5 px-4 rounded-lg shadow text-base md:text-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">' +
            '<i class="fas fa-play mr-2"></i>Rozpocznij prezentację</button>' +
            '<button id="btn-brew-comp" class="hidden"></button>' +
            '<p class="text-[11px] text-stone-500 text-center mt-2">Na zawodach parzysz wyłącznie ręcznie — sędziowie oceniają też przebieg pracy.</p>');

        if (!activeTierId) {
            const firstUnlocked = COMPETITIONS.find(isTierUnlocked);
            activeTierId = firstUnlocked ? firstUnlocked.id : COMPETITIONS[0].id;
        }
        refresh();
    }

    // Wołane po KAŻDEJ zmianie stanu gracza (przez updateTopBar) i przy wejściu
    // w widok Konkursu — drabinka i hero muszą reagować na świeżo zdobytą
    // reputację/sławę/wygraną bez ręcznego wołania w kilku miejscach naraz.
    function refresh() {
        renderLadder();
        renderHero();
        refreshReadouts(mode);
    }

    function renderLadder() {
        const host = document.getElementById('comp-ladder');
        if (!host) return;
        host.innerHTML = COMPETITIONS.map(t => {
            const unlocked = isTierUnlocked(t);
            const won = PlayerProfile.hasWonComp(t.id);
            const active = t.id === activeTierId;
            const icon = won ? '<i class="fas fa-crown text-amber-500"></i>' : unlocked ? '<i class="fas fa-unlock text-emerald-500"></i>' : '<i class="fas fa-lock text-stone-400"></i>';
            const statusLabel = won ? '<span class="text-amber-600 font-semibold text-xs whitespace-nowrap">Wygrane</span>'
                : unlocked ? '<span class="text-emerald-600 font-semibold text-xs whitespace-nowrap">Dostępne</span>'
                : '<span class="text-stone-400 text-xs whitespace-nowrap">Zablokowane</span>';
            const cls = 'flex items-center justify-between gap-3 p-3 rounded-lg border text-sm transition-colors ' +
                (active ? 'border-amber-500 bg-amber-50' : unlocked ? 'border-stone-200 bg-white hover:border-amber-300 cursor-pointer' : 'border-stone-200 bg-stone-100 opacity-70');
            const onclick = unlocked ? ' onclick="Konkursy.selectTier(\'' + t.id + '\')"' : '';
            return '<div class="' + cls + '"' + onclick + '>' +
                '<div class="flex items-center gap-3 min-w-0">' + icon +
                '<div class="min-w-0"><span class="block text-[10px] uppercase tracking-wider text-stone-500">Szczebel ' + t.tier + '</span>' +
                '<strong class="text-stone-800">' + t.name + '</strong><span class="text-stone-500">, ' + t.place + '</span></div></div>' +
                statusLabel + '</div>';
        }).join('');
    }

    function selectTier(id) {
        const t = COMPETITIONS.find(c => c.id === id);
        if (!t || !isTierUnlocked(t)) return;
        activeTierId = id;
        document.getElementById('comp-idle').classList.remove('hidden');
        document.getElementById('comp-result').classList.add('hidden');
        renderSensoryPlaceholder('comp-sensory');
        refresh();
    }

    function renderHero() {
        const t = activeTier();
        const coffee = currentCoffee();
        const entry = checkEntry();
        setText('comp-hero-tier', 'Szczebel ' + t.tier + (t.isFinal ? ' · finał' : ''));
        setText('comp-hero-name', t.name);
        setText('comp-hero-place', t.place);
        setText('comp-hero-desc', t.desc);
        setText('comp-hero-threshold', (t.threshold * 100).toFixed(0) + '%');
        const reqEl = document.getElementById('comp-hero-coffee-req');
        if (reqEl) {
            reqEl.textContent = 'Wymagane ziarno: jakość ≥ ' + t.minCoffeeQuality.toFixed(2) + ' — masz ' + coffee.name + ' (' + coffee.quality.toFixed(2) + ')' + (entry.ok ? '' : ' — za słabe');
            reqEl.className = 'text-xs mt-2 ' + (entry.ok ? 'text-emerald-300' : 'text-red-300 font-semibold');
        }
        // Blokadę przycisku liczy WYŁĄCZNIE refreshReadouts() (wołane zaraz po
        // renderHero() w refresh()) — to jedyne miejsce, które zna WSZYSTKIE
        // trzy powody blokady naraz (animacja / zapas / jakość ziarna) i potrafi
        // też z powrotem odblokować, gdy żaden już nie zachodzi.
    }

    function showResult(r) {
        const t = activeTier();
        document.getElementById('comp-idle').classList.add('hidden');
        document.getElementById('comp-result').classList.remove('hidden');
        renderSensory('comp-sensory', r.sensory);

        const won = r.sensory.pct >= t.threshold;
        document.getElementById('comp-score').textContent = (r.sensory.pct * 100).toFixed(1) + '%';
        const icon = document.getElementById('comp-icon');
        const title = document.getElementById('comp-title');
        const desc = document.getElementById('comp-desc');

        if (won) {
            const firstWin = PlayerProfile.winComp(t.id, t.rewardRep, t.rewardFame);
            icon.innerHTML = '<i class="fas fa-trophy text-amber-500"></i>';
            title.textContent = 'Zwycięstwo!';
            title.className = 'text-2xl font-bold mb-2 text-amber-600';
            desc.textContent = 'Sędziowie są zgodni. ' + r.verdict + ' Puchar szczebla ' + t.tier + ' Twój.';
            if (firstWin) {
                let extra = ' +' + t.rewardFame + ' sławy.';
                if (t.sponsorIncome > 0) extra += ' Nowy kontrakt reklamowy: +' + t.sponsorIncome + ' PLN/dzień pasywnie.';
                if (t.unlocksBrand) extra += ' Odblokowałeś własną markę kawy w Sklepie!';
                if (t.isFinal) extra += ' To szczyt kariery — World Brewers Cup zdobyty.';
                showModal('Puchar zdobyty!', 'Wynik ' + (r.sensory.pct * 100).toFixed(1) + '%.' + extra, 'fa-crown', 'text-amber-500');
            } else {
                showModal('Znowu zwycięstwo!', 'Wynik ' + (r.sensory.pct * 100).toFixed(1) + '%. Ten szczebel już masz wygrany — spróbuj pobić własny rekord.', 'fa-crown', 'text-amber-500');
            }
        } else {
            icon.innerHTML = '<i class="fas fa-times-circle text-red-500"></i>';
            title.textContent = 'Brak kwalifikacji';
            title.className = 'text-2xl font-bold mb-2 text-red-600';
            desc.textContent = 'Panel odrzucił napar (próg ' + (t.threshold * 100).toFixed(0) + '%). ' + r.verdict + ' Wróć do laboratorium i popraw nastaw albo sprzęt.';
        }
    }

    return { mode, buildControls, refresh, showResult, selectTier, checkEntry };
})();
