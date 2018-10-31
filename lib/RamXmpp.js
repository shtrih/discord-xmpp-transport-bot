'use strict';

const
    Xmpp = require('node-xmpp-client'),
    EventEmitter = require('events'),
    Debug = require('debug'),
    LogDebug = Debug('debug:jabber'),
    LogError = Debug('error:jabber')
;

class Ram extends EventEmitter {
    constructor(userJID, password) {
        super();

        this.xmppClient = new Xmpp.Client({
            jid: userJID,
            password: password,
            bosh: false
        });

        this.registerListeners()
    }

    getClient() {
        return this.xmppClient;
    }

    join(conferenceJID, nickname) {
        this.xmppClient.send(
            Xmpp.createStanza(
                'presence',
                {to: conferenceJID + '/' + nickname},
                new Xmpp.Element('x', {xmlns: 'http://jabber.org/protocol/muc'}).c('history', {maxstanzas: 0}).up()
            )
        );
    }

    send(conferenceJID, message) {
        this.xmppClient.send(
            Xmpp.createStanza('message', {to: conferenceJID, type: 'groupchat'}, new Xmpp.Element('body').t(message))
        );
    }

    registerListeners() {
        this.xmppClient.on('stanza', (Stanza) => {
            let from = Stanza.from.split(/\/(.+)/, 2),
                from_jid = from[0],
                from_nick = from[1] || 'Server'
            ;

            if ('error' === Stanza.type) {
                LogError('[stanza:error] ', Stanza);
                this.emit('stanza:error', Stanza, from_jid, from_nick);

                return;
            }

            switch (Stanza.getName()) {
                case 'presence': {
                    if ('unavailable' === Stanza.type) {
                        let Item = Stanza.getChildrenByFilter(
                                el => {
                                    return el instanceof Xmpp.Element && el.getName() === 'item';
                                },
                                true
                            )[0],
                            // NOTE: Can be more than one <status/> node, but we work with only the first
                            Status = Stanza.getChildrenByFilter(
                                el => {
                                    return el instanceof Xmpp.Element && el.getName() === 'status';
                                },
                                true
                            )[0]
                        ;

                        /**
                         * @see https://xmpp.org/registrar/mucstatus.html
                         * @see https://xmpp.org/extensions/xep-0045.html#schemas-admin
                         */
                        if (Status) {
                            switch (Status.getAttr('code')) {
                                case '303':
                                    const new_nick = Item.getAttr('nick');
                                    this.emit('presence:rename', Stanza, from_jid, from_nick, new_nick);
                                    break;

                                case '301':
                                    this.emit('presence:disconnect:ban', Stanza, from_jid, from_nick, Item.getChild('actor'), Item.getChild('reason'));
                                    break;

                                case '307':
                                    this.emit('presence:disconnect:kick', Stanza, from_jid, from_nick, Item.getChild('actor'), Item.getChild('reason'));
                                    break;
                            }
                        }

                        this.emit('presence:disconnect', Stanza, from_jid, from_nick, Status)
                    }
                    else {
                        this.emit('presence:connect', Stanza, from_jid, from_nick)
                    }

                    break;
                }
                case 'message': {
                    let Body = Stanza.getChild('body'),
                        x = Stanza.getChild('x'),
                        has_delay = Stanza.getChild('delay') || (x && 'jabber:x:delay' === x.getAttr('xmlns')),
                        Subject = Stanza.getChild('subject'),
                        Status = Stanza.getChildrenByFilter(
                            el => {
                                return el instanceof Xmpp.Element && el.getName() === 'status';
                            },
                            true
                        )[0]
                    ;

                    if (Status) {
                        this.emit('message:status', Stanza, from_jid, from_nick, Status);
                        break;
                    }
                    if ('groupchat' === Stanza.type) {
                        if (Subject) {
                            this.emit('message:groupchat:subject', Stanza, from_jid, from_nick, (Body ? Body : Subject), has_delay);
                            break;
                        }

                        this.emit('message:groupchat', Stanza, from_jid, from_nick, Body, has_delay);
                    }
                    else if ('chat' === Stanza.type) {
                        this.emit('message:chat', Stanza, from_jid, from_nick, Body);
                    }

                    /** @see https://xmpp.org/extensions/xep-0158.html */
                    // "Your messages to friendly-chat@muc.victim.com are being blocked. To unblock
                    //      them, visit http://www.victim.com/challenge.html?A4C7303D"
                    if (Stanza.getChild('captcha')) {
                        this.emit('message:captcha', Stanza, from_jid, from_nick, Body);
                    }

                    break;
                }
                case 'iq':
                    this.emit('iq', Stanza, from_jid, from_nick);
                    break;

                default:
                    this.emit('stanza', Stanza, from_jid, from_nick);
            }
        });
    }
}

module.exports = Ram;