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

// `step` to rozdzielczość suwaka, `bump` — skok jednego tapnięcia w przycisk
// plus/minus (Etap M4). Rozdzielają się, bo krok suwaka dobrany do precyzji
// myszy jest na palec bezużyteczny: przy przemiale 350-1200 µm co 10 µm jeden
// piksel ekranu 375 px to ~3 µm, więc w mielenie nie da się trafić inaczej niż
// przyciskiem. `presets` to wartości, które w parzeniu faktycznie się nastawia.
const SLIDERS = [
    { key: 'dose',  label: 'Doza kawy',      min: 10,  max: 30,   step: 0.5, bump: 0.5, unit: 'g',  accent: 'accent-amber-700' },
    { key: 'water', label: 'Woda',           min: 150, max: 450,  step: 5,   bump: 5,   unit: 'g',  accent: 'accent-blue-600',
      ratioPresets: [15, 16, 17] },
    // Przemiał: rozdzielczość podniesiona z 10 na 25 µm. `bump` MUSI być
    // wielokrotnością `step`, bo setParam() przyciąga wynik do kroku — przy
    // step 10 i bump 25 tapnięcie przesuwało nastaw raz o 20, raz o 30 µm.
    // 25 µm to zresztą uczciwsza rozdzielczość niż 10: żaden młynek nie jest
    // powtarzalny do 10 µm mediany.
    { key: 'grind', label: 'Mediana przemiału', min: 350, max: 1200, step: 25, bump: 25, unit: 'µm', accent: 'accent-stone-700',
      presets: [{ label: 'Drobno', value: 550 }, { label: 'Średnio', value: 700 }, { label: 'Grubo', value: 900 }] },
    { key: 'temp',  label: 'Temperatura wody',  min: 82,  max: 99,  step: 0.5, bump: 0.5, unit: '°C', accent: 'accent-red-600',
      presets: [{ label: '88°', value: 88 }, { label: '93°', value: 93 }, { label: '96°', value: 96 }] }
];

function clampParam(v, min, max) { return v < min ? min : v > max ? max : v; }

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
    let html = '<h3 class="controls-title font-bold border-b pb-2 text-stone-700">Parametry nastawu</h3>';
    for (const s of SLIDERS) {
        html += '<div>' +
            '<div class="flex items-center justify-between gap-2 mb-1">' +
            '<span class="text-sm font-semibold">' + s.label + '</span>' +
            '<span class="flex items-center gap-1">' +
            stepperBtnHtml(mode, s.key, -1) +
            '<span id="' + mode + '-val-' + s.key + '" class="mono text-amber-700 font-bold text-sm w-[4.5rem] text-center"></span>' +
            stepperBtnHtml(mode, s.key, 1) +
            '</span></div>' +
            '<input type="range" id="' + mode + '-' + s.key + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + params[mode][s.key] + '" class="touch-slider w-full ' + s.accent + '" oninput="onSlider(\'' + mode + '\',\'' + s.key + '\')">' +
            presetsHtml(mode, s) +
            '</div>';
    }
    html += '<div class="readout-box bg-white rounded border border-stone-200 p-3 text-xs space-y-1 mono">' +
            '<div class="flex justify-between"><span class="text-stone-500">Brew ratio</span><span id="' + mode + '-out-ratio" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Szacowany czas kontaktu</span><span id="' + mode + '-out-time" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Udział pyłu (&lt;200 µm)</span><span id="' + mode + '-out-fines" class="font-bold"></span></div>' +
            '<div class="flex justify-between"><span class="text-stone-500">Zapas ziarna</span><span id="' + mode + '-out-coffee" class="font-bold"></span></div>' +
            '</div>';
    return html;
}

// ---------- Karta wyniku z zakładkami (Etap M5) ----------
// Zakładki istnieją tylko na telefonie (pasek ma klasę md:hidden), ale ich
// stan trzymamy zawsze — na desktopie wszystkie panele i tak są widoczne,
// więc showResultPane() jest tam nieszkodliwe. Klucze paneli są wspólne dla
// obu trybów, różnią się wyłącznie etykiety.
const RESULT_PANES = ['wynik', 'sensoryka', 'wykres'];

function buildResultTabs(mode, labels) {
    const host = document.getElementById(mode + '-tabs');
    if (!host) return;
    host.innerHTML = RESULT_PANES.map(function (key, i) {
        return '<button type="button" role="tab" id="' + mode + '-tab-' + key + '" ' +
            'aria-controls="' + mode + '-pane-' + key + '" aria-selected="' + (i === 0) + '" ' +
            'onclick="showResultPane(\'' + mode + '\',\'' + key + '\')" ' +
            'class="result-tab' + (i === 0 ? ' tab-on' : '') + '">' + labels[key] + '</button>';
    }).join('');
}

