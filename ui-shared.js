// =============================================================================
// ui-shared.js — wspólne narzędzia prezentacyjne + pipeline parzenia.
// Czysto prezentacyjne helpery i generyczna "instalacja" panelu suwaków —
// używane przez kilka modułów naraz. Nie trzymają logiki żadnego konkretnego
// modułu (Kawiarnia/Lab/Konkursy/Sklep decydują same, co pokazać z wynikiem).
// =============================================================================

// Stan suwaków w Lab i Konkursie — czysto UI, nie jest częścią PlayerProfile.
const params = {
    lab:  { dose: 15, water: 250, grind: 700, temp: 93 },
    comp: { dose: 15, water: 250, grind: 700, temp: 93 }
};

// Czy w tym trybie trwa właśnie animacja parzenia — refreshReadouts() musi to
// znać, bo sam stan przycisku (disabled) nie mówi PRZYCZYNY: w trakcie
// parzenia czy z braku ziarna. Bez tego rozróżnienia dokupienie ziarna w
// trakcie, gdy przycisk był zablokowany z braku zapasu, nigdy by go z powrotem
// nie odblokowało.
const brewingInProgress = { lab: false, comp: false };

const SLIDERS = [
    { key: 'dose',  label: 'Doza kawy',      min: 10,  max: 30,   step: 0.5, unit: 'g',  accent: 'accent-amber-700' },
    { key: 'water', label: 'Woda',           min: 150, max: 450,  step: 5,   unit: 'g',  accent: 'accent-blue-600' },
    { key: 'grind', label: 'Mediana przemiału', min: 350, max: 1200, step: 10, unit: 'µm', accent: 'accent-stone-700' },
    { key: 'temp',  label: 'Temperatura wody',  min: 82,  max: 99,  step: 0.5, unit: '°C', accent: 'accent-red-600' }
];

