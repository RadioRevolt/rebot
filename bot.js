var irc = require ('irc');
var fs = require ('fs');
var S = require('string');
var sqlite3 = require('sqlite3').verbose();
var uuid = require('node-uuid');
var moment = require('moment');

var settings = require('./settings');

main();

// DATABASE

function Database(filename, mode) {
    var self = this;

    this.db = new sqlite3.Database(filename);
    this.mode = mode;

    this.db.serialize(function() {
        self.db.run("CREATE TABLE IF NOT EXISTS Bookmarks (id PRIMARY KEY, name TEXT, content TEXT, locked BOOLEAN, datetime DATETIME, mode TEXT, UNIQUE (name, mode))");
        self.db.run("CREATE TABLE IF NOT EXISTS History (id PRIMARY KEY, sender TEXT, recipient TEXT, content TEXT, datetime DATETIME, mode TEXT)");
    });

    this.getBookmark = function(bookmark, callback) {
        self.db.serialize(function() {
            self.db.get("SELECT id, name, content, locked, datetime, mode FROM Bookmarks WHERE name = $name AND mode = $mode", { $name: bookmark, $mode: self.mode }, function(err, row) {
                if (err == null && typeof(row) != "undefined") {
                    callback(row.name, row.content);
                } else {
                    callback(undefined, undefined);
                }
            });
        });
    }

    this.searchBookmarks = function(string, callback) {
        var results = [];
        self.db.serialize(function() {
            self.db.each("SELECT name, content FROM Bookmarks WHERE mode = $mode AND name LIKE $string", { $string: "%" + string + "%", $mode: self.mode }, function(err, row) {
                if (err == null) {
                    results.push(row.name);
                }
            }, function(err, num) {
                if (err == null) {
                    callback(results);
                } else {
                    callback([]);
                }
            });
        });
    }

    this.setBookmark = function(bookmark, content, callback) {
        self.db.serialize(function() {
            self.db.run("INSERT INTO Bookmarks (id, name, content, locked, datetime, mode) VALUES ($id, $name, $content, $locked, $datetime, $mode)",
                {
                    $id: uuid.v4(),
                    $name: bookmark,
                    $content: content,
                    $locked: 0,
                    $datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
                    $mode: self.mode
                },
                function(err, row) {
                    if (err == null) {
                        callback(true);
                    } else {
                        callback(false);
                    }
            });
        });
    }

    this.deleteBookmark = function(bookmark, callback) {
        self.db.serialize(function() {
            self.db.run("DELETE FROM Bookmarks WHERE name = $name AND mode = $mode",
                {
                    $name: bookmark,
                    $mode: self.mode
                },
                function(err, row) {
                    if (err == null) {
                        callback(true);
                    } else {
                        callback(false);
                    }
            });
        });
    }

    this.lockBookmark = function(bookmark, callback) {
        self.db.serialize(function() {
            self.db.run("UPDATE Bookmarks SET locked = 1 WHERE name = $name and mode = $mode", { $name: bookmark, $mode: self.mode }, function(err) {
                if (err == null) {
                    callback(true);
                } else {
                    callback(false);
                }
            });
        });
    }

    this.unlockBookmark = function(bookmark, callback) {
        self.db.serialize(function() {
            self.db.run("UPDATE Bookmarks SET locked = 0 WHERE name = $name and mode = $mode", { $name: bookmark, $mode: self.mode }, function(err) {
                if (err == null) {
                    callback(true);
                } else {
                    callback(false);
                }
            });
        });
    }

    this.pushToHistory = function(sender, recipient, content, datetime, callback) {
        self.db.serialize(function() {
            self.db.run("INSERT INTO History (id, sender, recipient, content, datetime, mode) VALUES ($id, $sender, $recipient, $content, $datetime, $mode)",
                {
                    $id: uuid.v4(),
                    $sender: sender,
                    $recipient: recipient,
                    $content: content,
                    $datetime: moment(datetime).format("YYYY-MM-DD HH:mm:ss.SSS"),
                    $mode: self.mode
                },
                function(err, row) {
                    if (err == null) {
                        callback(true);
                    } else {
                        callback(false);
                    }
            });
        });
    }

    this.getNthToLastHistoryEntry = function(n, callback) {
        self.db.serialize(function() {
            self.db.get("SELECT id, sender, recipient, content, datetime FROM History WHERE mode = $mode ORDER BY datetime DESC LIMIT 1 OFFSET $n", { $n: Number(n), $mode: self.mode }, function(err, row) {
                if (err == null && typeof(row) != "undefined") {
                    callback(row.id, row.sender, row.recipient, row.content, row.datetime);
                } else {
                    callback(undefined, undefined, undefined, undefined);
                }
            });
        });
    }
}

// UTILITY

String.prototype.smart_split = function(separator, limit) {
    var split_str = this.split(separator);
    var new_split_array = []

    for (var i = 0; i < limit; i++) {
        new_split_array.push(split_str[i]);
    }

    new_split_array[limit] = split_str.slice(limit).join(separator);

    return new_split_array;
}

function speak(text, bundle) {
    var lines = text.split("<br>");
    var truncated_lines = lines.slice(0, 3);

    for (var i = 0; i < truncated_lines.length; i++) {
        processed_text = S(truncated_lines[i]).decodeHTMLEntities().s
                    .replace("<b>", "")
                    .replace("</b>", "")
                    .replace("<i>", "\x1D")
                    .replace("</i>", "\x1D");

        bundle.bot.say(bundle.to, processed_text);
        addToHistory({ "from": bundle.bot.opt.nick, "to": bundle.to, "text": processed_text }, bundle);
    }

    if (lines.length > truncated_lines.length) {
        speak("... (truncated output -- originally " + lines.length + " lines) ...", bundle);
    }
}

