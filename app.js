/*
 Create app: https://discordapp.com/developers/applications/me
 Invite bot to Discord: https://discordapp.com/oauth2/authorize?client_id=197985532670771200&scope=bot&permissions=19472
 Client ID: https://discordapp.com/developers/docs/topics/oauth2#adding-bots-to-guilds
 Permissions: https://discordapp.com/developers/docs/topics/permissions#bitwise-permission-flags
 See also: https://gist.github.com/powdahound/940969
 */

var Discord = require('discord.io');
var Xmpp = require('node-xmpp-client');
var util = require('util');
var Config = require('json-config')({
    config_dir: "./",
    default_env: ".app"
});

var discord = new Discord.Client({
        token: Config.discord.token,
        autorun: true
    }),
    jabber = new Xmpp.Client({
        jid: Config.jabber.userJid,
        password: Config.jabber.userPass
    })
;

discord.on('ready', function () {
    console.log(discord.username + " - (" + discord.id + ")");
});

discord.on('message', function (user, userID, channelID, message, event) {
    if (message === "ping") {
        discord.sendMessage({
            to: channelID,
            message: "pong"
        });
    }
    else if (Config.discord.channelId == channelID) {
        if (!message.match(/^>.+:/)) {
            jabber.send(new Xmpp.Element('message', { to: Config.jabber.roomJid, type: 'groupchat' }).
                c('body').t('>' + user + ': ' + message)
            );
        }
    }
});


jabber.on('online', function () {
    console.log('We are online!');
    //var elm2 = new xmpp.Element('presence', { from: jid, to: 'alfred@conference.localhost'}).c('x', {'xmlns': 'http://jabber.org/protocol/muc' }).up();

    // set ourselves as online
    /*jabber.send(new xmpp.Element('presence', { type: 'available' }).
     c('show').t('chat')
     );*/

    jabber.send(new Xmpp.Element('presence', { to: Config.jabber.roomJid + '/' + Config.jabber.roomNick }).
        c('x', { xmlns: 'http://jabber.org/protocol/muc' })
    );

    /*jabber.send(new xmpp.Element('message', { to: Config.jabber.roomJid, type: 'groupchat' }).
     c('body').t('test')
     );*/
});

jabber.on('error', function (e) {
    util.log(e);
});

jabber.on('connection', function () {
    util.log('online');
});

jabber.on('stanza', function (stanza) {
    util.log('Incoming stanza: ', stanza.toString());

    // always log error stanzas
    if ('error' == stanza.attrs.type) {
        util.log('[error] ' + stanza);
        return;
    }

    // ignore everything that isn't a room message
    if (!stanza.is('message') || !stanza.attrs.type == 'groupchat') {
        return;
    }

    // ignore messages we sent
    if (stanza.attrs.from == Config.jabber.roomJid + '/' + Config.jabber.roomNick) {
        return;
    }

    /**
     * TODO: Переименовался
     * Incoming stanza:  <presence from="dumb@conference.hitagi.ru/shtrih" to="senjougahara-hitagi@jabber.ru/2438158504" type="unavailable" xmlns:stream="http://etherx.jabber.org/streams"><x xmlns="http://jabber.org/protocol/muc#user"><item jid="crab@hitagi.ru/su" affi
     liation="none" role="participant" nick="asd"/><status code="303"/></x></presence>
     Incoming stanza:  <presence from="dumb@conference.hitagi.ru/asd" to="senjougahara-hitagi@jabber.ru/2438158504" xml:lang="ru" xmlns:stream="http://etherx.jabber.org/streams"><x xmlns="vcard-temp:x:update"><photo/></x><priority>25</priority><c xmlns="http://jabber
     .org/protocol/caps" node="http://qip.ru/caps" ver="6848" ext="voice-v1 webcam-v1"/><x xmlns="http://jabber.org/protocol/muc#user"><item jid="crab@hitagi.ru/su" affiliation="none" role="participant"/></x></presence>
     * Зашел:
     * <presence from="dumb@conference.hitagi.ru/alien.army.knife" to="senjougahara-hitagi@jabber.ru/3945639340" xmlns:stream="http://etherx.jabber.org/streams"><priority>1</priority><c xmlns="http://jabber.org/protocol/caps" node="http://pidgin.im/"
     hash="sha-1" ver="s/y3ONmuAkM0tFGeXowWeZc6/Hc="/><x xmlns="vcard-temp:x:update"><photo/></x><x xmlns="http://jabber.org/protocol/muc#user"><item jid="alien.army.knife@jabber.ru/IDSE" affiliation="none" role="participant"/></x></presence>
     * Вышел:
     *
     */

    var body = stanza.getChild('body'),
        subject = stanza.getChild('subject')
    ;
    if (subject) {
        var topic = (body ? body : subject).getText();
        util.log('Try to set discord topic: ', topic);
        discord.editChannelInfo({
            channel: Config.discord.channelId,
            topic: topic
        });
    }

    // message without body is probably a topic change
    if (!body) {
        return;
    }

    var message = body.getText(),
        from_nick = stanza.attrs.from.split('/', 2)[1]
    ;

    if (!message.match(/^>.+:/)) {
        discord.sendMessage({
            to: Config.discord.channelId,
            message: '>' + from_nick + ': ' + message
        });
    }
});
