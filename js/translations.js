jQuery(function () {
    jQuery(".widget").localizationTool({
        'defaultLanguage': 'pl_PL',
        'showFlag': true,
        'showCountry': false,
        'showLanguage': false,
        'strings': {
            'Mapa Arkadii': {
                'en_GB': 'Map Reader',
            },
            'Kopiuj': {
                'en_GB': 'Copy',
            },
            'Szukaj': {
                'en_GB': 'Search',
            },
            'Ustawienia': {
                'en_GB': 'Settings',
            },
            'Pomoc': {
                'en_GB': 'Help',
            },
            'Wielkość lokacji': {
                'en_GB': 'Location size',
            },
            'Grubość linii': {
                'en_GB': 'Line thickness',
            },
            'Jednakowa wielkość poziomów strefy': {
                'en_GB': 'Uniform area level size',
            },
            'Zachowuj poziom przybliżenia': {
                'en_GB': 'Keep zoom level',
            },
            'Krawędzie lokacji': {
                'en_GB': 'Location borders',
            },
            'Okrągłe lokacje': {
                'en_GB': 'Round borders',
            },
            'Pokaż tylko krawędzie': {
                'en_GB': 'Show only borders',
            },
            'Nazwy stref': {
                'en_GB': 'Area names',
            },
            'Etykiety': {
                'en_GB': 'Labels',
            },
            'Zapisz': {
                'en_GB': 'Save',
            },
            'Anuluj': {
                'en_GB': 'Cancel',
            },
            'ta pomoc': {
                'en_GB': 'this help',
            },
            'zapisz obraz': {
                'en_GB': 'download image',
            },
            'kopiowanie obrazka do schowka': {
                'en_GB': 'copy image to clipboard',
            },
            'wyszukiwaie': {
                'en_GB': 'search',
            },
            'przybliżenie': {
                'en_GB': 'zoom in',
            },
            'oddalenie': {
                'en_GB': 'zoom out',
            },
            'przesuwanie mapy': {
                'en_GB': 'move around map',
            },
            'Dodatkowo z zaznaczonej lokacji można po zwykłych wyjściach się poruszać za pomocą klawiatury numerycznej': {
                'en_GB': 'Additionally from selected location you can move around passing through regulard exits by using num keyboard',
            },
            'Autor': {
                'en_GB': 'Author',
            },
            'Skopiowano do schowka': {
                'en_GB': 'Copied to clipboard',
            },
            'Zapisano ustawienia': {
                'en_GB': 'Settings saved',
            },
            'ID Lokacji': {
                'en_GB': 'Location ID',
            },
            'Numer lokacji lub pełne imię adresata paczki:' : {
                'en_GB': 'Location number or full name of package recipient',
            },
            'Nazwa': {
                'en_GB': 'Name',
            },
            'Koordynaty': {
                'en_GB': 'Coordinates',
            },
            'Wyjścia': {
                'en_GB': 'Exits',
            },
            'Specjalne': {
                'en_GB': 'Special',
            },
            'Inne': {
                'en_GB': 'Other',
            },
            "polnoc" : {
                'en_GB' : "north"
            },
            "poludnie" : {
                'en_GB' : "south"
            },
            "wschod" : {
                'en_GB' : "east"
            },
            "zachod" : {
                'en_GB' : "west"
            },
            "polnocny-wschod" : {
                'en_GB' : "northeast"
            },
            "polnocny-zachod" : {
                'en_GB' : "northwest"
            },
            "poludniowy-wschod" : {
                'en_GB' : "southeast"
            },
            "poludniowy-zachod" : {
                'en_GB' : "southwest"
            },
            "gora" : {
                'en_GB' : "up"
            },
            "dol" : {
                'en_GB' : "down"
            },
            "Tło mapy" : {
                'en_GB' : "Background"
            },
            "Przezroczyste tło etykiet" : {
                'en_GB' : "Transparent labels background"
            }
        }
    });

    let savedLanguage = localStorage.getItem("lang") ?? 'pl_PL';
    if (savedLanguage) {
        translatePage(savedLanguage);
    }

    getActiveLanguages().forEach(langCode => {
        let button = jQuery('<a class="dropdown-item" href="#"><div class="flag ' + getFlagClassFromLangCode(langCode) + '"></div></a>');
        button.on("click", function(event) {
            event.preventDefault();
            translatePage(langCode);
        });
        jQuery(".lang-dropdown .dropdown-menu").append(button);
    });
});

function translatePage(lang) {
    jQuery(".current-language-flag").removeClass(getFlagClassFromLangCode(getCurrentLanguage()));
    jQuery(".widget").localizationTool("translate", lang);
    jQuery(".current-language-flag").addClass(getFlagClassFromLangCode(getCurrentLanguage()));
    localStorage.setItem("lang", getCurrentLanguage());
    
}

function getFlagClassFromLangCode(code) {
    return "flag-" + code.substring(3).toLowerCase()
}

function translateString(string) {
    let widget = jQuery(".widget");
    let currentLang = widget.data('selectedLanguageCode');
    try {
        return widget.localizationTool("translateString", string, currentLang);
    } catch (error) {
        return string;
    }
}

function getCurrentLanguage() {
    return jQuery(".widget").data('selectedLanguageCode');
}

function getActiveLanguages() {
    return jQuery(".widget").data('activeLanguageCodeArray');
}