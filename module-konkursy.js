// =============================================================================
// module-konkursy.js — moduł Konkursów.
// Odpowiada wyłącznie za panel zawodów i werdykt sędziowski.
// Pipeline parzenia (launchPour/startBrewing) jest współdzielony w ui-shared.js
// — ten moduł dostaje gotowy wynik i decyduje, jak go ocenić i pokazać.
// =============================================================================
const Konkursy = (function () {
    const mode = 'comp';

    function buildControls() {
        const host = document.getElementById(mode + '-controls');
        let html = buildControlsSkeleton(mode);
        html += '<button id="btn-pour-comp" onclick="launchPour(\'comp\')" class="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 px-4 rounded-lg shadow text-lg disabled:opacity-50 disabled:cursor-not-allowed"><i class="fas fa-play mr-2"></i>Rozpocznij prezentację</button>';
        html += '<p class="text-[11px] text-stone-500 text-center">Na zawodach parzysz wyłącznie ręcznie — sędziowie oceniają też przebieg pracy.</p>';
        html += '<button id="btn-brew-comp" class="hidden"></button>';
        html += progressBarHtml(mode);
        host.innerHTML = html;
        refreshReadouts(mode);
    }

    function showResult(r) {
        document.getElementById('comp-idle').classList.add('hidden');
        document.getElementById('comp-result').classList.remove('hidden');
        renderSensory('comp-sensory', r.sensory);

        const won = r.sensory.pct >= COMP_THRESHOLD;
        document.getElementById('comp-score').textContent = (r.sensory.pct * 100).toFixed(1) + '%';
        const icon = document.getElementById('comp-icon');
        const title = document.getElementById('comp-title');
        const desc = document.getElementById('comp-desc');

        if (won) {
            const firstWin = !PlayerProfile.isCompWon();
            PlayerProfile.setCompWon();
            if (firstWin) PlayerProfile.addReputation(25);
            icon.innerHTML = '<i class="fas fa-trophy text-amber-500"></i>';
            title.textContent = 'Zwycięstwo!';
            title.className = 'text-2xl font-bold mb-2 text-amber-600';
            desc.textContent = 'Sędziowie są zgodni. ' + r.verdict + ' Puchar Dzielnicy Twój.';
            if (firstWin) {
                showModal('Puchar zdobyty!', 'Wynik ' + (r.sensory.pct * 100).toFixed(1) + '%. Spróbuj teraz pobić własny rekord przy trudniejszym ziarnie.', 'fa-crown', 'text-amber-500');
            } else {
                showModal('Znowu zwycięstwo!', 'Wynik ' + (r.sensory.pct * 100).toFixed(1) + '%. Puchar już masz — spróbuj pobić własny rekord przy trudniejszym ziarnie.', 'fa-crown', 'text-amber-500');
            }
        } else {
            icon.innerHTML = '<i class="fas fa-times-circle text-red-500"></i>';
            title.textContent = 'Brak kwalifikacji';
            title.className = 'text-2xl font-bold mb-2 text-red-600';
            desc.textContent = 'Panel odrzucił napar. ' + r.verdict + ' Wróć do laboratorium i popraw nastaw albo sprzęt.';
        }
    }

    return { mode, buildControls, showResult };
})();
