"use strict";

if (!process.env.DEBUG) {
    process.env.DEBUG = 'info,error:*,-debug:*';
}

const Discord = require('./lib/RemDiscord.js'),
    Xmpp = require('./lib/RamXmpp.js'),
    debug = require('debug'),
    LogInfo = debug('info'),
    LogDebug = debug('debug:app'),
    LogError = debug('error:app'),
    LogDebugJabber = debug('debug:jabber'),
    LogErrorJabber = debug('error:jabber'),
    config = require('json-config')({
        config_dir: "./"
    }),
    List = require('./lib/List.js')
;

new App().run();

function App() {
    const
        remDiscord = new Discord(config.discord.token),
        discord = remDiscord.getClient(),
        ramXmpp = new Xmpp(config.jabber.userJid, config.jabber.userPass),
        jabber = ramXmpp.getClient(),
        Ignore = new List()
    ;
    let
        conferenceSendPresenceInterval,
        jid_by_channel = {},
        channel_by_jid = {},
        nick_by_jid = {},
        nick_mask = {},
        show_presence_by_jid = {},
        jabber_connected_users = {}
    ;

    this.run = () => {
        discord.on('ready', () => {
            LogInfo('Connected to discord as ' + discord.user.username + " - (" + discord.user.id + ")");
        });

        discord.on('disconnect', (closeEvent) => {
            remDiscord.logError(closeEvent);
            setTimeout(discord.connect, 10000)
        });

        // debug all discord.io events
        discord.on('debug', remDiscord.logDebug);

        discord.on('message', (message) => {
            let match;

            if ("!ping" === message.content) {
                // remDiscord.send(message.channel.id, 'pong');
                message.channel.send('pong');
            }
            else if ("!users" === message.content) {
                let reply = 'Did not receive information about the presence';
                let ignored = Ignore.list().join(', ');

                if (!jid_by_channel[message.channel.id])
                    reply = 'This room is not associated with any jabber conference ¯\\_(ツ)_/¯';

                if ("object" === typeof(jabber_connected_users[ jid_by_channel[message.channel.id] ]))
                    reply = '**Online:** ' + this.escapeMarkdown(Object.keys(jabber_connected_users[ jid_by_channel[message.channel.id] ]).join(', '));

                if (ignored)
                    reply += '\n**Ignored:** ' + this.escapeMarkdown(ignored);

                remDiscord.send(message.channel.id, reply);
            }
            else if ("!rooms" === message.content) {
                let reply = 'Room list:\n';

                for (let i in jid_by_channel) {
                    if (jid_by_channel.hasOwnProperty(i)) {
                        reply += `\n\` ${i} ←→ ${jid_by_channel[i]}\``;
                    }
                }

                remDiscord.send(message.channel.id, reply);
            }
            else if (message.author.id === config.discord.adminId && message.content.slice(0, 4) === '!say') {
                const match = message.content.match(/^!say\s+([^\s]+)\s+(.*)/i);
                let reply = 'Can\'t recognize the command!',
                    replyToRoom = message.channel.id
                ;

                if (match) {
                    const room = match[1],
                        msg = match[2]
                    ;

                    if (!msg) {
                        reply += ' Looks like empty message.content.';
                    }
                    // to discord
                    else if (room.match(/\d+/) && jid_by_channel[room]) {
                        replyToRoom = room;
                        reply = msg;
                    }
                    // to jabber
                    else if (channel_by_jid[room]) {
                        ramXmpp.send(room,  msg);

                        return;
                    }
                    else {
                        reply += ' Room not found. Try `!rooms` for room list.';
                    }
                }

                remDiscord.send(replyToRoom, reply);
            }
            else if (match = message.content.match(/^!((un)?ignore)\s+(.*)/i)) {
                const nickname = match[3],
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
                    message.channel.id,
                    this.escapeStringTemplate`*${nickname}* ${prefix}ignored.`
                );
            }
            else if (
                // !message.author.bot
                !message.webhookID // preventing duplicates, since we use webhook to send messages from jabber
                && message.author.id !== discord.user.id
                && jid_by_channel[message.channel.id]
            ) {
                remDiscord.fixMessage('<@!'+ message.author.id +'>', message).then((userNick) => {
                    if ('@null' === userNick || '@undefined' === userNick) {
                        userNick = '@' + message.author.username;
                    }
                    userNick = this.getNicknameWMask(jid_by_channel[message.channel.id], userNick);

                    const attachments = remDiscord.getAttachmentsLinks(message);

                    remDiscord.fixMessage(message.content, message).then((msg) => {
                        ramXmpp.send(jid_by_channel[message.channel.id],
                            userNick
                            + msg
                            + attachments
                        );
                    });
                }).catch(LogError);
            }
        });

        discord.on('error', (error) => {
            remDiscord.logError({clientStatus: discord.status, message: error.message})
        });

        jabber.on('online', function () {
            LogInfo('Connected to jabber as ' + config.jabber.userJid);

            for (let i = 0 ; i < config.roomList.length; i++) {
                LogInfo('Connecting to conf %s as %s', config.roomList[i].roomJid, config.roomList[i].nick);
                ramXmpp.join(config.roomList[i].roomJid, config.roomList[i].nick);

                jid_by_channel[ config.roomList[i].roomChannelId ] = config.roomList[i].roomJid;
                channel_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].roomChannelId;
                nick_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].nick;
                nick_mask[ config.roomList[i].roomJid ] = config.roomList[i].fromNickMask;
                show_presence_by_jid[ config.roomList[i].roomJid ] = config.roomList[i].showPresence;
            }

            // TODO: handle disconnect events by status codes (http://xmpp.org/extensions/xep-0045.html#registrar-statuscodes)
            conferenceSendPresenceInterval = setInterval(function () {
                for (let i = 0 ; i < config.roomList.length; i++) {
                    LogInfo('Reconnecting to conf %s as %s', config.roomList[i].roomJid, config.roomList[i].nick);
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
            clearInterval(conferenceSendPresenceInterval);

            setTimeout(jabber.connect, 10000)
        });

        jabber.on('error', function (e) {
            LogErrorJabber(e);

            if (config.discord.adminId) {
                remDiscord.sendDM(
                    config.discord.adminId,
                    '**[Jabber error]** `' + e + '`'
                ).catch(LogError);
            }
        });

        jabber.on('connection', function () {
            LogInfo('Jabber online');
        });

        ramXmpp.on('stanza:error', (stanza, from_jid) => {
            remDiscord.send(
                this.getChannelByJid(from_jid),
                '**[stanza:error]** ```' + stanza + '```'
            );
        });

        ramXmpp.on('presence:connect', (stanza, from_jid, from_nick) => {
            if (!jabber_connected_users[from_jid])
                jabber_connected_users[from_jid] = {};

            if (!jabber_connected_users[from_jid][from_nick]) {
                jabber_connected_users[from_jid][from_nick] = true;

                if (!this.needShowPresence(from_jid)) {
                    return;
                }

                remDiscord.send(
                    this.getChannelByJid(from_jid),
                    this.escapeStringTemplate`*${from_nick} joins the room.*`
                );
            }
        });

        ramXmpp.on('presence:disconnect', (stanza, from_jid, from_nick, Status) => {
            delete jabber_connected_users[from_jid][from_nick];

            if (!this.needShowPresence(from_jid)) {
                return;
            }

            if (!Status || '303' !== Status.getAttr('code')) {
                remDiscord.send(
                    this.getChannelByJid(from_jid),
                    this.escapeStringTemplate`*${from_nick} leaves the room.*`
                );
            }
        });

        ramXmpp.on('presence:disconnect:kick', (stanza, from_jid, from_nick, Actor, Reason) => {
            const byNick = Actor ? Actor.getAttr('nick') : '',
                reason = Reason ? Reason.getText() : '<reason not specified>'
            ;
            remDiscord.send(
                this.getChannelByJid(from_jid),
                this.escapeStringTemplate`*${from_nick} kicked (${byNick}: ${reason}).*`
            );
        });

        ramXmpp.on('presence:disconnect:ban', (stanza, from_jid, from_nick, Actor, Reason) => {
            const byNick = Actor ? Actor.getAttr('nick') : '',
                reason = Reason ? Reason.getText() : '<reason not specified>'
            ;
            remDiscord.send(
                this.getChannelByJid(from_jid),
                this.escapeStringTemplate`*${from_nick} banned (${byNick}: ${reason}).*`
            );
        });

        ramXmpp.on('presence:rename', (stanza, from_jid, from_nick, new_nick) => {
            delete jabber_connected_users[from_jid][from_nick];
            jabber_connected_users[from_jid][new_nick] = true;

            let reply = this.escapeStringTemplate`*${from_nick} renamed to ${new_nick}.*`;
            if (Ignore.check(from_nick)) {
                Ignore.remove(from_nick).add(new_nick);
                reply += this.escapeStringTemplate`\n*${new_nick} ignored.*`
            }

            remDiscord.send(
                this.getChannelByJid(from_jid),
                reply
            );
        });

        ramXmpp.on('message:groupchat:subject', (stanza, from_jid, from_nick, Subject, has_delay) => {
            const topic = Subject.getText();
            LogInfo('Trying to set discord topic: ', topic);
            remDiscord.editChannel(this.getChannelByJid(from_jid), topic + '\n ~ ' + from_jid, from_nick);
        });

        ramXmpp.on('message:groupchat', (stanza, from_jid, from_nick, Body, has_delay) => {
            if (has_delay) {
                return;
            }
            if (from_nick === nick_by_jid[from_jid]) {
                return;
            }
            if (Ignore.check(from_nick)) {
                LogDebug('Ignore msg from ' + from_nick);
                return;
            }
            if (!Body) {
                return;
            }

            const toChannel = this.getChannelByJid(from_jid);
            remDiscord.sendAs(
                from_nick,
                toChannel,
                Body.getText()
            ).catch((error) => {
                LogError(error);

                return remDiscord.send(toChannel, this.escapeStringTemplate`**${from_nick}**: ${Body.getText()}`);
            });
        });

        ramXmpp.on('message:chat', (stanza, from_jid, from_nick, Body, has_delay) => {
            if (!Body)
                return;

            remDiscord.sendDM(
                config.discord.adminId,
                this.escapeStringTemplate`**${stanza.from}:** ${Body.getText()}`
            ).catch(LogError);
        });

        ramXmpp.on('message:captcha', (stanza, from_jid, from_nick, Body) => {
            if (!Body)
                return;

            remDiscord.sendDM(
                config.discord.adminId,
                this.escapeStringTemplate`**${stanza.from}:** ${Body.getText()}`
            ).catch(LogError);
        });
    };

    this.getChannelByJid = (conferenceJID) => {
        return channel_by_jid[conferenceJID];
    };

    this.needShowPresence = (conferenceJID) => {
        if (typeof show_presence_by_jid[conferenceJID] === 'boolean') {
            return show_presence_by_jid[conferenceJID]
        }

        return config.jabber.showPresence
    };

    this.getNicknameWMask = function (roomJid, fromNick) {
        const mask = nick_mask[ roomJid ];
        if (typeof mask === "string") {
            return mask.replace('%nickname%', fromNick);
        }
        else {
            return fromNick;
        }
    };

    this.escapeMarkdown = (text) => {
        // return original text if it has any URI
        if (text.match(/[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,}/i))
            return text;

        return text.replace(/([*`~_\\])/g, '\\$1')
    };

    this.escapeStringTemplate = (strings, ...keys) => {
        let result = [strings[0]];

        for (let i = 0; i < keys.length; ++i) {
            result.push(this.escapeMarkdown(keys[i]), strings[i+1])
        }

        return result.join('');
    }
}

