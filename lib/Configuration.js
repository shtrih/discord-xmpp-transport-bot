"use strict";

const defaultSettings = {
        prefix: '!',
        discord: {
            token: null,
            adminId: null
        },
        jabber: {
            userJid: "",
            userPass: "",
            showPresence: true,
            reconnectIntervalSec: 600
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