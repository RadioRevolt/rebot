var irc = require ('irc');
var fs = require ('fs');
var S = require('string');
var sqlite3 = require('sqlite3').verbose();
var crypto = require('crypto');
var uuid = require('node-uuid');
var moment = require('moment');

var settings = require('./settings');

var loggedInAdmins = {};

main();

// DATABASE

function Database(filename, mode) {
    var self = this;

    this.db = new sqlite3.Database(filename);
    this.mode = mode;

    this.db.serialize(function() {
        self.db.run("CREATE TABLE IF NOT EXISTS Bookmarks (id PRIMARY KEY, name TEXT, content TEXT, locked BOOLEAN, datetime DATETIME, mode TEXT, UNIQUE (name, mode))");
        self.db.run("CREATE TABLE IF NOT EXISTS History (id PRIMARY KEY, sender TEXT, recipient TEXT, content TEXT, datetime DATETIME, mode TEXT)");
        self.db.run("CREATE TABLE IF NOT EXISTS Admins (id PRIMARY KEY, username TEXT, hash BLOB, salt BLOB, mode TEXT, UNIQUE (username, mode))");
        self.db.run("CREATE TABLE IF NOT EXISTS Bans (id PRIMARY KEY, regex TEXT, datetime DATETIME, mode TEXT)");
    });

    this.addAdmin = function(username, password, callback) {
        hash(password, null, function(err, key, salt) {
            if (err) {
                callback(false);
            } else {
                self.db.get("SELECT username WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
                    if (err) {
                        callback(false);
                    } else {
                        self.db.run("INSERT INTO Admins (id, username, hash, salt, mode) VALUES ($id, $username, $hash, $salt, $mode)",
                            {
                                $id: uuid.v4(),
                                $username: username,
                                $hash: key,
                                $salt: salt,
                                $mode: self.mode
                            }, function(err) {
                                if (err) {
                                    callback(false);
                                } else {
                                    callback(true);
                                }
                            });
                    }
                });
            }
        });
    }

    this.removeAdmin = function(username, callback) {
        self.db.run("DELETE FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
            if (err) {
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    this.changeAdminPassword = function(username, newPassword, callback) {
        hash(password, null, function(err, key, salt) {
            if (err) {
                callback(false);
            } else {
                self.db.get("SELECT username FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
                    if (err) {
                        callback(false);
                    } else {
                        self.db.run("UPDATE Admins SET hash = $hash, salt = $salt WHERE username = $username AND mode = $mode",
                            {
                                $hash: key,
                                $salt: salt,
                                $username: username,
                                $mode: self.mode
                            }, function(err) {
                                if (err) {
                                    callback(false);
                                } else {
                                    callback(true);
                                }
                            });
                    }
                });
            }
        });
    }

    this.getAdmin = function(username, callback) {
        self.db.get("SELECT username, hash, salt FROM Admins WHERE username = $name AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
            if (err == null && typeof(row) != "undefined") {
                callback(row.username, row.hash, row.salt);
            } else {
                callback(undefined, undefined, undefined);
            }
        });
    }

    this.banRegex = function(regex, callback) {
        self.db.run("INSERT INTO Bans (id, regex, datetime, mode) VALUES ($id, $regex, $datetime, $mode)",
            {
                $id: uuid.v4(),
                $regex: regex,
                $datetime: moment().format("YYYY-MM-DD HH:mm:ss"),
                $mode: self.mode
            },
            function(err) {
                if (err == null) {
                    callback(true);
                } else {
                    callback(false);
                }
            });
    }

    this.unbanRegex = function(regex, callback) {
        self.db.run("DELETE FROM Bans WHERE regex = $regex AND mode = $mode", { $regex: regex, $mode: self.mode }, function(err) {
            if (err == null) {
                callback(true);
            } else {
                callback(false);
            }
        });
    }

    this.getAllBans = function(callback) {
        self.db.all("SELECT regex, datetime, mode FROM Bans WHERE mode = $mode", { $mode: self.mode }, function(err, rows) {
            if (err == null && typeof(rows) != "undefined") {
                callback(rows);
            } else {
                callback(undefined);
            }
        });
    }

    this.getBookmark = function(bookmark, callback) {
        self.db.get("SELECT name, content, locked FROM Bookmarks WHERE name = $name AND mode = $mode", { $name: bookmark, $mode: self.mode }, function(err, row) {
            if (err == null && typeof(row) != "undefined") {
                callback(row.name, row.content, row.locked);
            } else {
                callback(undefined, undefined, undefined);
            }
        });
    }

    this.searchBookmarks = function(string, callback) {
        var results = [];
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
                function(err) {
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
                function(err) {
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
            self.db.get("SELECT id, sender, recipient, content, datetime FROM History WHERE mode = $mode ORDER BY datetime DESC LIMIT 1 OFFSET $n", { $n: n, $mode: self.mode }, function(err, row) {
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

function hash(password, salt, callback) {
    if (salt == null) {
        crypto.randomBytes(128, function(err, salt) {
            if (e) {
                callback("Not enough entropy.", undefined, undefined);
            } else {
                crypto.pbkdf2(password, salt, 80000, 256, function(err, key) {
                    if (err) {
                        callback("An error occured during key derivation.", undefined, undefined);
                    } else {
                        callback(null, key, salt);
                    }
                });
            }
        });
    } else {
        crypto.pbkdf2(password, salt, 80000, 256, function(err, key) {
            if (err) {
                callback("An error occured during key derivation.", undefined, undefined);
            } else {
                callback(null, key, salt);
            }
        });
    }
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
        'search': searchBookmarks,
        'login': adminLogin
    }

    var command = text.split(" ", 2)[0];

    if (command in userCommands) {
        userCommands[command](text, bundle, callback);
    } else {
        lookupBookmark(command, bundle, callback);
    }
}

function adminLogin(text, bundle, callback) {
    this.login = function(username, bundle, callback) {
        var loginId = uuid.v4();
        loggedInAdmins[loginId] = {
            username: username,
            datetime: Date.now(),
            host: bundle.message.host
        };
        setTimeout(function() {
            delete loggedInAdmins[loginId];
        }, 30*60*1000); // automatically logged out after 30 minutes
        callback("Successfully logged in!");
    }

    var splitCommand = text.smart_split(" ", 2);

    var password = splitCommand[1];
    var username = bundle.message.user;

    if (username == settings.superuser.username && password == settings.superuser.password) {
        this.login(username, bundle, callback);
    } else if (username && password) {
        bundle.db.getAdmin(username, function(username, true_hash, salt) {
            if (username == null) {
                callback("No such admin user.");
            } else {
                hash(password, salt, function(hash, salt) {
                    if (true_hash === hash) {
                        this.login(username, bundle, callback);
                    } else {
                        callback("A cryptographic error occured.");
                    }
                });
            }
        });
    } else {
        callback("");
    }
}

function repeatLine(text, bundle, callback) {
    var n = split_command = text.smart_split(" ", 0)[0];

    if (n && Number(n) !== 0) {
        bundle.db.getNthToLastHistoryEntry(Number(n), function(id, sender, recipient, content, datetime) {
            if (typeof(id) == "undefined") {
                callback("");
            } else {
                callback("<" + sender + ">" + " " + content);
            }
        });
    } else {
        callback('');
    }
}

function lookupBookmark(text, bundle, callback) {
    bundle.db.getBookmark(text, function(name, content, locked) {
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
        bundle.db.getBookmark(bookmark, function(name, content, locked) {
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
        bundle.db.getBookmark(bookmark, function(name, content, locked) {
            if (typeof(content) == "undefined") {
                callback("No such bookmark.");
            } else if (locked == true) {
                callback("Bookmark is locked.");
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

function lookupAdminCommand(text, bundle, callback) {
    var adminCommands = {
        'lock': lockBookmark,
        'unlock': unlockBookmark,
        'block': blockUser,
        'unblock': unblockUser
    }

    var command = text.split(" ", 2)[0];

    var loggedIn = false;
    for (var key in loggedInAdmins) {
        if (loggedInAdmins[key].username === bundle.message.user) {
            loggedIn = true;
            break;
        }
    }

    if (loggedIn) {
        if (command in adminCommands) {
            adminCommands[command](text, bundle, callback);
        }
    } else {
        callback("");
    }
}

function lockBookmark(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);
    var bookmark = split_command[1];

    bundle.db.getBookmark(bookmark, function(name, content, locked) {
        if (typeof(name) == "undefined") {
            callback("No such bookmark.");
        } else if (locked == true) {
            callback("Bookmark is already locked.");
        } else {
            bundle.db.lockBookmark(bookmark, function(status) {
                if (status) {
                    callback("Locked bookmark \"" + bookmark + "\".");
                } else {
                    callback("Could not lock bookmark -- an error occurred.");
                }
            });
        }
    });
}

function unlockBookmark(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);
    var bookmark = split_command[1];

    bundle.db.getBookmark(bookmark, function(name, content, locked) {
        if (typeof(name) == "undefined") {
            callback("No such bookmark.");
        } else if (locked == false) {
            callback("Bookmark is not locked.");
        } else {
            bundle.db.unlockBookmark(bookmark, function(status) {
                if (status) {
                    callback("Unlocked bookmark \"" + bookmark + "\".");
                } else {
                    callback("Could not unlock bookmark -- an error occurred.");
                }
            });
        }
    });
}

function blockUser(user, bundle, callback) {
    callback("Not implemented.");
}

function unblockUser(user, bundle, callback) {
    callback("Not implemented.");
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

        var bundle = {"mode": mode, "bot": bot, "nick": nick, "to": to, "db": db, "message": message};

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
