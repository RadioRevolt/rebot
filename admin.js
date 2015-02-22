var util = require('./util');

exports.lookupAdminCommand = lookupAdminCommand;

function lookupAdminCommand(text, bundle, callback) {
    var adminCommands = {
        'lock': lockBookmark,
        'unlock': unlockBookmark,
        'block': blockUser,
        'unblock': unblockUser
    }

    var command = text.split(" ", 2)[0];

    var loggedIn = false;
    for (var key in util.loggedInAdmins) {
        if (util.loggedInAdmins[key].username === bundle.message.user) {
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
