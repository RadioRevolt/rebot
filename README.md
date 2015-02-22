# Nisse

A simple bookmarking IRC bot written in node.js. Copy settings.js.example to settings.js and modify it to suit your needs, then run the bot with one of the modes defined in settings.js as the first argument. Nisse uses a simple SQLite3 database to store bookmarks and channel history; the filename of this database can also be set in settings.js.

## Commands

* ```.bookmark <keyword> <text>``` (adds bookmark)
* ```.unmark <keyword>``` (removes bookmark)
* ```.search <keyword>``` (searches for bookmarks)
* ```^n``` (repeats line current-n)

## Administration

Nisse has several administration commands that you can use once logged in as an administrator. To begin with, define a username and password for the superuser in settings.js. You can then log in as this superuser by typing

* ```.login <password>```

It is recommended that you don't continue to use the superuser account, as the password to this account is exposed in plaintext in settings.js. Instead, create an administrator account for yourself using

* ```.addAdmin <username> <password>```

while logged in as superuser. You can then safely remove the superuser account by setting the username and password to empty strings in settings.js. The next time you want to use one of the administrator commands, you can log into your administrator account in the same way as you logged in as superuser. Once logged in as administrator, you have access to the following administration commands:

* ```.lock <bookmark>``` (prevent users from editing a bookmark)
* ```.unlock <bookmark>``` (allow users to edit bookmark)
* ```.block <regex>``` (prevent a user, given by username regex, from creating or altering bookmarks)
* ```.unblock <regex>``` (remove block on user)
* ```.addAdmin <username> <password>``` (create administrator user)
* ```.removeAdmin <username> <password>``` (remove administrator user)
* ```.changePassword <password>``` (change your own administrator password)

## Bookmark formatting

Use ```<br>``` within a bookmark to add a newline to the bookmark output. Similarly, use ```<b>``` and ```</b>``` to make the text within the tags bold (only supported in certain IRC clients) and ```<i>``` and ```</i>``` to make the text italic.
