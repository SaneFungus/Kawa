// =============================================================================
// main.js — bootstrap gry.
// Jedyne miejsce, które koordynuje moduły z zewnątrz (przełączanie widoków,
// pasek u góry). Same moduły o sobie nawzajem nie wiedzą.
// =============================================================================

function updateTopBar() {
    setText('ui-money', PlayerProfile.getMoney() + ' PLN');
    setText('ui-rep', PlayerProfile.getReputation() + ' pkt');
    setText('ui-fame', PlayerProfile.getFame() + ' pkt');
    const best = PlayerProfile.getBest();
    setText('ui-best', best === null ? '—' : best.toFixed(1) + '/63');
    setText('ui-day', PlayerProfile.getDay());

    if (PlayerProfile.getReputation() >= REQ_REP_COMP && !PlayerProfile.isCompUnlocked()) {
        PlayerProfile.unlockComp();
        const l = document.getElementById('comp-lock-icon');
        l.className = 'absolute top-1 right-3 text-xs text-emerald-400';
        l.innerHTML = '<i class="fas fa-unlock"></i>';
        document.getElementById('nav-konkurs').classList.remove('opacity-50');
        // Etap M1: ta sama zmiana w dolnym pasku zakładek — kłódka przy
        // etykiecie znika w całości, bo w 11-punktowym podpisie ikona
        // "otwartej kłódki" jest nieczytelna.
        const tl = document.getElementById('tab-comp-lock-icon');
        if (tl) tl.remove();
        document.getElementById('tab-konkurs').classList.remove('tab-locked');
        showModal('Nowy etap', 'Masz ' + REQ_REP_COMP + ' punktów reputacji — możesz zapisać się na Otwarte Mistrzostwa Świdnicy.', 'fa-trophy', 'text-amber-500');
    }

    Kawiarnia.renderEquipmentPanel();
    Kawiarnia.renderLocationPanel();
    Konkursy.refresh();
}

// Etap M1: na telefonie pasek u góry pokazuje tylko trzy wskaźniki, które
// zmieniają się w trakcie zwykłej pętli gry (budżet, reputacja, dzień).
// Sława i rekord to wskaźniki, do których zagląda się okazjonalnie — siedzą
// pod rozwinięciem, żeby nagłówek mieścił się w jednym wierszu.
function toggleStats() {
    const expanded = document.body.classList.toggle('stats-expanded');
    const btn = document.getElementById('btn-stats-toggle');
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.setAttribute('aria-label', expanded ? 'Ukryj sławę i rekord' : 'Pokaż sławę i rekord');
    document.getElementById('stats-toggle-icon').className =
        'fas text-xs ' + (expanded ? 'fa-chevron-up' : 'fa-chevron-down');
}

function switchView(view) {
    // Etap M3: szuflada nastawu należy do konkretnego trybu (jej panel jest
    // fizycznie przeniesiony z widoku), więc nie może przeżyć przełączenia.
    closeSheet();
    if (view === 'konkurs' && !PlayerProfile.isCompUnlocked()) {
        showModal('Brak dostępu', 'Potrzebujesz ' + REQ_REP_COMP + ' punktów reputacji. Pracuj w kawiarni.', 'fa-lock', 'text-red-500');
        return;
    }
    ['kawiarnia', 'sklep', 'laboratorium', 'konkurs'].forEach(v => {
        document.getElementById('view-' + v).classList.add('view-hidden');
        document.getElementById('nav-' + v).classList.remove('border-amber-500', 'text-white');
        document.getElementById('tab-' + v).classList.remove('tab-active');
    });
    document.getElementById('view-' + view).classList.remove('view-hidden');
    document.getElementById('nav-' + view).classList.add('border-amber-500', 'text-white');
    document.getElementById('tab-' + view).classList.add('tab-active');
    // Widoki są przełączane w JEDNYM kontenerze przewijania (<main>), więc bez
    // tego zakładka otwarta po zescrollowaniu poprzedniej zaczynałaby się w
    // połowie treści. Na telefonie to było praktycznie nie do zauważenia jako
    // "przełączyłem widok" — wyglądało na pustą stronę.
    document.querySelector('main').scrollTop = 0;
    if (view === 'sklep') Sklep.render();
    if (view === 'laboratorium') refreshReadouts('lab');
    if (view === 'konkurs') Konkursy.refresh();
}

window.onload = function () {
    Kawiarnia.renderStations();
    Lab.buildControls();
    Konkursy.buildControls();
    renderSensoryPlaceholder('lab-sensory');
    renderSensoryPlaceholder('comp-sensory');

    // Zamiast każdej funkcji w grze pamiętać "zaktualizuj pasek u góry" —
    // subskrybujemy się raz na dowolną zmianę stanu gracza.
    PlayerProfile.on('change', updateTopBar);
    updateTopBar();
    switchView('kawiarnia');

    const modalBackdrop = document.getElementById('custom-modal');
    modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        // Modal leży nad szufladą, więc Escape zamyka najpierw to, co na wierzchu.
        if (!modalBackdrop.classList.contains('pointer-events-none')) closeModal();
        else closeSheet();
    });

    // StoryEvents.init() pokazuje Prolog przy pierwszej sesji gracza (raz,
    // zapamiętane w PlayerProfile) i subskrybuje resztę scen fabularnych.
    // Gdy Prolog właśnie zajął modal, powitalny tutorial czeka dłużej, żeby
    // go nie nadpisać, zanim gracz zdąży przeczytać.
    const prologShown = StoryEvents.init();
    setTimeout(() => showModal('Witaj, Baristo!',
        'W Laboratorium masz dwa tryby: auto-parzenie do szybkiego szukania nastawu i parzenie ręczne, w którym sam prowadzisz strumień po złożu. Na zawodach dostępne jest wyłącznie parzenie ręczne.',
        'fa-mug-hot', 'text-amber-600'), prologShown ? 4500 : 400);
};
