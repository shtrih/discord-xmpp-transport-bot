# discord-jabber-transport-bot
Simple transport bot between Discord channel and Jabber conference

# How to start
 - `npm install` — install dependencies
 - `cp local.json.sample local.json` — create configuration file. Local and production.json for deployment
 - `nodejs ./app.js` or `npm start` — start application
 
# Debugging
Set environment variable `DEBUG` to values according to [documentation](https://github.com/visionmedia/debug/blob/master/README.md): 
 - `info`
 - `error`
 - `debug:jabber`
 - `debug:discord`