function showResultPane(mode, key) {
    RESULT_PANES.forEach(function (k) {
        const pane = document.getElementById(mode + '-pane-' + k);
        const tab = document.getElementById(mode + '-tab-' + k);
        if (pane) pane.classList.toggle('pane-active', k === key);
        if (tab) {
            tab.classList.toggle('tab-on', k === key);
            tab.setAttribute('aria-selected', k === key ? 'true' : 'false');
        }
    });
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

// ---------- Kontrolery dotykowe (Etap M4) ----------
function stepperBtnHtml(mode, key, dir) {
    return '<button type="button" id="' + mode + '-' + key + '-' + (dir < 0 ? 'dec' : 'inc') + '" ' +
        'onclick="bumpParam(\'' + mode + '\',\'' + key + '\',' + dir + ')" ' +
        'aria-label="' + (dir < 0 ? 'Zmniejsz' : 'Zwiększ') + '" ' +
        'class="w-11 h-11 md:w-9 md:h-9 shrink-0 flex items-center justify-center rounded-lg border border-stone-300 bg-white text-stone-700 ' +
        'active:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed">' +
        '<i class="fas fa-' + (dir < 0 ? 'minus' : 'plus') + ' text-xs" aria-hidden="true"></i></button>';
}

function presetChipHtml(onclick, label) {
    return '<button type="button" onclick="' + onclick + '" ' +
        'class="preset-chip px-3 rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-600 active:bg-amber-100 active:border-amber-400">' +
        label + '</button>';
}

// Woda dostaje presety brew ratio, nie gramów — 1:16 znaczy to samo przy
// każdej dozie, a « 240 g » już nie.
function presetsHtml(mode, s) {
    let chips = '';
    if (s.presets) {
        chips = s.presets.map(function (pr) {
            return presetChipHtml('setParam(\'' + mode + '\',\'' + s.key + '\',' + pr.value + ')', pr.label);
        }).join('');
    } else if (s.ratioPresets) {
        chips = s.ratioPresets.map(function (r) {
            return presetChipHtml('setRatio(\'' + mode + '\',' + r + ')', '1:' + r);
        }).join('');
    }
    return chips ? '<div class="flex flex-wrap gap-1.5 mt-2">' + chips + '</div>' : '';
}

// Wspólne wejście dla przycisków, presetów i suwaka: jedno miejsce, które
// przycina do zakresu i przyciąga do kroku suwaka, żeby arytmetyka
// zmiennoprzecinkowa nie wyprodukowała nastawu typu 93.30000000000001.
function setParam(mode, key, value) {
    const s = SLIDERS.find(function (x) { return x.key === key; });
    if (!s) return;
    const snapped = Math.round(clampParam(value, s.min, s.max) / s.step) * s.step;
    params[mode][key] = parseFloat(snapped.toFixed(4));
    const el = document.getElementById(mode + '-' + key);
    if (el) el.value = params[mode][key];
    refreshReadouts(mode);
}

function bumpParam(mode, key, dir) {
    const s = SLIDERS.find(function (x) { return x.key === key; });
    if (s) setParam(mode, key, params[mode][key] + dir * (s.bump || s.step));
}

function setRatio(mode, ratio) {
    setParam(mode, 'water', params[mode].dose * ratio);
}

// ---------- Pasek podsumowania nastawu (Etap M3) ----------
// Zastępuje na telefonie cały panel suwaków: pokazuje nastaw i to, co z niego
// wynika, w dwóch wierszach, a tapnięcie otwiera szufladę z suwakami. Dzięki
// temu pętla « zmień nastaw -> parz -> zobacz wynik » mieści się bez
// przewijania, zamiast kosztować dwa pełne przewinięcia na każdą próbę.
function setupSummaryHtml(mode) {
    return '<button type="button" onclick="openSheet(\'' + mode + '\')" ' +
        'class="md:hidden w-full flex items-center gap-2 mb-2 px-3 py-2 bg-stone-100 hover:bg-stone-200 active:bg-stone-200 border border-stone-200 rounded-lg text-left">' +
        '<i class="fas fa-sliders text-stone-500 shrink-0" aria-hidden="true"></i>' +
        '<span class="flex-1 min-w-0 mono text-[11px] leading-snug">' +
        '<span id="' + mode + '-sum-params" class="block truncate text-stone-800 font-bold"></span>' +
        '<span id="' + mode + '-sum-derived" class="block truncate text-stone-500"></span>' +
        '</span>' +
        '<span class="text-xs font-semibold text-amber-700 shrink-0">Zmień</span></button>';
}

// ---------- Szuflada nastawu (Etap M3) ----------
// Panel suwaków jest PRZENOSZONY do szuflady i z powrotem, nie duplikowany —
// dwa komplety suwaków o tych samych id rozjechałyby refreshReadouts().
// Miejsce powrotu zapamiętujemy przez kotwicę (następne rodzeństwo), bo panel
// nie zawsze jest ostatnim dzieckiem swojego kontenera.
let sheetState = null;

function openSheet(mode) {
    if (sheetState) return;
    const panel = document.getElementById(mode + '-controls');
    const body = document.getElementById('sheet-body');
    if (!panel || !body) return;
    sheetState = { panel: panel, parent: panel.parentNode, before: panel.nextSibling };
    panel.classList.add('in-sheet');
    body.appendChild(panel);
    body.scrollTop = 0;
    document.getElementById('sheet').classList.add('sheet-open');
    document.getElementById('sheet-backdrop').classList.add('sheet-open');
}

function closeSheet() {
    if (!sheetState) return;
    document.getElementById('sheet').classList.remove('sheet-open');
    document.getElementById('sheet-backdrop').classList.remove('sheet-open');
    const st = sheetState;
    sheetState = null;
    // Powrót panelu dopiero po animacji zjazdu — inaczej znikałby w trakcie.
    setTimeout(function () {
        st.panel.classList.remove('in-sheet');
        st.parent.insertBefore(st.panel, st.before);
    }, 300);
}

function progressBarHtml(mode) {
    return '<div id="' + mode + '-progress-container" class="h-2 w-full bg-stone-200 rounded-full overflow-hidden hidden mb-2"><div id="' + mode + '-progress" class="h-full bg-amber-600 progress-bar-fill" style="width:0%"></div></div>';
}

// Przeciąganie suwaka sypie zdarzeniami `input` gęściej niż klatkami, a każde
// przeliczenie to particleBins + contactTime + pełne przerysowanie wykresu.
// Sklejamy je do jednego przeliczenia na klatkę (Etap M4) — bez tego suwak
// na telefonie zauważalnie się zacina.
const readoutFrame = { lab: 0, comp: 0 };

function onSlider(mode, key) {
    params[mode][key] = parseFloat(document.getElementById(mode + '-' + key).value);
    if (readoutFrame[mode]) return;
    readoutFrame[mode] = requestAnimationFrame(function () {
        readoutFrame[mode] = 0;
        refreshReadouts(mode);
    });
}

function refreshReadouts(mode) {
    const p = params[mode];
    for (const s of SLIDERS) {
        const el = document.getElementById(mode + '-val-' + s.key);
        if (el) el.textContent = p[s.key].toFixed(s.step < 1 ? 1 : 0) + ' ' + s.unit;
        // Stepper wygaszony na krańcu zakresu — inaczej tapnięcie w plus przy
        // 99°C nie robi nic i wygląda na zepsuty przycisk (Etap M4).
        const dec = document.getElementById(mode + '-' + s.key + '-dec');
        const inc = document.getElementById(mode + '-' + s.key + '-inc');
        if (dec) dec.disabled = p[s.key] <= s.min;
        if (inc) inc.disabled = p[s.key] >= s.max;
    }
    const eq = currentEquipment(), coffee = currentCoffee();
    const bins = BrewEngine.particleBins(p.grind, eq.grinder.gsd);
    const t = BrewEngine.contactTime({ dose: p.dose, water: p.water, grind: p.grind }, eq, coffee, bins);
    const fines = bins.reduce((a, b) => a + (b.d < 200 ? b.w : 0), 0) * 100;
    const ratio = p.water / p.dose;

    const timeStr = Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0');
    setText(mode + '-out-ratio', '1:' + ratio.toFixed(1));
    setText(mode + '-out-time', timeStr);
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
    // Pasek podsumowania w doku (Etap M3) — jedyny widok nastawu na telefonie,
    // więc musi nieść komplet: sam nastaw i to, co z niego wynika.
    setText(mode + '-sum-params', p.dose.toFixed(1) + ' g · ' + p.water.toFixed(0) + ' g · ' +
        p.grind.toFixed(0) + ' µm · ' + p.temp.toFixed(1) + '°C');
    // Zapas ziarna dopisujemy tylko wtedy, gdy realnie blokuje parzenie —
    // w komplecie druga linia ucinała się na 375 px, a przy pełnym zapasie
    // jest to informacja bez konsekwencji (w szufladzie widać ją zawsze).
    const stock = PlayerProfile.getCurrentCoffeeStock();
    setText(mode + '-sum-derived', '1:' + ratio.toFixed(1) + ' · ' + timeStr + ' · pył ' +
        fines.toFixed(1) + '%' + (stock < p.dose ? ' · brak ziarna (' + stock + ' g)' : ''));

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
            // Etap M5: po zaparzeniu pokazujemy wynik, a nie zostawiamy gracza
            // na zakładce, którą akurat oglądał. Karta jest podciągana pod
            // górną krawędź, bo na telefonie stoi niżej niż dok, z którego
            // właśnie padło kliknięcie.
            showResultPane(mode, 'wynik');
            const card = document.getElementById(mode + '-result-card');
            if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 40);
}
