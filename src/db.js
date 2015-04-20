var sqlite3 = require('sqlite3').verbose();
var uuid = require('node-uuid');
var moment = require('moment');

var util = require('./util');

function Database(filename, mode) {
    var self = this;

    this.db = new sqlite3.Database(filename);
    this.mode = mode;

    this.db.serialize(function() {
        self.db.run("CREATE TABLE IF NOT EXISTS History (id PRIMARY KEY, sender TEXT, recipient TEXT, content TEXT, datetime DATETIME, mode TEXT)");
    });

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
}

module.exports = Database;
