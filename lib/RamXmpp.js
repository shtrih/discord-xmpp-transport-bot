'use strict';

var Xmpp = require('node-xmpp-client');

var Ram = function (userJID, password) {
    this.xmppClient = new Xmpp.Client({
        jid: userJID,
        password: password,
        bosh: false
    });

    this.getClient = function () {
        return this.xmppClient;
    };

    this.join = function(conferenceJID, nickname) {
        this.xmppClient.send(
            Xmpp.createStanza('presence', {to: conferenceJID + '/' + nickname}, new Xmpp.Element('x', { xmlns: 'http://jabber.org/protocol/muc' }))
        );
    };

    this.send = function (conferenceJID, message) {
        this.xmppClient.send(
            Xmpp.createStanza('message', {to: conferenceJID, type: 'groupchat'}, new Xmpp.Element('body').t(message))
        );
    };
};

module.exports = Ram;