"use strict";

const defaultSettings = {
        prefix: '!',
        discord: {
            token: "",
            adminId: ""
        },
        jabber: {
            userJid: "",
            userPass: "",
            showPresence: true,
            reconnectIntervalSec: 600,
            stanzaErrorsChannelId: ""
        },
        roomList: []
    },
    cjson = require('cjson'),
    load = function (path) {
        const loadedSettings = cjson.load(path);

        let roomsSettings = {
            roomByJid: new Map,
            roomByChannel: new Map,
        };
        for (let i = 0; i < loadedSettings.roomList.length; i++) {
            if (typeof loadedSettings.roomList[i].showPresence !== "boolean") {
                loadedSettings.roomList[i].showPresence = loadedSettings.jabber.showPresence
            }
            if (!loadedSettings.roomList[i].stanzaErrorsChannelId) {
                loadedSettings.roomList[i].stanzaErrorsChannelId = loadedSettings.jabber.stanzaErrorsChannelId
            }

            roomsSettings.roomByJid.set(loadedSettings.roomList[i].roomJid, loadedSettings.roomList[i]);
            roomsSettings.roomByChannel.set(loadedSettings.roomList[i].roomChannelId, loadedSettings.roomList[i])
        }

        return Object.assign({}, defaultSettings, loadedSettings, roomsSettings);
    }
;

module.exports.load = load;
module.exports.SYNC = {
    BOTH: 'both',
    TO_DISCORD: 'to_discord',
    TO_JABBER: 'to_jabber',
};