(function () {

    var valid = 0;
    var response;
    var sounds = {};
    var suggestURL;
    var articleURL;
    var l1, l2;
    var languages;
    var timeoutId;

    var xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.timeout = 2000;
    xhr.onerror = function (e) {
        console.log("Ajax error", new Error (e));
    };
    xhr.ontimeout = function (e) {
        console.log("Timeout", new Error (e));
    };
    xhr.onload = function () {
        languages = this.response;

        chrome.storage.sync.get(["l1", "l2"], function(items) {
            if (chrome.runtime.lastError)
                return console.log("Error: couldn't access chrome storage: ", chrome.runtime.lastError.message);

            // First time?
            if (typeof items.l1 === 'undefined' || typeof items.l2 === 'undefined') {
                items.l1 = "en";
                items.l2 = guessUserLanguage();

                chrome.storage.sync.set({
                    l1: items.l1,
                    l2: items.l2
                });
            }

            applyLanguages(items.l1, items.l2);

            chrome.omnibox.onInputChanged.addListener(onInputChanged);
            chrome.omnibox.onInputEntered.addListener(onInputEntered);
        });
    };
    xhr.open("GET", 'languages.json');
    xhr.send();

    chrome.storage.onChanged.addListener(function(changes, namespace) {
        applyLanguages("l1" in changes ? changes.l1.newValue : undefined,
                       "l2" in changes ? changes.l2.newValue : undefined);
    });

    function applyLanguages (one, two) {
        if (one)
            l1 = findLangByField("abbrev", one) || findLangByField("abbrev", "en");
        if (two)
            l2 = findLangByField("abbrev", two) || findLangByField("abbrev", "ru");

        suggestURL = "https://api.lingvolive.com/Translation/WordListPart?dstLang="+l1.langId
            +"&pageSize=6&srcLang="+l2.langId+"&startIndex=0&prefix=";

        articleURL = "https://lingvolive.com/translate/"+l1.abbrev+"-"+l2.abbrev+"/";
    }

    function guessUserLanguage() {
        var uLang = chrome.i18n.getUILanguage().slice(0, 2);

        if (findLangByField("abbrev", uLang))
            return uLang;
        else
            return "ru";
    }

    function findLangByField (field, value) {
        for (var i = 0, l = languages.length; i < l; i++)  {
            if (languages[i][field] === value)
                return languages[i];
        }
        return 0;
    }

    function alertUser (msg) {
        chrome.omnibox.setDefaultSuggestion({description: msg});
        return 1;
    }

    function escapeXMLString (string) {
        return string.replace(/\&/g, "&#38;").replace(/\</g, "&#60;").replace(/\>/g, "&#62;")
        .replace(/">/g, "&#34;").replace(/\'/g, "&#39;");
    }

    function playAudio (text) {
        var fileName, dictName;
        if (sounds[text]) {
            fileName = encodeURIComponent(sounds[text][0]);
            dictName = encodeURIComponent(sounds[text][1]);
        } else if (response.items[0].lingvoSoundFileName) {
            fileName = encodeURIComponent(response.items[0].lingvoSoundFileName);
            dictName = encodeURIComponent(response.items[0].lingvoDictionaryName);
        }
        if (fileName && dictName)
            new Audio("https://api.lingvolive.com/sounds?uri=" + dictName + "/" + fileName).play();
    }

    function onInputChanged (text, suggest) {
        valid = 0;

        if (!text.length)
            return;
        if (/[~`!@#$%^&*()_\+={}|\\[\]\/:;\"<>,.\/?]/.test(text)) {
            return alertUser("Error: special symbols aren't allowed");
        }

        valid = 1;

        sounds = {};
        var suggestions = [];

        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(querySuggestions, 350);

        function querySuggestions () {
            var x = new XMLHttpRequest();
            x.responseType = 'json';
            x.onload = onResponse;
            x.onerror = function (e) {
                return alertUser("Error: network error");
            };
            x.open('GET', suggestURL+text);
            x.send();
        }

        function onResponse() {
            response = this.response;
            if (!response) {
                return alertUser('Error: no response from lingvolive.com');
            }

            if (response.items.length === 0)
                return alertUser("Hm... lingvolive.com hasn't found anything :-/");

            for (var i = 0, l = response.items.length; i < l; i++) {
                var item = response.items[i];
                var content, description, soundIcon = " ", delimiter = "&#x2013;", dict = "";

                if (item.heading)
                    content = escapeXMLString(item.heading);
                else continue;

                if (item.lingvoTranslations)
                    description = escapeXMLString(item.lingvoTranslations);
                else if (item.socialTranslations) {
                    description = escapeXMLString(item.socialTranslations);
                    delimiter = "&#8764;";
                }
                else continue;

                if (item.lingvoDictionaryName) {
                    dict = "<dim> &#x2013; "+ item.lingvoDictionaryName +"</dim>";
                }

                if (item.lingvoSoundFileName && item.lingvoDictionaryName) {
                    sounds[content] = [item.lingvoSoundFileName, item.lingvoDictionaryName];
                    soundIcon = " &#9834; ";
                }

                suggestions.push({
                    content: content,
                    description: "<url>" + content + "</url> " + delimiter + soundIcon + description + dict
                });
            }

            if (suggestions.length === 0)
                return;

            delete suggestions[0].content;
            chrome.omnibox.setDefaultSuggestion(suggestions[0]);

            if (suggestions.length > 1)
                suggest(suggestions.slice(1));
        }
    }

    function onInputEntered (text, disposition) {
        if (!valid)
            return;

        if (disposition === "newForegroundTab") { // Alt + Enter
            playAudio(text);
            return false;
        }

        chrome.tabs.query({ active: true, currentWindow: true },
            function (tablist) {
                chrome.tabs.create({
                    url: articleURL + text,
                    index: tablist[0].index
                });
            }
        );
    }

})();
