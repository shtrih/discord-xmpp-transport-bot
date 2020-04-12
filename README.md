# discord-jabber-transport-bot
Simple transport bot between Discord channel and Jabber (XMPP MUC) conference.
You can join several conferences on one bot instance.

# How to start
 - You need a working installation of [Node.js](https://nodejs.org) (version >= 7.7.1) on the machine this bot will run on. `npm` is installed with Node.js.
 - Install dependencies: `npm install`.
 - Create configuration file: `cp config/development.cjson.sample config/development.cjson`. Create `production.cjson` for production mode (`NODE_ENV=production`).
 - Edit configuration files. See section `Adding Bot to Discord Guild` below.
 - Start application: `nodejs ./app.js` or `npm start`.
 - Type `!ping` in discord channel to check "pong" answer.

# Adding Bot to Discord Guild
 1. You need to [create an application](https://discordapp.com/developers/docs/topics/oauth2#bots) on [My Apps](https://discordapp.com/developers/applications/me) page.
 2. Create an invitation URL as described on [Bot Authorization Flow](https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow) documentation page. 
 For ease of use, it is recommended to use this website: [https://discordapi.com/permissions.html](https://discordapi.com/permissions.html#536890384).
 
    Bot requires 3 [permissions](https://discordapp.com/developers/docs/topics/permissions): `READ_MESSAGES`, `SEND_MESSAGES`, `EMBED_LINKS`.

    There are two optional permissions: `MANAGE_CHANNELS` and `MANAGE_WEBHOOKS` (both requires [Two-Factor Authentication](https://support.discordapp.com/hc/en-us/articles/219576828-Setting-up-Two-Factor-Authentication)). 

    Set `MANAGE_CHANNELS` if you want to bot set channel topic from jabber to discord (one way sync).

    Set `MANAGE_WEBHOOKS` permission if you want to bot send messages to discord on behalf of jabber user nickname.
    
 3. You need to navigate to this URL, you'll be prompted to add the bot to a guild in which you have proper permissions. On acceptance, the bot will be added.

# Debugging
Set environment variable `DEBUG` to values according to [`debug` package documentation](https://github.com/visionmedia/debug/blob/master/README.md). This application uses values: `info`, `info:app`, `info:jabber`, `error`, `error:app`, `error:discord`, `debug:app`, `debug:jabber`, `debug:discord`.

For example, run in Linux terminal: 
 - `$> export DEBUG=info,error,debug:discord,-xmpp:client`
 - `$> node app.js`

If `DEBUG` is not set then it sets to `log all except debug` settings: [app.js#L3-L5](https://github.com/shtrih/discord-xmpp-transport-bot/blob/master/app.js#L3-L5).

# Docker
Also you can run it in a [docker](https://docs.docker.com/) container:
1. `cd ~/projects/discord-xmpp-transport-bot`
2. `sudo docker run --rm -it -v $(pwd):/src:rw mkenney/npm:node-7.7-alpine "npm install"`
3. `sudo docker run --rm -it -v $(pwd):/src:ro mkenney/npm:node-7.7-alpine "npm run start-debug"`

Or use Dockerfile:
1. Build the image: `sudo docker build -t discord-xmpp-transport-image .`
2. Run the container: `sudo docker run -it --rm --name dscrd-xmpp-brdg -e NODE_ENV=production -e DEBUG=info,error:*,debug:* discord-xmpp-transport-image`

Run using docker-compose:
* Development mode: `sudo docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build`
* Production mode: `sudo docker-compose up --build -d`

# Bot commands

All commands work only from discord side. The bot answers visible only in discord.

|Command|Description|Where works|
|---|---|---|
|`!ping`|Answers «pong».|Direct Message, Room|
|`!say <room> Text`|Say something behalf of the bot. You can use jabber conference or discord room ID as <room> parameter (see `!rooms` command). This command only works for bot admin (`adminId` in the config file)|DM, Room|
|`!rooms`|Show linked jabber conferences|DM, Room|
|`!users`|Show users from linked jabber conference. Also, show who is ignored by `!ignore` command|Room|
|`!ignore JabberUsername`|Ignore user from jabber by a nickname. If he changes nickname → he will be ignored with a new nickname.|Room|
|`!unignore JabberUsername`|Stop ignoring some user|Room|