function setText(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

// ---------- Modal ----------
function showModal(title, text, icon, color) {
    setText('modal-title', title);
    setText('modal-text', text);
    document.getElementById('modal-icon').innerHTML = '<i class="fas ' + (icon || 'fa-info-circle') + '"></i>';
    document.getElementById('modal-icon').className = 'text-4xl mb-4 ' + (color || 'text-amber-500');
    document.getElementById('custom-modal').classList.remove('opacity-0', 'pointer-events-none');
    document.getElementById('custom-modal-content').classList.replace('scale-95', 'scale-100');
}
function closeModal() {
    document.getElementById('custom-modal').classList.add('opacity-0', 'pointer-events-none');
    document.getElementById('custom-modal-content').classList.replace('scale-100', 'scale-95');
}

// ---------- Karta metryki (Lab) ----------
function metricCard(label, value, ok, sub) {
    const color = ok === null ? 'text-stone-200' : ok ? 'text-emerald-400' : 'text-red-400';
    const mark = ok === null ? '' :
        ok ? '<i class="fas fa-circle-check mr-1" aria-hidden="true"></i>' : '<i class="fas fa-circle-xmark mr-1" aria-hidden="true"></i>';
    return '<div class="bg-black/40 p-3 rounded border border-stone-700">' +
        '<span class="block text-[10px] text-stone-400 uppercase tracking-wider">' + label + '</span>' +
        '<span class="text-2xl font-bold mono ' + color + '">' + mark + value + '</span>' +
        '<div class="text-[10px] text-stone-500 mt-0.5">' + (sub || '') + '</div></div>';
}

// ---------- Karta sensoryczna (Lab + Konkursy) ----------
function renderSensory(hostId, sens) {
    const host = document.getElementById(hostId);
    host.classList.remove('opacity-30');
    let html = '';
    for (const key in SENSORY_LABELS) {
        const v = sens.scores[key];
        const pct = (v / 9) * 100;
        const color = v >= 7 ? 'bg-emerald-500' : v >= 5.5 ? 'bg-amber-500' : v >= 4 ? 'bg-orange-400' : 'bg-red-400';
        const icon = v >= 7 ? 'fa-circle-check text-emerald-600' : v >= 5.5 ? 'fa-circle-exclamation text-amber-600' : v >= 4 ? 'fa-triangle-exclamation text-orange-500' : 'fa-circle-xmark text-red-500';
        const bold = key === 'overall' ? ' font-bold' : '';
        html += '<div class="flex items-center gap-3 text-xs' + bold + '">' +
            '<span class="w-32 shrink-0 text-stone-600">' + SENSORY_LABELS[key] + '</span>' +
            '<div class="flex-1 h-2.5 bg-stone-200 rounded-full overflow-hidden">' +
            '<div class="sensory-bar h-full ' + color + ' rounded-full" style="width:' + pct.toFixed(1) + '%"></div></div>' +
            '<i class="fas ' + icon + ' text-[11px]" aria-hidden="true"></i>' +
            '<span class="w-9 text-right mono text-stone-700">' + v.toFixed(2) + '</span></div>';
    }
    html += '<div class="pt-3 mt-2 border-t flex justify-between text-sm font-bold">' +
        '<span>Suma</span><span class="mono">' + sens.total.toFixed(2) + ' / 63 (' + (sens.pct * 100).toFixed(1) + '%)</span></div>';
    host.innerHTML = html;
}

function renderSensoryPlaceholder(hostId) {
    const host = document.getElementById(hostId);
    let html = '';
    for (const key in SENSORY_LABELS) {
        html += '<div class="flex items-center gap-3 text-xs">' +
            '<span class="w-32 shrink-0 text-stone-600">' + SENSORY_LABELS[key] + '</span>' +
            '<div class="flex-1 h-2.5 bg-stone-200 rounded-full"></div>' +
            '<span class="w-9 text-right mono text-stone-400">—</span></div>';
    }
    host.innerHTML = html;
}

// ---------- Wykres ----------
function drawChart(mode, current, liveRatio) {
    BrewingControlChart.render('chart-' + mode, {
        history: PlayerProfile.getHistory(mode),
        current: current,
        liveRatio: liveRatio
    });
}

// ---------- Panel suwaków (współdzielony szkielet Lab/Konkursy) ----------
function buildControlsSkeleton(mode) {
    let html = '<h3 class="font-bold border-b pb-2 text-stone-700">Parametry nastawu</h3>';
    for (const s of SLIDERS) {
        html += '<div>' +
            '<label class="flex justify-between text-sm font-semibold mb-1">' +
            '<span>' + s.label + '</span>' +
            '<span id="' + mode + '-val-' + s.key + '" class="mono text-amber-700"></span>' +
            '</label>' +
            '<input type="range" id="' + mode + '-' + s.key + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + params[mode][s.key] + '" class="w-full ' + s.accent + '" oninput="onSlider(\'' + mode + '\',\'' + s.key + '\')">' +
            '</div>';
    }
    html += '<div class="bg-white rounded border border-stone-200 p-3 text-xs space-y-1 mono">' +
            '<div class="flex justify-between"><span class="text-stone-500">Brew ratio</span><span id="' + mode + '-out-ratio" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Szacowany czas kontaktu</span><span id="' + mode + '-out-time" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Udział pyłu (&lt;200 µm)</span><span id="' + mode + '-out-fines" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Zapas ziarna</span><span id="' + mode + '-out-coffee" class="font-bold"></span></div>' +
            '</div>';
    return html;
}

// ---------- Dok akcji (Etap M2) ----------
// Główna, powtarzalna akcja trybu (parzenie, prezentacja, obsługa klienta)
// mieszka POZA przewijaną treścią — w doku przyklejonym do dolnej krawędzi
// <main>. Wcześniej te przyciski siedziały na końcu panelu nastawu, czyli po
// kilku ekranach przewijania na telefonie; powtórzenie akcji kosztowało wtedy
// scroll w dół po przycisk i scroll w górę po wynik. Moduły budują zawartość
// doku same (różni się w każdym trybie), wspólne jest tylko wstrzyknięcie.
function renderDock(hostId, html) {
    const host = document.getElementById(hostId);
    if (host) host.innerHTML = html;
}

function progressBarHtml(mode) {
    return '<div id="' + mode + '-progress-container" class="h-2 w-full bg-stone-200 rounded-full overflow-hidden hidden mb-2"><div id="' + mode + '-progress" class="h-full bg-amber-600 progress-bar-fill" style="width:0%"></div></div>';
}

function onSlider(mode, key) {
    params[mode][key] = parseFloat(document.getElementById(mode + '-' + key).value);
    refreshReadouts(mode);
}

function refreshReadouts(mode) {
    const p = params[mode];
    for (const s of SLIDERS) {
        const el = document.getElementById(mode + '-val-' + s.key);
        if (el) el.textContent = p[s.key].toFixed(s.step < 1 ? 1 : 0) + ' ' + s.unit;
    }
    const eq = currentEquipment(), coffee = currentCoffee();
    const bins = BrewEngine.particleBins(p.grind, eq.grinder.gsd);
    const t = BrewEngine.contactTime({ dose: p.dose, water: p.water, grind: p.grind }, eq, coffee, bins);
    const fines = bins.reduce((a, b) => a + (b.d < 200 ? b.w : 0), 0) * 100;
    const ratio = p.water / p.dose;

    setText(mode + '-out-ratio', '1:' + ratio.toFixed(1));
    setText(mode + '-out-time', Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0'));
    const fEl = document.getElementById(mode + '-out-fines');
    if (fEl) {
        fEl.textContent = fines.toFixed(1) + '%';
        fEl.className = 'font-bold ' + (fines > 12 ? 'text-red-600' : fines > 6 ? 'text-amber-600' : 'text-emerald-600');
    }

    // Ziarno (Etap 5): pokaż zapas i wylicz PEŁNY stan przycisków z dwóch
    // niezależnych powodów blokady — trwającej animacji parzenia i braku
    // zapasu — żeby dokupienie ziarna zawsze odblokowywało przycisk z powrotem.
    const enoughCoffee = PlayerProfile.hasEnoughActiveCoffee(p.dose);
    const cEl = document.getElementById(mode + '-out-coffee');
    if (cEl) {
        cEl.textContent = PlayerProfile.getCurrentCoffeeStock() + ' g (' + coffee.name + ')';
        cEl.className = 'font-bold ' + (enoughCoffee ? '' : 'text-red-600');
    }
    // Konkurs (Etap 6) dokłada trzeci, niezależny powód blokady: za słabe
    // ziarno na dany szczebel. Liczony tu, w JEDNYM miejscu z pełnym
    // przeliczeniem obu kierunków, żeby dokup/zmiana ziarna zawsze poprawnie
    // odblokowywały przycisk z powrotem (ten sam błąd co przy zapasie w Etapie 5).
    const entryOk = mode !== 'comp' || Konkursy.checkEntry().ok;
    const brewBtn = document.getElementById('btn-brew-' + mode);
    const pourBtn = document.getElementById('btn-pour-' + mode);
    const disabled = brewingInProgress[mode] || !enoughCoffee || !entryOk;
    if (brewBtn) brewBtn.disabled = disabled;
    if (pourBtn) pourBtn.disabled = disabled;

    drawChart(mode, null, ratio);
}

// ---------- Pipeline parzenia (Lab i Konkursy różnią się tylko wynikiem) ----------
function insufficientCoffeeModal(dose) {
    showModal('Brak ziarna', 'Zabrakło ' + currentCoffee().name + ' w zapasie (potrzeba ' + dose + ' g, masz ' + PlayerProfile.getCurrentCoffeeStock() + ' g). Dokup w Sklepie.', 'fa-seedling', 'text-red-500');
}

// Uruchamia mini-grę; jej wynik nadpisuje wodę, agitację i równomierność.
// Zapas sprawdzany PRZED mini-grą — bez sensu grać w nalewanie, żeby na końcu
// dowiedzieć się, że nie było z czego parzyć.
function launchPour(mode) {
    const p = params[mode];
    if (!PlayerProfile.hasEnoughActiveCoffee(p.dose)) { insufficientCoffeeModal(p.dose); return; }
    if (mode === 'comp') {
        const entry = Konkursy.checkEntry();
        if (!entry.ok) { showModal('Za słabe ziarno', entry.reason, 'fa-seedling', 'text-red-500'); return; }
    }
    const eq = currentEquipment();
    PourMinigame.open({
        dose: p.dose, water: p.water, grind: p.grind,
        dripper: eq.dripper, kettle: eq.kettle
    }, function (res) {
        PlayerProfile.setLastPour(mode, res);
        startBrewing(mode, res);
    });
}

function startBrewing(mode, pour) {
    if (!PlayerProfile.hasEnoughActiveCoffee(params[mode].dose)) { insufficientCoffeeModal(params[mode].dose); return; }
    if (!pour) PlayerProfile.setLastPour(mode, null);
    brewingInProgress[mode] = true;
    const btnBrew = document.getElementById('btn-brew-' + mode);
    const btnPour = document.getElementById('btn-pour-' + mode);
    const cont = document.getElementById(mode + '-progress-container');
    const bar = document.getElementById(mode + '-progress');
    if (btnBrew) btnBrew.disabled = true;
    if (btnPour) btnPour.disabled = true;
    cont.classList.remove('hidden');
    bar.style.width = '0%';

    let prog = 0;
    const iv = setInterval(() => {
        prog += 3;
        bar.style.width = prog + '%';
        if (prog >= 100) {
            clearInterval(iv);
            cont.classList.add('hidden');
            brewingInProgress[mode] = false;
            const seed = PlayerProfile.nextSeed(2654435761);
            const p = Object.assign({}, params[mode]);
            if (pour) { p.water = pour.water; p.agitation = pour.agitation; p.evenness = pour.evenness; }
            PlayerProfile.consumeActiveCoffee(p.dose);
            const result = BrewEngine.brew(p, currentEquipment(), currentCoffee(), seed);
            result.pour = pour || null;
            PlayerProfile.pushHistory(mode, { ey: result.ey, tds: result.tds });
            PlayerProfile.updateBest(result.sensory.total);
            if (mode === 'lab') Lab.showResult(result);
            else Konkursy.showResult(result);
            drawChart(mode, result, params[mode].water / params[mode].dose);
            refreshReadouts(mode);
        }
    }, 40);
}
