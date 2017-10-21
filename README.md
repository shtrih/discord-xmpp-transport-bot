# discord-jabber-transport-bot
Simple transport bot between Discord channel and Jabber (XMPP MUC) conference.
You can join several conferences on one bot instance.

# How to start
 - You need a working installation of [Node.js](https://nodejs.org) (version >= 7.7.1) on the machine this bot will run on. `npm` is installed with Node.js.
 - `npm install` — install dependencies.
 - `cp local.json.sample local.json` — create configuration file. Create `production.json` for deployment.
 - Edit configuration files. See section `Adding Bot to Guild`.
 - `nodejs ./app.js` or `npm start` — start application.
 
# Adding Bot to Discord Guild
 1. You need to [create an application](https://discordapp.com/developers/docs/topics/oauth2#bots) on [My Apps](https://discordapp.com/developers/applications/me) page.
 2. Create an invitation URL as decribed on [this page](https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow).
 Bot requires 3 [permissions](https://discordapp.com/developers/docs/topics/permissions): `READ_MESSAGES`, `SEND_MESSAGES`, `EMBED_LINKS`. For now roles decimal value is `80896`.
 
# Debugging
Set environment variable `DEBUG` to values according to [documentation](https://github.com/visionmedia/debug/blob/master/README.md): 
 - `info`
 - `error`
 - `debug:jabber`
 - `debug:discord`
 
For example, run in Linux terminal: 
 - `$> export DEBUG=info,error,debug:discord,debug:discord,-xmpp:client`
 - `$> nodejs app.js`