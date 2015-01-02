# Nisse

A simple bookmarking IRC bot written in node.js. Copy settings.js.example to settings.js and modify it to suit your needs, then run the bot with one of the modes defined in settings.js as the first argument. Nisse uses a simple SQLite3 database to store bookmarks and channel history; the filename of this database can also be set in settings.js.

## Commands

* ```.bookmark <keyword> <text>``` (adds bookmark)
* ```.unmark <keyword>``` (removes bookmark)
* ```.search <keyword>``` (searches for bookmarks)
* ```^n``` (repeats line current-n)

## Bookmark formatting

Use ```<br>``` within a bookmark to add a newline to the bookmark output. Similarly, use ```<b>``` and ```</b>``` to make the text within the tags bold (only supported in certain IRC clients) and ```<i>``` and ```</i>``` to make the text italic.
