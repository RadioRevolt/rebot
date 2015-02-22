var irc = require ('irc');
var S = require('string');

var settings = require('./settings');
var Database = require('./src/db');
var util = require('./src/util');
var user = require('./src/user');
var admin = require('./src/admin');

main();


function speak(text, bundle) {
    var lines = text.split("<br>");
    var truncated_lines = lines.slice(0, 3);

    for (var i = 0; i < truncated_lines.length; i++) {
        processed_text = util.htmlToIRC(S(truncated_lines[i]).decodeHTMLEntities().s);
        bundle.bot.say(bundle.to, processed_text);
        util.addToHistory({ "from": bundle.bot.opt.nick, "to": bundle.to, "text": processed_text }, bundle);
    }

    if (lines.length > truncated_lines.length) {
        speak("... (truncated output -- originally " + lines.length + " lines) ...", bundle);
    }
}

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

    util.logToFile.mode = mode;

    var reactToMessage = function(nick, to, text, message) {
        var trimmed_message = text.trim();
        var result_text = "";

        var bundle = {
            "mode": mode,
            "bot": bot,
            "nick": nick,
            "to": to,
            "db": db,
            "message": message,
        };

        util.addToHistory({"from": nick, "to": to, "text": text}, bundle);

        if (trimmed_message[0] === ".") {
            // Commands available to all users are prefixed with .
            user.lookupUserCommand(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
        } else if (trimmed_message[0] === "@") {
            // Commands available to administrators are prefixed with @
            admin.lookupAdminCommand(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
        } else if (trimmed_message[0] === "^") {
            user.repeatLine(trimmed_message.slice(1), bundle, function(result_text) {
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

function convert(mode) {
    var db = new Database(settings.database_file, mode);

    db.convertToSqlite3(mode, function() {
        console.log("Finished converting.");
    });
}

function main() {
    var mode = process.argv[2];

    if (mode == "convert") {
        if (!(process.argv[3] in settings.modes)) {
            throw "Please specify a mode to convert"
        }
        convert(process.argv[3]);
    } else {
        if (!(mode in settings.modes)) {
            throw "Invalid mode";
        } else {
            setup(mode);
        }
    }
}
