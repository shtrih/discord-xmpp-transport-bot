"use strict";

if (!process.env.DEBUG) {
    process.env.DEBUG = '*,-debug:*,-xmpp:*';
}

const Discord = require('./lib/RemDiscord.js'),
    Xmpp = require('./lib/RamXmpp.js'),
    debug = require('debug'),
    LogInfo = debug('info'),
    LogDebug = debug('debug:app'),
    LogError = debug('error:app'),
    LogDebugJabber = debug('debug:jabber'),
    LogErrorJabber = debug('error:jabber'),
    { SYNC, load: loadConfig } = require('./lib/Configuration'),
    config = loadConfig(`./config/${process.env.NODE_ENV || 'development'}.cjson`),
    {
        roomByJid: roomConfigByJid,
        roomByChannel: roomConfigByChannel
    } = config
;

new App().run();

function App() {
    const
        remDiscord = new Discord(config.discord.token),
        discord = remDiscord.getClient(),
        IgnoredNicks = new Map(),
        reconnectTimeoutSec = 10
    ;
    let
        conferenceSendPresenceInterval,
        jabberConnectedUsers = new Map(),
        lastErrorStanza = null,
        lastErrorCountMessage = null,
        errorStanzasCount = null,
        ramXmpp = null,
        jabber = null,
        isConnecting = false,
        extractArgs = function (text, limit=1) {
            return text.split(/\s+/, limit).filter((v) => v)
        }
    ;

    this.run = () => {
        discord.on('ready', () => {
            LogInfo('Connected to discord as ' + discord.user.username + " - (" + discord.user.id + ")");

            ramXmpp = new Xmpp(config.jabber.userJid, config.jabber.userPass);
            jabber = ramXmpp.getClient();

            this.registerXMPPListeners();
        });

        discord.on('disconnect', (closeEvent) => {
            remDiscord.logError(closeEvent);
            LogInfo(`Trying to reconnect to Discord after ${reconnectTimeoutSec} sec`);

            if (jabber) {
                jabber.end()
            }

            setTimeout(remDiscord.connect, reconnectTimeoutSec * 1000)
        });

        // debug all Discord events
        discord.on('debug', remDiscord.logDebug);

        discord.on('message', (message) => {
            if (message.webhookID // preventing duplicates, since we use webhook to send messages from jabber
                || message.author.id === discord.user.id
                // || !message.author.bot
            ) {
                return;
            }

            let commandName = '',
                text = message.content
            ;
            const isCommand = text.startsWith(config.prefix);
            if (isCommand) {
                commandName = message.content.slice(config.prefix.length).split(/\s+/,1).pop().toLowerCase();
                text = message.content.slice(config.prefix.length + commandName.length + 1);
            }

            if ('ping' === commandName) {
                message.channel.send('pong');
            }
            else if ('users' === commandName) {
                let reply = 'Did not receive information about the presence';
                let ignored = [...IgnoredNicks.keys()].join(', ');

                if (roomConfigByChannel.has(message.channel.id)) {
                    const jid = roomConfigByChannel.get(message.channel.id).roomJid;
                    if (jabberConnectedUsers.has(jid)) {
                        reply = '**Online:** ' + this.escapeMarkdown([...jabberConnectedUsers.get(jid).keys()].join(', '));
                    }
                }
                else {
                    reply = 'This room is not associated with any jabber conference ¯\\_(ツ)_/¯';
                }

                if (ignored) {
                    reply += '\n**Ignored:** ' + this.escapeMarkdown(ignored);
                }

                remDiscord.send(message.channel.id, reply);
            }
            else if ('rooms' === commandName) {
                let reply = 'Room list:';

                for (const channelId of roomConfigByChannel.keys()) {
                    let channel = discord.channels.get(channelId),
                        sync = roomConfigByChannel.get(channelId).sync
                    ;
                    reply += `\n\`"${channel.guild.name}" #${channel.name} (${channelId}) ←→ ${roomConfigByChannel.get(channelId).roomJid} (sync: ${sync ? sync : SYNC.BOTH})\``;
                }

                remDiscord.send(message.channel.id, reply);
            }
            else if ('say' === commandName && message.author.id === config.discord.adminId) {
                const match = text.match(/^\s*([^\s]+)\s+(.*)/);
                let reply = 'Can\'t recognize the command! Syntax: `<room> <message>`.',
                    replyToRoom = message.channel.id
                ;

                if (match) {
                    const room = match[1],
                        msg = match[2]
                    ;

                    if (!msg) {
                        reply += ' Looks like empty message content.';
                    }
                    // to discord
                    else if (room.match(/\d+/) && roomConfigByChannel.has(room)) {
                        replyToRoom = room;
                        reply = msg;
                    }
                    // to jabber
                    else if (roomConfigByJid.has(room)) {
                        ramXmpp.send(room, msg);

                        return;
                    }
                    else {
                        reply += ` Room not found. Try \`${config.prefix}rooms\` for room list.`;
                    }
                }

                remDiscord.send(replyToRoom, reply);
            }
            else if ('ignore' === commandName || 'unignore' === commandName || 'dont_ignore' === commandName) {
                const nickname = extractArgs(text).pop(),
                    ignore = 'ignore' === commandName,
                    prefix = ignore ? '' : 'no longer'
                ;

                if (!nickname) {
                    return;
                }

                if (ignore) {
                    IgnoredNicks.set(nickname, true)
                }
                else {
                    IgnoredNicks.delete(nickname)
                }

                remDiscord.send(
                    message.channel.id,
                    this.escapeStringTemplate`*${nickname}*${prefix} ignored.`
                );
            }
            else if (roomConfigByChannel.has(message.channel.id)) {
                if (roomConfigByChannel.get(message.channel.id).sync === SYNC.TO_DISCORD) {
                    LogDebug('Sync: ' + SYNC.TO_DISCORD + '. Skip message');
                    return;
                }
                const jid = roomConfigByChannel.get(message.channel.id).roomJid;
                remDiscord.fixMessage('<@!' + message.author.id + '>', message).then((userNick) => {
                    if ('@null' === userNick || '@undefined' === userNick) {
                        userNick = '@' + message.author.username;
                    }
                    userNick = this.getNicknameWMask(jid, userNick);

                    const attachments = remDiscord.getAttachmentsLinks(message);

                    remDiscord.fixMessage(message.content, message).then((msg) => {
                        ramXmpp.send(jid,
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
    };

    this.registerXMPPListeners = () => {
        jabber.on('online', function () {
            LogInfo('Connected to jabber as ' + config.jabber.userJid);

            for (const roomJid of roomConfigByJid.keys()) {
                LogInfo('Connecting to conf %s as %s', roomJid, roomConfigByJid.get(roomJid).nick);
                ramXmpp.join(roomJid, roomConfigByJid.get(roomJid).nick);
            }

            // TODO: handle disconnect events by status codes (http://xmpp.org/extensions/xep-0045.html#registrar-statuscodes)
            conferenceSendPresenceInterval = setInterval(function () {
                for (const roomJid of roomConfigByJid.keys()) {
                    LogInfo('Reconnecting to conf %s as %s', roomJid, roomConfigByJid.get(roomJid).nick);
                    ramXmpp.join(roomJid, roomConfigByJid.get(roomJid).nick);
                }
            }, (config.jabber.reconnectIntervalSec || 600) * 1000);
        });

        jabber.on('offline', function () {
            clearInterval(conferenceSendPresenceInterval);

            if (isConnecting) {
                LogInfo('Still connecting…');
                return;
            }

            isConnecting = true;
            LogInfo(`Trying to reconnect to Jabber after ${reconnectTimeoutSec} sec`);
            setTimeout(function() {
                jabber.connect();
                isConnecting = false;
            }, reconnectTimeoutSec * 1000)
        });

        jabber.on('error', function (e) {
            const terminate = e === 'XMPP authentication failure';

            LogErrorJabber(e);

            if (config.discord.adminId) {
                remDiscord.sendDM(
                    config.discord.adminId,
                    '**[Jabber error]** `' + e + '`'
                )
                    .then(() => {
                        if (terminate) {
                            process.kill(process.pid, 'SIGTERM');
                        }
                    })
                    .catch((error) => {
                        LogError(error);

                        if (terminate) {
                            process.kill(process.pid, 'SIGTERM');
                        }
                    });
            }
            else if (terminate) {
                process.kill(process.pid, 'SIGTERM');
            }
        });

        ramXmpp.on('stanza:error', (stanza, from_jid) => {
            let channelId = this.getChannelByJid(from_jid);

            let errorChannel = false;
            if (roomConfigByJid.has(from_jid)) {
                errorChannel = roomConfigByJid.get(from_jid).stanzaErrorsChannelId;
            }

            if (errorChannel) {
                channelId = errorChannel;
            }

            const error_count_text = 'Error thrown times: ';

            // If the same as the previous error then just update message counter
            if (lastErrorStanza && lastErrorStanza.toString() === stanza.toString()) {
                ++errorStanzasCount;

                /** @see https://discord.js.org/#/docs/main/stable/class/Message?scrollTo=edit */
                lastErrorCountMessage
                    .edit(error_count_text + errorStanzasCount)
                    .catch(LogError);

                return;
            }

            errorStanzasCount = 1;

            remDiscord.send(
                channelId,
                '**[stanza:error]** ```' + stanza + '```'
            ).then(() => {
                    lastErrorStanza = stanza;

                    remDiscord
                        .send(
                            channelId,
                            error_count_text + errorStanzasCount
                        )
                        .then(
                            /**
                             * @param {Object|Message} message
                             * @see https://discord.js.org/#/docs/main/stable/class/Message */
                            message => {
                                lastErrorCountMessage = message;
                            }
                        )
                    ;
                }
            ).catch(LogError);
        });

        ramXmpp.on('presence:connect', (stanza, from_jid, from_nick) => {
            if (!jabberConnectedUsers.has(from_jid)) {
                jabberConnectedUsers.set(from_jid, new Map);
            }

            if (!jabberConnectedUsers.get(from_jid).has(from_nick)) {
                jabberConnectedUsers.get(from_jid).set(from_nick, true);

                if (!this.needShowPresence(from_jid)) {
                    return;
                }

                remDiscord.send(
                    this.getChannelByJid(from_jid),
                    this.escapeStringTemplate`*${from_nick} joins the room.*`
                ).catch(LogError)
            }
        });

        ramXmpp.on('presence:disconnect', (stanza, from_jid, from_nick, Status) => {
            if (jabberConnectedUsers.has(from_jid)) {
                jabberConnectedUsers.get(from_jid).delete(from_nick);
            }

            if (!this.needShowPresence(from_jid)) {
                return;
            }

            if (!Status || '303' !== Status.getAttr('code')) {
                remDiscord.send(
                    this.getChannelByJid(from_jid),
                    this.escapeStringTemplate`*${from_nick} leaves the room.*`
                ).catch(LogError)
            }
        });

        ramXmpp.on('presence:disconnect:kick', (stanza, from_jid, from_nick, Actor, Reason) => {
            if (!this.needShowPresence(from_jid)) {
                return;
            }

            const byNick = Actor ? Actor.getAttr('nick') : '',
                reason = Reason ? Reason.getText() : '<reason not specified>'
            ;
            remDiscord.send(
                this.getChannelByJid(from_jid),
                this.escapeStringTemplate`*${from_nick} kicked (${byNick}: ${reason}).*`
            ).catch(LogError)
        });

        ramXmpp.on('presence:disconnect:ban', (stanza, from_jid, from_nick, Actor, Reason) => {
            if (!this.needShowPresence(from_jid)) {
                return;
            }

            const byNick = Actor ? Actor.getAttr('nick') : '',
                reason = Reason ? Reason.getText() : '<reason not specified>'
            ;
            remDiscord.send(
                this.getChannelByJid(from_jid),
                this.escapeStringTemplate`*${from_nick} banned (${byNick}: ${reason}).*`
            ).catch(LogError)
        });

        ramXmpp.on('presence:rename', (stanza, from_jid, from_nick, new_nick) => {
            jabberConnectedUsers.get(from_jid).delete(from_nick);
            jabberConnectedUsers.get(from_jid).set(new_nick, true);

            let reply = this.escapeStringTemplate`*${from_nick} renamed to ${new_nick}.*`;
            if (IgnoredNicks.has(from_nick)) {
                IgnoredNicks.delete(from_nick);
                IgnoredNicks.set(new_nick, true);
                reply += this.escapeStringTemplate`\n*${new_nick} ignored.*`
            }

            if (!this.needShowPresence(from_jid)) {
                return;
            }

            remDiscord.send(
                this.getChannelByJid(from_jid),
                reply
            ).catch(LogError)
        });

        ramXmpp.on('message:groupchat:subject', (stanza, from_jid, from_nick, Subject, has_delay) => {
            const channelId = this.getChannelByJid(from_jid);

            if (!remDiscord.canEditChannel(channelId)) {
                const channel = remDiscord.getClient().channels.get(channelId);
                LogInfo('MANAGE_CHANNELS permission is required to set topic in "', channel ? channel.name : channelId, '" channel');
                return;
            }

            const topic = Subject.getText();
            LogInfo('Trying to set Discord topic: ', topic);
            remDiscord.editChannel(channelId, topic + '\n ~ ' + from_jid, from_nick);
        });

        ramXmpp.on('message:groupchat', (stanza, from_jid, from_nick, Body, has_delay) => {
            if (has_delay) {
                return;
            }

            if (roomConfigByJid.get(from_jid).sync === SYNC.TO_JABBER) {
                LogDebug('Sync: '+ SYNC.TO_JABBER +'. Skip message');
                return;
            }

            // Reset latest error on receive normal message
            lastErrorStanza = null;

            if (from_nick === roomConfigByJid.get(from_jid).nick) {
                return;
            }
            if (IgnoredNicks.has(from_nick)) {
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
                this.escapeMarkdown(Body.getText())
            ).catch((error) => {
                LogError(error);

                return remDiscord.send(toChannel, this.escapeStringTemplate`**${from_nick}**: ${Body.getText()}`);
            });
        });

        ramXmpp.on('message:chat', (stanza, from_jid, from_nick, Body) => {
            if (!Body) {
                return;
            }

            remDiscord.sendDM(
                config.discord.adminId,
                this.escapeStringTemplate`**${stanza.from}:** ${Body.getText()}`
            ).catch(LogError);
        });

        ramXmpp.on('message:captcha', (stanza, from_jid, from_nick, Body) => {
            if (!Body) {
                return;
            }

            remDiscord.sendDM(
                config.discord.adminId,
                this.escapeStringTemplate`**${stanza.from}:** ${Body.getText()}`
            ).catch(LogError);
        });
    };

    this.getChannelByJid = (conferenceJID) => {
        return roomConfigByJid.get(conferenceJID).roomChannelId;
    };

    this.needShowPresence = (conferenceJID) => {
        return roomConfigByJid.get(conferenceJID).showPresence
    };

    this.getNicknameWMask = function (roomJid, fromNick) {
        const mask = roomConfigByJid.get(roomJid).fromNickMask;
        if (typeof mask === "string") {
            return mask.replace('%nickname%', fromNick);
        }
        else {
            return fromNick;
        }
    };

    this.escapeMarkdown = (text) => {
        // return original text if it has any URI
        if (text.match(/[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,}/i)) {
            return text;
        }

        return text.replace(/([*`~_\\])/g, '\\$1')
    };

    this.escapeStringTemplate = (strings, ...keys) => {
        let result = [strings[0]];

        for (let i = 0; i < keys.length; ++i) {
            result.push(this.escapeMarkdown(keys[i]), strings[i + 1])
        }

        return result.join('');
    }
}

