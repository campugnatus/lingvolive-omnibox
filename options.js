document.addEventListener('DOMContentLoaded', function() {

    var sel1 = document.getElementById("l1"),
        sel2 = document.getElementById("l2"),
        languages;

    var xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.onload = function () {
        languages = this.response;
    };
    xhr.open("GET", 'languages.json');
    xhr.send();

    chrome.storage.sync.get(["l1", "l2"], function(items) {
        fillSelectIn(sel1, items.l1);
        fillSelectIn(sel2, items.l2);
    });

    function fillSelectIn (e, selected) {
        var opt;
        for (var i = 0, l = languages.length; i < l; i++) {
            opt = document.createElement("option");
            opt.value = languages[i].abbrev;
            opt.text = languages[i].name;
            e.add(opt);
        }

        e.value = selected;
        e.addEventListener('change', selectLanguageOnChange);
    }

    function selectLanguageOnChange(event) {
        console.log(event.target, event.target.value);
        chrome.storage.sync.set({
            "l1": sel1.value,
            "l2": sel2.value
        }, function() {
        	var status = document.getElementById("arrows");
        	arrows.className += "animate";

            setTimeout (function () {
            	arrows.className = arrows.className.replace(/animate/, "");
            }, 1000);
        });
    }
});