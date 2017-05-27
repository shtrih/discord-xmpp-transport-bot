# discord-jabber-transport-bot
Simple transport bot between Discord channel and Jabber conference

# How to start
 - `npm install` — install dependencies.
 - `cp local.json.sample local.json` — create configuration file. Create `production.json` for deployment.
 - `nodejs ./app.js` or `npm start` — start application.
 
# Adding Bot to Guild
 1. You need to [create an application](https://discordapp.com/developers/docs/topics/oauth2#registering-bots).
 2. [Create an invitation URL](https://discordapp.com/developers/docs/topics/oauth2#adding-bots-to-guilds).
 Bot requires 3 permissions: `READ_MESSAGES`, `SEND_MESSAGES`, `EMBED_LINKS`. For now roles decimal value is `80896`.
 
# Debugging
Set environment variable `DEBUG` to values according to [documentation](https://github.com/visionmedia/debug/blob/master/README.md): 
 - `info`
 - `error`
 - `debug:jabber`
 - `debug:discord`
 
For example, run in terminal: 
 - `$> export DEBUG=info,error,debug:discord,debug:discord,-xmpp:client`
 - `$> nodejs app.js`