// LOGGING

function addToHistory(message, bundle) {
    bundle.db.pushToHistory(message.from, message.to, message.text, Date.now(), function(status) {
        console.log(message);
    });
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

// USER COMMANDS

function lookupUserCommand(text, bundle, callback) {
    var userCommands = {
        'bookmark': createBookmark,
        'unmark': deleteBookmark,
        'search': searchBookmarks
    }

    var command = text.split(" ", 2)[0];

    if (command in userCommands) {
        userCommands[command](text, bundle, callback);
    } else {
        lookupBookmark(command, bundle, callback);
    }
}

function repeatLine(text, bundle, callback) {
    var n = split_command = text.smart_split(" ", 0);

    bundle.db.getNthToLastHistoryEntry(n, function(id, sender, recipient, content, datetime) {
        if (typeof(id) == "undefined") {
            callback("");
        } else {
            callback("<" + sender + ">" + " " + content);
        }
    });
}

function lookupBookmark(text, bundle, callback) {
    bundle.db.getBookmark(text, function(name, content) {
        if (content) {
            callback(content);
        } else {
            callback("");
        }
    });
}

function createBookmark(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);

    var bookmark = split_command[1];
    var bookmark_value = split_command[2];

    if (bookmark && bookmark_value) {
        bundle.db.getBookmark(bookmark, function(name, content) {
            if (typeof(content) != "undefined") {
                callback("Bookmark already exists.");
            } else {
                bundle.db.setBookmark(bookmark, bookmark_value, function(name, content) {
                    callback("Added bookmark " + bookmark + "!");
                });
            }
        });
    } else {
        callback("");
    }
}

function deleteBookmark(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);
    var bookmark = split_command[1];

    if (bookmark) {
        bundle.db.getBookmark(bookmark, function(name, content) {
            if (typeof(content) == "undefined") {
                callback("No such bookmark");
            } else {
                bundle.db.deleteBookmark(bookmark, function(status) {
                    if (status) {
                        callback("Deleted bookmark " + bookmark + "!");
                    } else {
                        callback("Error while deleting bookmark.");
                    }
                });
            }
        });
    } else {
        callback("");
    }
}

function searchBookmarks(text, bundle, callback) {
    var search_kw = text.smart_split(" ", 1)[1];

    if (search_kw) {
        bundle.db.searchBookmarks(search_kw, function(results) {
            callback(results.join(" "));
        });
    } else {
        callback("");
    }
}

function wolframClient(text, bundle) {
    // TBD
    var math_expression = text.smart_split(" ", 1)[1];

    if (math_expression) {
        wolfram.query(math_expression, function (err, res) {
            if (err) {
                callback("Wolfram Alpha could not evaluate the expression");
            } else {
                callback(res);
            }
        });
    }
}

// ADMIN COMMANDS

function lookupAdminCommand(text, bundle) {
    var adminCommands = {
        'lock': lockBookmark,
        'unlock': unlockBookmark,
        'block': blockUser,
        'unblock': unblockUser
    }

    var command = text.split(" ", 2)[0];

    if (command in adminCommands) {
        adminCommands[command](text, bundle);
    }
}

function lockBookmark(text, bundle) {
    //
}

// BOOKMARK DATABASE

function convertToSqlite3(mode, callback) {
    var json = {};
    var db = new Database(settings.database_file, mode);

    try {
        json = require("./bookmarks/" + mode + ".json");
    } catch (e) {
        console.log("JSON file did not exist!");
    }

    Object.keys(json).forEach(function(b) {
        db.setBookmark(b, json[b], function() {
            console.log("Added bookmark " + b + "!");
        });
    });

    callback();
}

// MAIN

function setup(mode) {
    var mode_config = settings.modes[mode];
    var db = new Database(settings.database_file, mode);
    var bot = new irc.Client(
                mode_config['server'],
                mode_config['bot_name'],
                { 
                    channels: mode_config['channels'],
                    realName: 'IRC bot by Aqwis',
                    userName: S(mode_config['bot_name']).camelize().s
                }
            );

    logToFile.mode = mode;

    var reactToMessage = function(nick, to, text, message) {
        var trimmed_message = text.trim();
        var result_text = "";

        var bundle = {"mode": mode, "bot": bot, "nick": nick, "to": to, "db": db};

        addToHistory({"from": nick, "to": to, "text": text}, bundle);

        if (trimmed_message[0] === ".") {
            // Commands available to all users are prefixed with .
            lookupUserCommand(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
        } else if (trimmed_message[0] === "@") {
            // Commands available to administrators are prefixed with @
            lookupAdminCommand(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
        } else if (trimmed_message[0] === "^") {
            repeatLine(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
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

function main() {
    var mode = process.argv[2];

    if (mode == "convert") {
        if (!(process.argv[3] in settings.modes)) {
            throw "Please specify a mode to convert"
        }

        convertToSqlite3(process.argv[3], function() {
            console.log("Finished converting.");
        });
    } else {
        if (!(mode in settings.modes)) {
            throw "Invalid mode";
        } else {
            setup(mode);
        }
    }
}
