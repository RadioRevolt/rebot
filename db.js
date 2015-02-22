var sqlite3 = require('sqlite3').verbose();
var uuid = require('node-uuid');
var moment = require('moment');

var util = require('./util');

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
        util.hash(password, null, function(err, key, salt) {
            if (err) {
                callback(false);
                console.log(0);
            } else {
                self.db.get("SELECT username FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
                    if (err || typeof(row) !== "undefined") {
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
                                    console.log(2);
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
        self.db.get("SELECT username FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
            if (err || typeof(row) === "undefined") {
                callback(false);
            } else {
                self.db.run("DELETE FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
                    if (err) {
                        callback(false);
                    } else {
                        callback(true);
                    }
                });
            }
        });
    }

    this.changeAdminPassword = function(username, newPassword, callback) {
        util.hash(newPassword, null, function(err, key, salt) {
            if (err) {
                callback(false);
            } else {
                self.db.get("SELECT username FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
                    if (err || typeof(row) === "undefined") {
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
        self.db.get("SELECT username, hash, salt FROM Admins WHERE username = $username AND mode = $mode", { $username: username, $mode: self.mode }, function(err, row) {
            if (err == null && typeof(row) !== "undefined") {
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

    this.getNthToLastHistoryEntry = function(n, historyOf, callback) {
        self.db.serialize(function() {
            self.db.get("SELECT id, sender, recipient, content, datetime FROM History WHERE mode = $mode AND recipient = $recipient ORDER BY datetime DESC LIMIT 1 OFFSET $n", { $n: n, $mode: self.mode, $recipient: historyOf }, function(err, row) {
                if (err == null && typeof(row) != "undefined") {
                    callback(row.id, row.sender, row.recipient, row.content, row.datetime);
                } else {
                    callback(undefined, undefined, undefined, undefined, undefined);
                }
            });
        });
    }

    this.convertToSqlite3 = function(mode, callback) {
        var json = {};

        try {
            json = require("./bookmarks/" + mode + ".json");
        } catch (e) {
            console.log("JSON file did not exist!");
        }

        Object.keys(json).forEach(function(b) {
            setBookmark(b, json[b], function() {
                console.log("Added bookmark " + b + "!");
            });
        });

        callback();
    }
}

module.exports = Database;
