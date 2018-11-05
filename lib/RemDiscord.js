'use strict';

const DiscordJs = require('discord.js');
const Debug = require('debug'),
    LogDebug = Debug('debug:discord'),
    /**
     * If first argument of `debug` is an Error instance then `debug` won't show it's other
     * properties like statusCode or statusMessage in `discord.io`.
     * Therefore, we send Error in the second argument.
     */
    LogError = ((debug) => {
        return function() {
            const args = Array.prototype.slice.call(arguments);
            if (arguments[0] instanceof Error)
                args.unshift('');

            debug.apply(this, args);
        };
    })(Debug('error:discord'))
;

/**
 * @param token             string
 */
const Rem = function (token) {
    this.connect = () => {
        this.Client = new DiscordJs.Client();

        return this.Client.login(token)
            .catch(LogError);
    };

    this.connect();

    this.logError = LogError;
    this.logDebug = LogDebug;


    this.getClient = () => {
        return this.Client;
    };

    this.send = (toChannelID, message) => new Promise((resolve) => {
        const channel = this.Client.channels.get(toChannelID);
        if (channel && (channel.type === 'text' || channel.type === 'dm')) {
            resolve(channel.send(message));
        }

        throw {'error': 'send(): Can\'t send message', channel, message};
    });

    this.sendDM = async (userId, string) => {
        const user = await this.Client.fetchUser(userId);
        if (user) {
            return user.createDM().then((dm) => {
                return dm.send(string);
            });
        }

        throw {'error': 'sendDM(): Can\'t send DM', userId, string};
    };

    /**
     * Send message via channel webhook to set jabber nickname as sender.
     * Promise rejects if there is not at least one webhook or no permission MANAGE_WEBHOOKS.
     *
     * @param fromNickname
     * @param toChannelID
     * @param message
     */
    this.sendAs = (fromNickname, toChannelID, message) => new Promise((resolve) => {
        const channel = this.Client.channels.get(toChannelID);

        if (channel && channel.type === 'text') {
            /**
             * @type {Promise<Collection<Snowflake, Webhook>>}
             */
            const hooksPromise = channel.fetchWebhooks()
                .then(hooks => {
                    const hook = hooks.first();

                    if (hook) {
                        /**
                         * @type {Webhook}
                         */
                        return hook.send(message, {username: fromNickname});
                    }
                    else {
                        return channel.createWebhook('XMPPBridge for Rem', 'https://cdn.discordapp.com/app-icons/197985373765238784/ce046b0d283795097a948a2e3e29f436.png')
                            .then(() => {
                                return this.sendAs(fromNickname, toChannelID, message);
                            })
                            .catch((error) => {
                                throw {'error': 'HookNotFoundException', 'reason': error};
                            });
                    }
                })
            ;
            resolve(hooksPromise);
        }

        throw {'error': 'sendAs(): Can\'t send message', fromNickname, toChannelID, message};
    });

    // https://discordapp.com/developers/docs/resources/channel#message-formatting
    /**
     * Replace mention code (like <@1231>) with names
     * @param string  text with mentions
     * @param message Message object to obtain guild info
     * @returns Promise
     */
    this.fixMessage = async (string, message) => {
        let result;
        // Work with the smiles <:mmLol:234065305956122626> → https://cdn.discordapp.com/emojis/234065305956122626.png
        result = string.replace(/<:(\w+):(\d+)>/g, 'https://cdn.discordapp.com/emojis/$2.png?$1');

        // Replace Snowflakes with the names if applicable
        const replaceShowflakes = async (match, RID, NID, UID, CID) => {
            if (CID) {
                const channel = this.Client.channels.get(CID);
                if (channel) {
                    return '#' + channel.name;
                }
            }
            if (RID || NID || UID) {
                const guild = message.guild;
                if (guild) {
                    if (RID) {
                        const role = guild.roles.get(RID);
                        if (role) {
                            return '@' + role.name;
                        }
                    }
                    if (NID || UID) {
                        const guildMember = await guild.fetchMember(NID || UID);
                        if (guildMember) {
                            return "@" + (guildMember.nickname || guildMember.user.tag);
                        }
                    }
                }
            }

            return match;
        };

        let match,
            replacement,
            re = /<@&(\d+)>|<@!(\d+)>|<@(\d+)>|<#(\d+)>/,
            regex = new RegExp(re, 'g')
        ;
        do {
            match = regex.exec(result);
            if (match) {
                replacement = await replaceShowflakes(...match);
                result = result.replace(re, replacement);
            }
        } while (match);

        return result;
    };

    /**
     * Get attachments as string
     *
     * @type {Message} https://discord.js.org/#/docs/main/stable/class/Message?scrollTo=attachments
     */
    this.getAttachmentsLinks = function (message) {
        let result = '';

        message.attachments.forEach((attachment) => {
            result += '\n'+ attachment.url
                +' ('+ (attachment.filesize / 1024).toFixed(1) +'Kb';

            if (attachment.width) {
                result += ', ' + attachment.width +'×'+ attachment.height;
            }

            result += ')';
        });

        return result;
    };

    this.editChannel = (channelId, topic, byNickname) => {
        const ch = this.Client.channels.get(channelId);
        if (ch) {
            ch.setTopic(topic, byNickname ? `sets by ${byNickname}` : '')
                .catch(this.logError);
        }
    };
};

module.exports = Rem;