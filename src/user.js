var uuid = require('node-uuid');

var settings = require('../settings');
var util = require('./util');

exports.lookupUserCommand = lookupUserCommand;
exports.repeatLine = repeatLine;

function lookupUserCommand(text, bundle, callback) {
    var userCommands = {
        'bookmark': function(text, bundle, callback) {
            util.callUnlessBanned(createBookmark, text, bundle, callback);
        },
        'unmark': function(text, bundle, callback) {
            util.callUnlessBanned(deleteBookmark, text, bundle, callback);
        },
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
