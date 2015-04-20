var irc = require ('irc');
var http = require('http');
var S = require('string');

var settings = require('./settings');
var Database = require('./src/db');
var util = require('./src/util');
var user = require('./src/user');

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

function hasFields(dict, fieldArray) {
    for (f in fieldArray) {
        if (!dict.hasOwnProperty(fieldArray[f])) {
            return false;
        }
    }
    return true;
}

function setup(mode) {
    var mode_config = settings.modes[mode];
    var db = new Database(settings.database_file, mode);
    var bot = new irc.Client(
                mode_config['server'],
                mode_config['bot_name'],
                { 
                    channels: [mode_config['channel']],
                    realName: 'IRC bot by Aqwis',
                    userName: S(mode_config['bot_name']).camelize().s,
                    debug: true,
                    showErrors: true
                }
            );

    util.logToFile.mode = mode;

    var httpServer = http.createServer(function(req, res) {
        res.writeHead(200, {'Content-Type': 'application/json'});
    });
    httpServer.listen(8050, '0.0.0.0');

    var handleHTTPMessage = function(json) {
        if (!json.event) {
            console.log("Received JSON did not have an event field. Ignoring.");
            return;
        }

        if (json.token != mode_config['token']) {
            console.log("Incorrect/no token provided. Ignoring.");
            return;
        }

        var bundle = {
            "mode": mode,
            "bot": bot,
            "nick": bot.opt.nick,
            "to": mode_config['channel'],
            "db": db,
            "message": null
        };

        if (json.event == "other" && hasFields(json, ['raw_text'])) {
            speak(json.raw_text, bundle);
        } else if (json.event == "silence" && hasFields(json, ['duration', 'show', 'datetime'])) {
            speak("STILLE PÅ STREAMEN: Stille i {0}. Rapportert {1}, under en sending av {2}.".format(json.duration, json.datetime, json.show), bundle);
        }
    }
    
    var reactToHTTP = function(req, res) {
        console.log("RECEIVED MESSAGE");
        if (req.method == 'POST') {
            var data = "";
            req.on('data', function(data_fragment) {
                data += data_fragment;
                if (data.length > 1e6) {
                    request.connection.destroy();
                }
            });

            req.on('end', function() {
                try {
                    var j = JSON.parse(data);
                    handleHTTPMessage(j);
                    res.end();
                } catch (e) {
                    console.log(e);
                    console.log("An error occurred while parsing the JSON. It is possible that it is, in fact, not JSON at all!");
                    res.statusCode = 400;
                    res.end();
                }
            });
        } else {
            console.log('GET request, ignored');
            req.connection.destroy();
        }
    }

    httpServer.addListener('request', reactToHTTP);

    var reactToCommand = function(nick, to, text, message) {
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

        if (trimmed_message[0] === "^") {
            user.repeatLine(trimmed_message.slice(1), bundle, function(result_text) {
                if (result_text) {
                    speak(result_text, bundle);
                }
            });
        }
    };

    bot.addListener("message#", reactToCommand);
    bot.addListener("message", function(nick, to, text, message) {
        if (to === mode_config['bot_name']) {
            reactToCommand(nick, nick, text, message);
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

    if (!(mode in settings.modes)) {
        throw "Invalid mode";
    } else {
        setup(mode);
    }
}
