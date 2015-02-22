var uuid = require('node-uuid');

var settings = require('./settings');
var util = require('./util');

exports.lookupUserCommand = lookupUserCommand;
exports.repeatLine = repeatLine;

function lookupUserCommand(text, bundle, callback) {
    var userCommands = {
        'bookmark': createBookmark,
        'unmark': deleteBookmark,
        'search': searchBookmarks,
        'login': adminLogin,
        'logout': adminLogout
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
        util.loggedInAdmins[loginId] = {
            username: username,
            datetime: Date.now(),
            host: bundle.message.host
        };
        setTimeout(function() {
            if (util.loggedInAdmins.hasOwnProperty(loginId)) {
                delete util.loggedInAdmins[loginId];
            }
        }, 30*60*1000); // automatically logged out after 30 minutes
        callback("Successfully logged in!");
    }

    self = this;

    var splitCommand = text.smart_split(" ", 2);

    var password = splitCommand[1];
    var username = bundle.message.user;

    var superuser_password = settings.modes[bundle.mode].superuser.password
    var superuser_username = settings.modes[bundle.mode].superuser.username

    var matchingLoginIDs = Object.keys(util.loggedInAdmins).filter(function(k) {
        return util.loggedInAdmins[k].username === bundle.message.user;
    });
    if (matchingLoginIDs.length >= 1) {
        callback("You are already logged in.");
    } else {
        if (username === superuser_username
                && password === superuser_password
                && superuser_username !== ''
                && superuser_password !== '') {
            self.login(username, bundle, callback);
        } else if (username && password) {
            bundle.db.getAdmin(username, function(username, true_hash, salt) {
                if (username == null) {
                    callback("No such admin user.");
                } else {
                    util.hash(password, salt, function(err, hash, salt) {
                        if (util.compareBuffers(true_hash, hash)) {
                            self.login(username, bundle, callback);
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
}

function adminLogout(text, bundle, callback) {
    var matchingLoginIDs = Object.keys(util.loggedInAdmins).filter(function(k) {
        return util.loggedInAdmins[k].username === bundle.message.user;
    });

    if (matchingLoginIDs.length >= 1) {
        for (i in matchingLoginIDs) {
            delete util.loggedInAdmins[matchingLoginIDs[i]];
        }
        callback('Successfully logged out.');
    } else {
        callback('You are not logged in.');
    }
}

function repeatLine(text, bundle, callback) {
    var n = split_command = text.smart_split(" ", 0)[0];

    if (n && Number(n) !== 0) {
        bundle.db.getNthToLastHistoryEntry(Number(n), bundle.to, function(id, sender, recipient, content, datetime) {
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
