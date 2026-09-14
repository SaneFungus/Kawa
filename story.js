// =============================================================================
// story.js — StoryEvents, warstwa fabularna (Etap 7).
// Zgodnie z DESIGN.md: moduły mechaniczne (Kawiarnia/Lab/Konkursy/Sklep) nie
// wiedzą nic o fabule, tylko emitują zdarzenia przez PlayerProfile. Ten
// moduł WYŁĄCZNIE nasłuchuje tych zdarzeń i w odpowiednim momencie pokazuje
// scenę fabularną przez showModal() z ui-shared.js.
// =============================================================================
const StoryEvents = (function () {

    const STORY_BEATS = [
        { id: 'prolog', title: 'Olśnienie', icon: 'fa-camera-retro', color: 'text-amber-600',
          text: `Marek Księżarek, fotograf gminny na etacie „kultura i dokumentacja wizualna", fotografuje odsłonięcie tego samego pomnika trzeci raz z rzędu (poprzednie dwa terminy odwołano z powodu „nieprzewidzianych okoliczności lokalowych"). W przerwie jakaś babcia sprzedaje mu z reklamówki kawę z termosu — bez paragonu, bez koncesji, za to najlepszą, jaką kiedykolwiek pił. Marek postanawia rzucić etat i postawić budkę z kawą. Kierownik wydziału obiecuje mu przy pożegnaniu „pozytywną opinię", która nigdy nie nadejdzie.` },

        { id: 'akt2-nauka', title: 'Pani Basia', icon: 'fa-user-graduate', color: 'text-emerald-600',
          text: `Pani Basia, była kierowniczka herbaciarni w Domu Kultury, wygląda jak żywcem z lat 80., ale parzy lepiej niż ktokolwiek w promieniu 50 km. Podpatruje pierwsze próby Marka i wygłasza zdanie, które zapamięta na zawsze: „Młody, jak nie będziesz mierzył, będziesz jak ci z centrali — gadania dużo, a w kubku flejta." Od tej pory Marek zapisuje receptury zamiast parzyć na wyczucie, jak większość okolicznych „znawców kawy".` },

        { id: 'akt3-pierwszy-puchar', title: 'Pierwszy Puchar', icon: 'fa-trophy', color: 'text-amber-500',
          text: `Otwarte Mistrzostwa Świdnicy odbywają się w sali OSP, bo dom kultury jest „w remoncie od 2019". Skład jury: emerytowany nauczyciel WF, radna osiedlowa i pan, który „zna się na kawie, bo był kiedyś w Wiedniu". Mimo to — a może właśnie dlatego — werdykt jest jednogłośny: Marek wygrywa. Radna obiecuje „pełne wsparcie gminy dla lokalnego talentu". Nikt więcej o tym wsparciu nigdy nie usłyszy.` },

        { id: 'akt4-wroclaw', title: 'Rywal z Wrocławia', icon: 'fa-city', color: 'text-blue-700',
          text: `Przeprowadzka do centrum Wrocławia. Piękny lokal, piękna witryna, czynsz, który boli bardziej niż oparzenie. Na miejscu Marek poznaje Radka Ziarno — baristę sieciówki z identyfikatorem „Senior Coffee Specialist", który parzy americano z automatu w jedenaście sekund. „Ludzie i tak nie czują różnicy, liczy się branding" — mówi Radek, poprawiając muszkę do zdjęcia na Instagram. Marek postanawia mu to wybić z głowy. Najlepiej publicznie, na scenie.` },

        { id: 'akt5-mistrz-polski', title: 'Mistrz Polski', icon: 'fa-crown', color: 'text-amber-500',
          text: `Mistrzostwa Polski Baristów odbywają się w hali targowej, między stoiskiem z odkurzaczami a namiotem „cudowny materac ortopedyczny". Dekoracje rodem z dożynek, poziom jak najbardziej prawdziwy — i Marek wygrywa. Dostaje puchar, dyplom z literówką w nazwisku i propozycję własnej linii kawy. Radek Ziarno, odpadnięty w eliminacjach, tłumaczy to „zmową sędziów" każdemu, kto zechce słuchać.` },

        { id: 'akt5-final-wbc', title: 'World Brewers Cup', icon: 'fa-earth-europe', color: 'text-amber-600',
          text: `Światowy finał. Marek stoi na scenie obok baristów z krajów, o których jego szkolna geografia nawet nie wspominała. Zza kulis ktoś krzyczy po polsku: „Marek! Zrób im tu porządek!". Robi. Fotograf gminny, który jeszcze niedawno fotografował trzeci raz ten sam pomnik, zostaje mistrzem świata.` }
    ];

    // Zwraca true, jeśli scena WŁAŚNIE TERAZ została pokazana po raz pierwszy
    // (main.js używa tego, żeby nie zderzyć jej z modalem powitalnym).
    function fire(id) {
        if (PlayerProfile.hasSeenStory(id)) return false;
        PlayerProfile.markStorySeen(id);
        const beat = STORY_BEATS.find(b => b.id === id);
        showModal(beat.title, beat.text, beat.icon, beat.color);
        return true;
    }

    // comp-won i location odpalają się synchronicznie wewnątrz PlayerProfile,
    // ZANIM Konkursy/Kawiarnia zdążą pokazać swój własny modal wyniku/przeprowadzki
    // — bez opóźnienia scena fabularna zostałaby natychmiast nadpisana w tym
    // samym takcie JS. Ten sam wzorzec co istniejący setTimeout() w main.js.
    const MODAL_COLLISION_DELAY = 3500;

    function init() {
        const prologShown = fire('prolog');

        PlayerProfile.on('history', function (payload) {
            if (payload && payload.mode === 'lab' && PlayerProfile.getHistory('lab').length === 1) {
                fire('akt2-nauka');
            }
        });

        PlayerProfile.on('comp-won', function (payload) {
            if (!payload) return;
            if (payload.id === 'comp1') setTimeout(() => fire('akt3-pierwszy-puchar'), MODAL_COLLISION_DELAY);
            if (payload.id === 'comp3') setTimeout(() => fire('akt5-mistrz-polski'), MODAL_COLLISION_DELAY);
            if (payload.id === 'comp4') setTimeout(() => fire('akt5-final-wbc'), MODAL_COLLISION_DELAY);
        });

        PlayerProfile.on('location', function (payload) {
            if (payload && payload.id === 'l3') setTimeout(() => fire('akt4-wroclaw'), MODAL_COLLISION_DELAY);
        });

        return prologShown;
    }

    return { init };
})();
