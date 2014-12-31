var irc = require ('irc');
var fs = require ('fs');
var S = require('string');

var settings = require('./settings');

var specialCommands = {
    'bookmark': createBookmark,
    'unmark': deleteBookmark,
    'search': searchBookmarks
}

var json = {};

var message_history = [];

main()

// UTILITY

String.prototype.smart_split = function(separator, limit) {
    var split_str = this.split(separator);
    var new_split_array = []

    var i;

    for (i = 0; i < limit; i++) {
        new_split_array.push(split_str[i]);
    }

    new_split_array[limit] = split_str.slice(limit).join(separator);

    return new_split_array;
}

function speak(text, bundle) {
    bundle.bot.say(bundle.to, S(text).decodeHTMLEntities().s);
}

// LOGGING

function addToHistory(message) {
    message_history.push(message);
    console.log(message);
}

function log(message) {
    console.log(message);
    //logToFile(message); // Temporarily turned off
}

function logToFile(message) {
    var writef = function(log) {
        log = log + message + "\n";
        fs.writeFile("log", log, "utf8", function () {});
    }

    fs.readFile("./log", 'utf8', function (err, data) {
        if (err) {
            fs.writeFile("log", message + "\n", "utf8", function () {});
        } else {
            fs.writeFile("log", data + message + "\n", "utf8", function () {});
        }
    });
}

// COMMANDS

function lookupCommand(mode, text, bundle) {
    var command = text.split(" ", 2)[0];

    if (command in specialCommands) {
        return specialCommands[command](mode, text);
    } else {
        return lookupBookmark(mode, command);
    }
}

function repeatLine(mode, text, bundle) {
    var n = split_command = text.smart_split(" ", 0);

    if ((typeof parseInt(n) === 'number') && (parseInt(n) % 1 === 0)) {
        if (!(parseInt(n)+1 > message_history.length)) {
            var history_item = message_history.slice(-(parseInt(n)+1))[0];
            return "<" + history_item.from + ">" + " " + history_item.text;
        }
    }

    return "";
}

function lookupBookmark(mode, text, bundle) {
    if (text in json) {
        return json[text];
    }
    
    return "";
}

function createBookmark(mode, text, bundle) {
    var split_command = text.smart_split(" ", 2);

    var bookmark = split_command[1];
    var bookmark_value = split_command[2];

    if (bookmark && bookmark_value) {
        json = require("./bookmarks/" + mode + ".json");

        if (!(bookmark in json)) {
            json[bookmark] = bookmark_value;

            fs.writeFile("bookmarks/" + mode + ".json", JSON.stringify(json), "utf8", function () { 
               log("Added bookmark " + bookmark);
            });

            return "Added bookmark " + bookmark + "!"
        } else {
            return "Bookmark already exists."
        }
    } else {
        return ""
    }
}

function deleteBookmark(mode, text, bundle) {
    var split_command = text.smart_split(" ", 2);

    var bookmark = split_command[1];

    if (bookmark) {
        json = require("./bookmarks/" + mode + ".json");

        if (bookmark in json) {
            delete json[bookmark];

            fs.writeFile("bookmarks/" + mode + ".json", JSON.stringify(json), "utf8", function () { 
               log("Deleted bookmark " + bookmark);
            });

            return "Deleted bookmark " + bookmark + ""
        } else {
            return "No such bookmark."
        }
    } else {
        return ""
    }
}

function searchBookmarks(mode, text, bundle) {
    var json_keys = Object.keys(json);
    var search_kw = text.smart_split(" ", 1)[1];

    if (search_kw) {
        var matching_keys = json_keys.filter(function(key) {
            if (key.toLowerCase().indexOf(search_kw.toLowerCase()) > -1) {
                return true;
            } else {
                return false;
            }
        });
    } else {
        var matching_keys = []
    }

    return matching_keys.join(" ");
}

function wolframClient(mode, text, bundle) {
    var math_expression = text.smart_split(" ", 1)[1];

    if (math_expression) {
        wolfram.query(math_expression, function (err, res) {
            if (err) {
                speak(bundle, "Wolfram Alpha could not evaluate the expression");
            } else {
                log(res);
                speak(bundle, res);
            }
        });
    }

    return "";
}

// BOOKMARK DATABASE

function loadJSON(mode) {
    var _json = {};

    try {
        _json = require("./bookmarks/" + mode + ".json");
    } catch (e) {
        console.log("JSON file did not exist, creating...");
        _json = { "..": "http://i.imgur.com/REOfM.gif" };
        fs.writeFile("bookmarks/" + mode + ".json", JSON.stringify(_json), "utf8", function () { 
            console.log("Added bookmark");
        });
    }

    return _json;
}

// MAIN

function main() {
    var mode = process.argv[2];

    if (!(mode in settings.modes)) {
        throw "Invalid mode";
    }

    var mode_config = settings.modes[mode];
    var bot = new irc.Client(mode_config['server'], mode_config['bot_name'], { channels: mode_config['channels'], realName: 'IRC bot by Aqwis', userName: S(mode_config['bot_name']).camelize().s});

    logToFile.mode = mode;
    json = loadJSON(mode);

    var reactToMessage = function(nick, to, text, message) {
        var trimmed_message = text.trim();
        var result_text = "";

        var bundle = {"bot": bot, "nick": nick, "to": to};

        addToHistory({"from": nick, "to": to, "text": text});

        if (trimmed_message[0] === ".") {
            result_text = lookupCommand(mode, trimmed_message.slice(1), bundle);
            if (result_text) {
                speak(result_text, bundle);
                addToHistory({"from": mode_config['bot_name'], "to": to, "text": S(result_text).decodeHTMLEntities().s});
            }
        } else if (trimmed_message[0] === "^") {
            result_text = repeatLine(mode, trimmed_message.slice(1), bundle);
            if (result_text) {
                speak(result_text, bundle);
                addToHistory({"from": mode_config['bot_name'], "to": to, "text": S(result_text).decodeHTMLEntities().s});
            }
        }
    };

    bot.addListener("message#", reactToMessage);
    bot.addListener("message", function(nick, to, text, message) {
        if (to === mode_config['bot_name']) {
            reactToMessage(nick, nick, text, message);
        }
    });
    bot.addListener("error", function(message) {
        console.log('ERROR: ', message);
    });
}
