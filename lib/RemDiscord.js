'use strict';

var Discord = require('discord.io');
var Debug = require('debug'),
    PrintDebug = Debug('debug:discord'),
    PrintError = Debug('error:discord')
;

/**
 * @param token             string
 * @param autorun           boolean
 * @param messageCacheLimit number
 * @param shards            number[]
 */
var Rem = function (token, autorun, messageCacheLimit, shards) {
    this.Client = new Discord.Client({
        token: token,
        autorun: autorun,
        messageCacheLimit: messageCacheLimit,
        shard: shards
    });

    this.getClient = function () {
        return this.Client;
    };

    this.send = function (toChannelID, message) {
        this.Client.sendMessage({
            to: toChannelID,
            message: message
        }, function (error, info) {
            if (error) {
                PrintError('[error] ', error, info);
            }
            else {
                PrintDebug(info);
            }
        });
    };

    // https://discordapp.com/developers/docs/resources/channel#message-formatting
    this.fixMessage = function (message) {
        var result;
        // Work with the smiles <:mmLol:234065305956122626> → https://cdn.discordapp.com/emojis/234065305956122626.png
        result = message.replace(/<:(\w+):(\d+)>/g, 'https://cdn.discordapp.com/emojis/$2.png?$1');

        // Replace Snowflakes with the names if applicable
        result = this.Client.fixMessage(result);

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
        var result = '';
        if (event.d && event.d.attachments) {
            for (var i = 0, len = event.d.attachments.length; i < len; i++) {
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
};

module.exports = Rem;