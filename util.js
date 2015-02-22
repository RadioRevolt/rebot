var fs = require ('fs');
var crypto = require('crypto');

exports.loggedInAdmins = {};

String.prototype.smart_split = function(separator, limit) {
    var split_str = this.split(separator);
    var new_split_array = []

    for (var i = 0; i < limit; i++) {
        new_split_array.push(split_str[i]);
    }

    new_split_array[limit] = split_str.slice(limit).join(separator);

    return new_split_array;
}

function htmlToIRC(string) {
    return string
                .replace("<b>", "")
                .replace("</b>", "")
                .replace("<i>", "\x1D")
                .replace("</i>", "\x1D");
}
exports.htmlToIRC = htmlToIRC;

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
exports.hash = hash;

/* Logging */

function addToHistory(message, bundle) {
    bundle.db.pushToHistory(message.from, message.to, message.text, Date.now(), function(status) {
        console.log(message);
    });
}
exports.addToHistory = addToHistory;

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
exports.logToFile = logToFile;
