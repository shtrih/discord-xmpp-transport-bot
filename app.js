"use strict";

/*
 Create app: https://discordapp.com/developers/applications/me
 Invite bot to Discord: https://discordapp.com/oauth2/authorize?client_id=197985532670771200&scope=bot&permissions=19472
 Client ID: https://discordapp.com/developers/docs/topics/oauth2#adding-bots-to-guilds
 Permissions: https://discordapp.com/developers/docs/topics/permissions#bitwise-permission-flags
 See also: https://gist.github.com/powdahound/940969
 */

if (!process.env.DEBUG) {
    process.env.DEBUG = 'info,error:*,-debug:*';
}

const Discord = require('./lib/RemDiscord.js'),
    Xmpp = require('./lib/RamXmpp.js'),
    debug = require('debug'),
    PrintDebug = debug('debug:app'),
    PrintDebugJabber = debug('debug:jabber'),
    PrintErrorJabber = debug('error:jabber'),
    PrintInfo = debug('info'),
    PrintError = debug('error:app'),
    Config = require('json-config'),
    Ignore = require('./lib/ignoreUsers.js')()
;

new App().run();

function App() {
    var self = this,
        remDiscord,
        ramXmpp,
        discord,
        jabber,
        config = Config({
            config_dir: "./"
        }),
        jid_by_channel = {},
        channel_by_jid = {},
        nick_by_jid = {},
        nick_mask = {},
        show_presence_by_jid = {},
        jabber_connected_users = {},
        conference_reconnect_interval
    ;

    self.run = function () {
        remDiscord = new Discord(config.discord.token, true);
        discord = remDiscord.getClient();
        ramXmpp = new Xmpp(config.jabber.userJid, config.jabber.userPass);
        jabber = ramXmpp.getClient();

        discord.on('ready', function () {
            PrintInfo('Connected to discord as ' + discord.username + " - (" + discord.id + ")");

            discord.on('disconnect', discord.connect);

            // debug all discord.io events
            discord.on('debug', PrintDebugDiscord);
        });

        discord.on('message', function (fromNickname, userID, channelID, message, event) {
//            PrintDebug('jabber_connected_users', jabber_connected_users);
            var match;

            if ("ping" === message) {
                remDiscord.send(
                    channelID,
                    "pong"
                );
            }
            else if ("!users" === message) {
                var reply = 'Не получила сведения о присутствии. Попробуйте повторить завтра.';
                var ignored = Ignore.list().join(', ');

                if ("object" === typeof(jabber_connected_users[ jid_by_channel[channelID] ]))
                    reply = '**Участники:** ' + Object.keys(jabber_connected_users[ jid_by_channel[channelID] ]).join(', ');

                if (ignored)
                    reply += '\n**В игноре:** ' + ignored;

                remDiscord.send(
                    channelID,
                    reply
                );
            }
            else if (match = message.match(/^!((un)?ignore)\s+(.*)/i)) {
                var nickname = match[3],
                    ignore = 'ignore' === match[1],
                    prefix = ignore ? '' : 'un'
                ;

                if (ignore) {
                    Ignore.add(nickname)
                }
                else {
                    Ignore.remove(nickname)
                }

                remDiscord.send(
                    channelID,
                    '*'+ nickname +'* '+ prefix +'ignored.'
                );
            }
            else if (userID != discord.id && jid_by_channel[channelID]) {
                var userNick = remDiscord.fixMessage('<@!'+ userID +'>');
                userNick = self.getNicknameWMask(jid_by_channel[channelID], userNick);
                var attachments = remDiscord.getAttachments(event);
                message = remDiscord.fixMessage(message);

                ramXmpp.send(jid_by_channel[channelID], userNick + message + attachments);
            }
        });

        jabber.on('online', function () {
            PrintInfo('Connected to jabber as ' + config.jabber.userJid);

            for (var i = 0 ; i < config.roomList.length; i++) {
                PrintInfo('Connecting to conf %s as %s', config.roomList[i].roomJid, config.roomList[i].nick);
                ramXmpp.join(config.roomList[i].roomJid, config.roomList[i].nick);

                jid_by_channel[ config.roomList[i].roomChannelId ] = config.roomList[i].roomJid;
                channel_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].roomChannelId;
                nick_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].nick;
                nick_mask[ config.roomList[i].roomJid ] = config.roomList[i].fromNickMask;
                show_presence_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].showPresence;
            }

            // TODO: handle disconnect events by status codes (http://xmpp.org/extensions/xep-0045.html#registrar-statuscodes)
            conference_reconnect_interval = setInterval(function () {
                for (var i = 0 ; i < config.roomList.length; i++) {
                    PrintInfo('Reconnecting to conf %s as %s', config.roomList[i].roomJid, config.roomList[i].nick);
                    ramXmpp.join(config.roomList[i].roomJid, config.roomList[i].nick);
                }
            }, (config.jabber.reconnectIntervalSec || 600) * 1000);
        });

        jabber.on('offline', function () {
            jid_by_channel = {};
            channel_by_jid = {};
            nick_by_jid = {};
            nick_mask = {};
            show_presence_by_jid = {};
            jabber_connected_users = {};
            clearInterval(conference_reconnect_interval);

            setTimeout(function () {jabber.connect()}, 5000)
        });

        jabber.on('error', function (e) {
            PrintErrorJabber(e);

            if (config.discord.adminId) {
                remDiscord.send(
                    config.discord.adminId,
                    '**[Jabber error]** `' + e + '`'
                );
            }
        });

        jabber.on('connection', function () {
            PrintInfo('Jabber online');
        });

        jabber.on('stanza', function (stanza) {
            // PrintDebugJabber('Incoming: ', stanza.toString());

            var from = stanza.from.split('/', 2),
                from_jid = from[0],
                from_nick = from[1],
                channel = channel_by_jid[from_jid],
                message,
                use_nick
            ;

            if ('error' === stanza.type) {
                PrintErrorJabber('[Stanza error] ' + stanza);

                remDiscord.send(
                    channel,
                    '**[Stanza error]** ```' + stanza + '```'
                );

                return;
            }

            switch (stanza.getName()) {
                case 'presence': {
                    if ('unavailable' === stanza.type) {
                        // change nick
                        var x = stanza.getChildByAttr('code', '303', null, true),
                            item = stanza.getChildrenByFilter(
                                function (el) {
                                    return el instanceof jabber.Element && el.getName() === 'item';
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

                    if (typeof show_presence_by_jid[from_jid] === 'boolean') {
                        if (!show_presence_by_jid[from_jid])
                            message = '';
                    }
                    else if (!config.jabber.showPresence) {
                        message = '';
                    }
                }
                break;

                case 'message': {
                    // ours messages from the discord
                    if (from_nick === nick_by_jid[from_jid])
                        return;

                    use_nick = true;
                    var body = stanza.getChild('body'),
                        x = stanza.getChild('x'),
                        delay = stanza.getChild('delay'),
                        subject = stanza.getChild('subject')
                    ;

                    /* Skip chat history
                     *
                     * <message from="dumb@conference.hitagi.ru/crab" to="senjougahara-hitagi@jabber.ru/1502680524" type="groupchat" id="purple97826163" xmlns:stream="http://etherx.jabber.org/streams">
                     *     <body>123</body>
                     *     <x xmlns="jabber:x:delay" stamp="20160708T09:43:37"/>
                     * </message>
                     *
                     * <message from="animufags@conference.jabber.ru/Инопланетная бaка" to="senjougahara-hitagi@jabber.ru/1035180042" xml:lang="ru" type="groupchat" id="ab55a" xmlns:stream="http://etherx.jabber.org/streams">
                     *     <body>он вроде просто писал любое сообщение и она глючила</body>
                     *     <delay xmlns="urn:xmpp:delay" from="animufags@conference.jabber.ru" stamp="2016-07-13T19:46:31.799Z"/>
                     * </message>
                     */
                    if (!subject && (delay || x && 'jabber:x:delay' === x.getAttr('xmlns'))) {
                        break;
                    }

                    /* Server messages
                     *
                     *  <message from='dumb@conference.hitagi.ru' to='senjougahara-hitagi@jabber.ru/52626594' type='groupchat'>
                     *      <body>This room is not anonymous</body>
                     *      <x xmlns='http://jabber.org/protocol/muc#user'><status code='100'/></x>
                     *  </message>
                     */
                    if (!from_nick)
                        from_nick = 'Server';

                    if ('groupchat' === stanza.type) {
                        if (stanza.from === from_jid + '/' + nick_by_jid[from_jid]) {
                            break;
                        }

                        if (Ignore.check(from_nick)) {
                            PrintDebugDiscord('Ignore msg from ' + from_nick);
                            break;
                        }

                        if (subject) {
                            var topic = (body ? body : subject).getText();
                            PrintDebugJabber('Try to set discord topic: ', topic);
                            remDiscord.editChannel(channel, topic + '\n ~ ' + from_jid);

                            break;
                        }

                        if (body) {
                            message = body.getText();
                        }
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
                remDiscord.send(
                     channel,
                     (use_nick ? '**' + from_nick + '**: ' : '') + message
                 );
            }
        });
    };

    self.getNicknameWMask = function (roomJid, fromNick) {
        var mask = nick_mask[ roomJid ];
        if (typeof mask === "string") {
            return mask.replace('%nickname%', fromNick);
        }
        else {
            return fromNick;
        }
    };
}

