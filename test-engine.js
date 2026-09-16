// =============================================================================
// test-engine.js — regresja punktu kalibracyjnego BrewEngine.
// Uruchamiane ręcznie: `node test-engine.js`. Zero frameworka testowego (repo
// świadomie nie ma menedżera pakietów) — czysty Node + BrewEngine.brew().
//
// Sprawdza punkt odniesienia opisany w komentarzu engine.js: 15 g kawy / 250 g
// wody / 700 µm mediana przemiału / 93°C / Hario V60 / Comandante C40 / kawa
// jak Brazylia Fazenda 83 (database.coffee c2) / woda referencyjna SCA
// (GH 100, KH 40 ppm) => EY 20,95% · TDS 1,43% · σ 0,87 · czas kontaktu 165 s.
// Przy zmianie stałych fizycznych w engine.js (K0, DIFF_EXP, PERM_EXP, F_FAST,
// K_FAST, EA, GH_EXP, KH_FLAT_SPAN, CHANNEL_SIGMA_COEF...) ten punkt się
// przesunie — to sygnał, żeby świadomie zaktualizować liczby TU I w komentarzu
// engine.js, a nie że test jest zepsuty.
// =============================================================================
const BrewEngine = require('./engine.js');
const { database } = require('./database.js');

let failures = 0;
function assertClose(label, actual, expected, tol) {
    const ok = Math.abs(actual - expected) <= tol;
    console.log((ok ? 'OK  ' : 'FAIL') + '  ' + label + ': ' + actual + ' (oczekiwano ' + expected + ' ±' + tol + ')');
    if (!ok) failures++;
}

// Kettle bez odpowiednika w database.js — kalibracja wymaga zerowego dryfu
// temperatury i jakości nalewania 1.0, żeby wynik był deterministyczny i nie
// wymagał uśredniania po seedach.
const referenceKettle = { pourQuality: 1.0, tempDrift: 0 };

const eq = {
    grinder: database.grinder.find(g => g.id === 'g4'), // Comandante C40
    dripper: database.dripper.find(d => d.id === 'd2'), // Hario V60-02
    kettle: referenceKettle
};
const coffee = database.coffee.find(c => c.id === 'c2'); // Brazylia Fazenda 83
const params = { dose: 15, water: 250, grind: 700, temp: 93 };
const water = { gh: BrewEngine.constants.GH_REF, kh: BrewEngine.constants.KH_REF };

const r = BrewEngine.brew(params, eq, coffee, 1, water);

assertClose('EY [%]', r.ey, 20.95, 0.01);
assertClose('TDS [%]', r.tds, 1.429, 0.001);
assertClose('sigma', r.sigma, 0.87, 0.01);
assertClose('czas kontaktu [s]', r.time, 165, 0);

if (failures > 0) {
    console.error('\n' + failures + ' asercja(e) nie przeszła — sprawdź, czy zmiana stałych w engine.js była zamierzona.');
    process.exit(1);
} else {
    console.log('\nPunkt kalibracyjny BrewEngine bez zmian.');
}
