// =============================================================================
// main.js — bootstrap gry.
// Jedyne miejsce, które koordynuje moduły z zewnątrz (przełączanie widoków,
// pasek u góry). Same moduły o sobie nawzajem nie wiedzą.
// =============================================================================

function updateTopBar() {
    setText('ui-money', PlayerProfile.getMoney() + ' PLN');
    setText('ui-rep', PlayerProfile.getReputation() + ' pkt');
    const best = PlayerProfile.getBest();
    setText('ui-best', best === null ? '—' : best.toFixed(1) + '/63');

    if (PlayerProfile.getReputation() >= REQ_REP_COMP && !PlayerProfile.isCompUnlocked()) {
        PlayerProfile.unlockComp();
        const l = document.getElementById('comp-lock-icon');
        l.className = 'absolute top-1 right-3 text-xs text-emerald-400';
        l.innerHTML = '<i class="fas fa-unlock"></i>';
        document.getElementById('nav-konkurs').classList.remove('opacity-50');
        showModal('Nowy etap', 'Masz ' + REQ_REP_COMP + ' punktów reputacji — możesz zapisać się na Puchar Kawiarni Sąsiedzkiej.', 'fa-trophy', 'text-amber-500');
    }

    Kawiarnia.renderEquipmentPanel();
}

function switchView(view) {
    if (view === 'konkurs' && !PlayerProfile.isCompUnlocked()) {
        showModal('Brak dostępu', 'Potrzebujesz ' + REQ_REP_COMP + ' punktów reputacji. Pracuj w kawiarni.', 'fa-lock', 'text-red-500');
        return;
    }
    ['kawiarnia', 'sklep', 'laboratorium', 'konkurs'].forEach(v => {
        document.getElementById('view-' + v).classList.add('view-hidden');
        document.getElementById('nav-' + v).classList.remove('border-amber-500', 'text-white');
    });
    document.getElementById('view-' + view).classList.remove('view-hidden');
    document.getElementById('nav-' + view).classList.add('border-amber-500', 'text-white');
    if (view === 'sklep') Sklep.render();
    if (view === 'laboratorium') refreshReadouts('lab');
    if (view === 'konkurs') refreshReadouts('comp');
}

window.onload = function () {
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
        if (e.key === 'Escape' && !modalBackdrop.classList.contains('pointer-events-none')) closeModal();
    });
    setTimeout(() => showModal('Witaj, Baristo!',
        'W Laboratorium masz dwa tryby: auto-parzenie do szybkiego szukania nastawu i parzenie ręczne, w którym sam prowadzisz strumień po złożu. Na zawodach dostępne jest wyłącznie parzenie ręczne.',
        'fa-mug-hot', 'text-amber-600'), 400);
};
