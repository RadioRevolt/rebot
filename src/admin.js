var util = require('./util');

exports.lookupAdminCommand = lookupAdminCommand;

function lookupAdminCommand(text, bundle, callback) {
    var adminCommands = {
        'lock': lockBookmark,
        'unlock': unlockBookmark,
        'ban': banRegex,
        'unban': unbanRegex,
        'listBans': listBans,
        'addAdmin': addAdmin,
        'removeAdmin': removeAdmin,
        'changePassword': changeAdminPassword
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

function addAdmin(text, bundle, callback) {
    var split_command = text.split(" ");
    var username = split_command[1];
    var password = split_command[2];

    bundle.db.addAdmin(username, password, function(success) {
        if (success) {
            callback("Successfully added admin.");
        } else {
            callback("An error occurred while trying to add admin.");
        }
    });
}

function removeAdmin(text, bundle, callback) {
    var split_command = text.split(" ");
    var username = split_command[1];

    bundle.db.removeAdmin(username, function(success) {
        if (success) {
            callback("Successfully removed admin.");
        } else {
            callback("An error occurred while trying to remove admin.");
        }
    });
}

function changeAdminPassword(text, bundle, callback) {
    var split_command = text.split(" ");
    var newPassword = split_command[1];
    var username = bundle.message.user;

    bundle.db.changeAdminPassword(username, newPassword, function(success) {
        if (success) {
            callback("Successfully changed your password.");
        } else {
            callback("An error occurred while trying to change your password.");
        }
    });
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

function banRegex(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);
    var regex = split_command[1];

    bundle.db.banRegex(regex, function(success) {
        if (success) {
            callback("Banned regex " + regex + ".");
        } else {
            callback("An error occured while banning regex " + regex + ". Maybe it's already banned?");
        }
    });
}

function unbanRegex(text, bundle, callback) {
    var split_command = text.smart_split(" ", 2);
    var regex = split_command[1];

    bundle.db.unbanRegex(regex, function(success) {
        if (success) {
            callback("Removed ban on regex " + regex + ".");
        } else {
            callback("An error occured while removing ban on regex " + regex + ". Are you sure it's banned?");
        }
    });
}

function listBans(text, bundle, callback) {
    bundle.db.getAllBans(function(bans) {
        if (bans.length > 0) {
            callback("List of banned regexes:");
            for (var i = 0; i < bans.length; i++) {
                callback(" * " + bans[i].regex);
            }
        } else {
            callback("No banned regexes.");
        }
    });
}
