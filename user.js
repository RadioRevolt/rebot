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
        util.loggedInAdmins[loginId] = {
            username: username,
            datetime: Date.now(),
            host: bundle.message.host
        };
        setTimeout(function() {
            delete util.loggedInAdmins[loginId];
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
