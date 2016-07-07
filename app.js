/*
 Create app: https://discordapp.com/developers/applications/me
 Invite bot to Discord: https://discordapp.com/oauth2/authorize?client_id=197985532670771200&scope=bot&permissions=19472
 Client ID: https://discordapp.com/developers/docs/topics/oauth2#adding-bots-to-guilds
 Permissions: https://discordapp.com/developers/docs/topics/permissions#bitwise-permission-flags
 See also: https://gist.github.com/powdahound/940969
 */

var Discord = require('discord.io'),
    Xmpp = require('node-xmpp-client'),
    debug = require('debug'),
    PrintDebug = debug('debug'),
    PrintDebugJabber = debug('debug:jabber'),
    PrintDebugDiscord = debug('debug:discord'),
    PrintInfo = debug('info'),
    PrintError = debug('error'),
    Config = require('json-config')
;

/*
var stanza = Xmpp.createStanza('message', {from: 'test', to: 'asda', type: 'asd'}, new Xmpp.Element('body').t('>asdasdas'));
console.log(stanza.toString(), stanza.from, stanza.foo, stanza.attrs.foo);
console.log(Xmpp.createStanza('message', {from: 'test', to: 'asda', type: 'asd'}).c('body').t('>asdasdas').up().toString());
console.log((new Xmpp.Element('message', { to: 'asd', type: 'groupchat' })).toString());
*/

new App().run();

function App() {
    var self = this,
        discord,
        jabber,
        config = Config({
            config_dir: "./"
        }),
        jid_by_channel = {},
        channel_by_jid = {},
        nick_by_jid = {},
        jabber_connected_users = {}
    ;

    self.run = function () {
        discord = new Discord.Client({
            token: config.discord.token,
            autorun: true
        });
        jabber = new Xmpp.Client({
            jid: config.jabber.userJid,
            password: config.jabber.userPass
        });

        discord.on('ready', function () {
            PrintInfo('Connected to discord as ' + discord.username + " - (" + discord.id + ")");

            discord.on('disconnect', discord.connect);

            // debug all discord.io events
            discord.on('debug', PrintDebugDiscord);
        });

        discord.on('message', function (fromNickname, userID, channelID, message, event) {
//            PrintDebug('jabber_connected_users', jabber_connected_users);
            if ("ping" === message) {
                discord.sendMessage({
                    to: channelID,
                    message: "pong"
                });
            }
            else if ("users" === message) {
                if ("object" === typeof(jabber_connected_users[ jid_by_channel[channelID] ]))
                    discord.sendMessage({
                        to: channelID,
                        message: 'Участники: ' + Object.keys(jabber_connected_users[ jid_by_channel[channelID] ]).join(', ')
                    });
            }
            else if (userID != discord.id && jid_by_channel[channelID]) {
                // https://discordapp.com/developers/docs/resources/channel#message-formatting
                message = discord.fixMessage(message);

                jabber.send(
                    Xmpp.createStanza('message', {to: jid_by_channel[channelID], type: 'groupchat'}, new Xmpp.Element('body').t('от ' + fromNickname + ': ' + message))
                );
            }
        });

        jabber.on('online', function () {
            PrintInfo('Connected to jabber as ' + config.jabber.userJid);

            // set ourselves as online
            /*jabber.send(new xmpp.Element('presence', { type: 'available' }).
             c('show').t('chat')
             );*/

            for (var i = 0 ; i < config.roomList.length; i++) {
                PrintInfo('Connecting to conf %s as %s', config.roomList[i].roomJid, config.roomList[i].nick);
                self.join(config.roomList[i].roomJid, config.roomList[i].nick);

                jid_by_channel[ config.roomList[i].roomChannelId ] = config.roomList[i].roomJid;
                channel_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].roomChannelId;
                nick_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].nick;
            }
        });

        jabber.on('error', function (e) {
            PrintError(e);
        });

        jabber.on('connection', function () {
            PrintInfo('Jabber online');
        });

        jabber.on('stanza', function (stanza) {
            PrintDebugJabber('Incoming stanza: ', stanza.toString());

            var from = stanza.from.split('/', 2),
                from_jid = from[0],
                from_nick = from[1],
                channel = channel_by_jid[from_jid],
                message,
                use_nick
            ;

            if ('error' == stanza.type) {
                PrintError('[Stanza error] ' + stanza);
                return;
            }

            switch (stanza.getName()) {
                case 'presence': {
                    if (!config.jabber.showPresence)
                        break;

                    if ('unavailable' === stanza.type) {
                        // change nick
                        var x = stanza.getChildByAttr('code', '303', null, true),
                            item = stanza.getChildrenByFilter(
                                function (el) {
                                    return el instanceof Xmpp.Element && el.getName() === 'item';
                                },
                                true
                            )[0]
                        ;

                        if (x && item) {
                            var new_nick = item.getAttr('nick');
                            jabber_connected_users[from_jid][new_nick] = true;
                            message = from_nick + ' переименовался в ' + new_nick + '.';
                        }
                        else {
                            message = from_nick + ' отключился.'
                        }

                        delete jabber_connected_users[from_jid][from_nick];
                    }
                    else {
                        if (!jabber_connected_users[from_jid])
                            jabber_connected_users[from_jid] = {};

                        if (!jabber_connected_users[from_jid][from_nick]) {
                            message = from_nick + ' подключился.';
                        }

                        jabber_connected_users[from_jid][from_nick] = true;
                    }

                    // formatting
                    if (message)
                        message = '*'+ message +'*';
                }
                break;

                case 'message': {
                    use_nick = true;
                    var body = stanza.getChild('body');
                    if ('groupchat' === stanza.type) {
                        if (stanza.from == from_jid + '/' + nick_by_jid[from_jid]) {
                            break;
                        }

                        var subject = stanza.getChild('subject');
                        if (subject) {
                            var topic = (body ? body : subject).getText();
                            PrintDebugJabber('Try to set discord topic: ', topic);
                            discord.editChannelInfo({
                                channel: channel,
                                topic: topic + '\n ~ ' + from_jid
                            });

                            break;
                        }

                        message = body.getText();
                    }
                    else if ('chat' === stanza.type) {
                        // direct messages
                    }
                }
                break;

                case 'iq':
                break;
            }

            if (message && !message.match(/^>.+:/)) {
                discord.sendMessage({
                    to: channel,
                    message: (use_nick ? '>**' + from_nick + '**: ' : '') + message
                });
            }
        });
    };

    self.join = function(JID, nickname) {
        jabber.send(
            Xmpp.createStanza('presence', {to: JID + '/' + nickname}, new Xmpp.Element('x', { xmlns: 'http://jabber.org/protocol/muc' }))
        );
    };
}

