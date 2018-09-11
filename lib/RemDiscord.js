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

    this.send = (toChannelID, message) => {
        const channel = this.Client.channels.get(toChannelID);
        if (channel && (channel.type === 'text' || channel.type === 'dm')) {
            return channel.send(message);
        }

        this.logError('Can\'t send message', channel, message);
    };

    /**
     * Send message via channel web hook to ability set of sender nickname
     *
     * @param fromNickname
     * @param toChannelID
     * @param message
     */
    this.sendAs = (fromNickname, toChannelID, message) => {
        const channel = this.Client.channels.get(toChannelID);
        if (channel && channel.type === 'text') {
            /**
             * @type {Collection<Snowflake, Webhook>}
             */
            return channel.fetchWebhooks()
                .then(hooks => {
                    const hook = hooks.first();

                    if (hook) {
                        /**
                         * @type {Webhook}
                         */
                        return hook.send(message, {username: fromNickname});
                    }

                    throw 'HookNotFoundException';
                })
            ;
        }

        this.logError('Can\'t send message', channel, message);
    };

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
        let match;
        const replaceShowflakes = async (match, RID, NID, UID, CID) => {
            if (CID) {
                const channel = this.Client.channels.get(CID);
                if (channel) {
                    return '#' + channel.name;
                }
            }
            if (UID) {
                const user = this.Client.users.get(UID);
                if (user) {
                    return "@" + user.tag;
                }
            }
            if (RID || NID) {
                const guild = message.guild;
                if (guild) {
                    if (RID) {
                        const role = guild.roles.get(RID);
                        if (role) {
                            return '@' + role.name;
                        }
                    }
                    if (NID) {
                        const guildMember = await guild.fetchMember(NID);
                        if (guildMember) {
                            return "@" + (guildMember.nickname || guildMember.user.tag);
                        }
                    }
                }
            }

            return match;
        };

        do {
            match = /<@&(\d+)>|<@!(\d+)>|<@(\d+)>|<#(\d+)>/g.exec(result);
            if (match) {
                result = await replaceShowflakes(...match);
            }
        } while (match);

        return result;
    };

    /**
     * Get attachments as string
     *
     * @param event object { t: 'MESSAGE_CREATE', s: 4, op: 0, d: { type: 0, tts: false, timestamp: '2016-10-15T10:03:04.874000+00:00', pinned: false, nonce: null, mentions: [], mention_roles: [], mention_everyone: false, id: '236791046598688768', embeds: [], edited_timestamp: null, content: '', channel_id: '170997528299307009', author: { username: 'shtrih', id: '149052925308698624', discriminator: '9483', avatar: '28f0fa1105487f80e66362984741f1fc' },
     attachments: [
        {
            width: 1920,
            url: 'https://cdn.discordapp.com/attachments/170997528299307009/236801030262751232/Dota_2_01.06.2016_21_26_49.png',
            size: 91895,
            proxy_url: 'https://images-1.discordapp.net/.eJwFwUsOgyAUAMC7cID3o4K47j0IQYImKgReV03v3pmv-YzLbOZQ7XND3M-Z29hhahupFqit1aukfk7I7cakmvJxl0cnsqcQ_CKrhGDJEwUU61ZisiRO_MJiBd9NU5RIDORAiF0UjuLiK0B_qvn9AaWuJnk.uxdxHG4wWsu-IsSBkQYh5ropanQ',
            id: '236801030262751232',
            height: 1080,
            filename: 'Dota_2_01.06.2016_21_26_49.png'
        }
     ] } }
     */
    this.getAttachments = function (event) {
        let result = '';
        if (event.d && event.d.attachments) {
            for (let i = 0, len = event.d.attachments.length; i < len; i++) {
                result += '\n'+ event.d.attachments[i].url
                    +' ('+ (event.d.attachments[i].size / 1024).toFixed(1) +'Kb';

                if (event.d.attachments[i].width) {
                    result += ', ' + event.d.attachments[i].width +'×'+ event.d.attachments[i].height;
                }

                result += ')';
            }
        }

        return result;
    };

    this.editChannel = (channel, topic, byNickname) => {
        const ch = this.Client.channels.get(channel);
        if (ch) {
            ch.setTopic(topic, byNickname ? `sets by ${byNickname}` : '');
        }
    };
};

module.exports = Rem;