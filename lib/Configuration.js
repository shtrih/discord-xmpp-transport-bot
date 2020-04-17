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
            stanzaErrorsChannel: ""
        },
        roomList: []
    },
    cjson = require('cjson'),
    load = function (path) {
        const loadedSettings = cjson.load(path);

        return Object.assign({}, defaultSettings, loadedSettings);
    }
;

module.exports.load = load;
module.exports.SYNC = {
    BOTH: 'both',
    TO_DISCORD: 'to_discord',
    TO_JABBER: 'to_jabber',
};