# discord-jabber-transport-bot
Simple transport bot between Discord channel and Jabber (XMPP MUC) conference.
You can join several conferences on one bot instance.

# How to start
 - You need a working installation of [Node.js](https://nodejs.org) (version >= 7.7.1) on the machine this bot will run on. `npm` is installed with Node.js.
 - `npm install` — install dependencies.
 - `cp local.json.sample local.json` — create configuration file. Create `production.json` for deployment.
 - Edit configuration files. See section `Adding Bot to Guild`.
 - `nodejs ./app.js` or `npm start` — start application.
 - Type `!ping` in discord channel to check "pong" answer.

# Adding Bot to Discord Guild
 1. You need to [create an application](https://discordapp.com/developers/docs/topics/oauth2#bots) on [My Apps](https://discordapp.com/developers/applications/me) page.
 2. Create an invitation URL as decribed on [this page](https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow). 
 For ease of use, it is recommended to use [this website](https://discordapi.com/permissions.html#536890368).
 
 Bot requires 3 [permissions](https://discordapp.com/developers/docs/topics/permissions): `READ_MESSAGES`, `SEND_MESSAGES`, `EMBED_LINKS`. For now roles decimal value is `19456`.

 Also optional permission is `MANAGE_WEBHOOKS` (requires 2FA). Set it if you want to bot send messages to discord on behalf of jabber user nickname.

# Debugging
Set environment variable `DEBUG` to values according to [documentation](https://github.com/visionmedia/debug/blob/master/README.md): 
 - `info`
 - `error`
 - `debug:jabber`
 - `debug:discord`

For example, run in Linux terminal: 
 - `$> export DEBUG=info,error,debug:discord,debug:discord,-xmpp:client`
 - `$> nodejs app.js`

# Docker
Also you can run it in a [docker](https://docs.docker.com/) container:
1. `cd ~/projects/discord-xmpp-transport-bot`
2. `sudo docker run --rm -it -v $(pwd):/src:rw mkenney/npm:node-7.7-alpine "npm install"`
3. `sudo docker run --rm -it -v $(pwd):/src:ro mkenney/npm:node-7.7-alpine "npm run start-debug"`

# Bot commands

All commands works only from discord side. Bot answers visible only in discord.

|Command|Description|Where works|
|---|---|---|
|`!ping`|Answers «pong».|Direct Message, Room|
|`!say <room> Text`|Say something behalf of bot. You can use jabber conference or discord room ID as <room> parameter (see `!rooms` command). This command only works for bot admin (adminId in config file)|DM, Room|
|`!users`|Show users from linked jabber conference. Also show who is ignored by `!ignore` command|Room|
|`!rooms`|Show linked jabber conferences|DM, Room|
|`!ignore JabberUsername`|Ignore user from jabber by nickname. If he change nickname → he will be ignored with new nickname.|Room|
|`!unignore JabberUsername`|Stop ingnoring some user|Room|