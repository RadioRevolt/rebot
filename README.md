# Nisse

A simple bookmarking IRC bot written in node.js. Copy settings.js.example to settings.js and modify it to suit your needs, then run the bot with one of the modes defined in settings.js as the first argument. Bookmarks are stored in JSON files in the bookmarks folder.

## Commands

* ```.bookmark <keyword> <text>``` (adds bookmark)
* ```.unmark <keyword>``` (removes bookmark)
* ```.search <keyword>``` (searches for bookmarks)
* ```^n``` (repeats line current-n)
