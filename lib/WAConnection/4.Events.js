"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAConnection = void 0;
const QR = __importStar(require("qrcode-terminal"));
const _3_Connect_1 = require("./3.Connect");
const Constants_1 = require("./Constants");
const Utils_1 = require("./Utils");
const keyed_db_1 = __importDefault(require("@adiwajshing/keyed-db"));
const Mutex_1 = require("./Mutex");
class WAConnection extends _3_Connect_1.WAConnection {
    constructor() {
        super();
        /** find a chat or return an error */
        this.assertChatGet = jid => {
            const chat = this.chats.get(jid);
            if (!chat)
                throw new Error(`chat '${jid}' not found`);
            return chat;
        };
        this.chatUpdateTime = chat => this.chats.updateKey(chat, c => c.t = Utils_1.unixTimestampSeconds());
        // new messages
        this.registerCallback(['action', 'add:relay', 'message'], json => {
            const message = json[2][0][2];
            const jid = Utils_1.whatsappID(message.key.remoteJid);
            if (jid.endsWith('@s.whatsapp.net')) {
                const contact = this.contacts[jid];
                if (contact && (contact === null || contact === void 0 ? void 0 : contact.lastKnownPresence) === Constants_1.Presence.composing) {
                    contact.lastKnownPresence = Constants_1.Presence.available;
                }
            }
            this.chatAddMessageAppropriate(message);
        });
        // presence updates
        this.registerCallback('Presence', json => {
            const update = json[1];
            const jid = Utils_1.whatsappID(update.id);
            const contact = this.contacts[jid];
            if (contact && jid.endsWith('@s.whatsapp.net')) { // if its a single chat
                if (update.t)
                    contact.lastSeen = +update.t;
                else if (update.type === Constants_1.Presence.unavailable && contact.lastKnownPresence !== Constants_1.Presence.unavailable) {
                    contact.lastSeen = Utils_1.unixTimestampSeconds();
                }
                contact.lastKnownPresence = update.type;
            }
            this.emit('user-presence-update', update);
        });
        // If a message has been updated (usually called when a video message gets its upload url, or live locations)
        this.registerCallback(['action', 'add:update', 'message'], json => {
            const message = json[2][0][2];
            const jid = Utils_1.whatsappID(message.key.remoteJid);
            const chat = this.chats.get(jid);
            if (!chat)
                return;
            // reinsert to update
            const oldMessage = chat.messages.get(Utils_1.WA_MESSAGE_ID(message));
            if (oldMessage) {
                message['epoch'] = oldMessage['epoch'];
                chat.messages.delete(oldMessage);
                chat.messages.insert(message);
                this.emit('message-update', message);
            }
            else {
                this.logger.debug({ unhandled: true }, 'received message update for non-present message from ' + jid);
            }
        });
        // If a user's contact has changed
        this.registerCallback(['action', null, 'user'], json => {
            const node = json[2][0];
            if (node) {
                const user = node[1];
                user.jid = Utils_1.whatsappID(user.jid);
                this.contacts[user.jid] = user;
                const chat = this.chats.get(user.jid);
                if (chat) {
                    chat.name = user.name || user.notify || chat.name;
                    this.emit('chat-update', { jid: chat.jid, name: chat.name });
                }
            }
        });
        // chat archive, pin etc.
        this.registerCallback(['action', null, 'chat'], json => {
            var _a;
            json = json[2][0];
            const updateType = json[1].type;
            const jid = Utils_1.whatsappID((_a = json[1]) === null || _a === void 0 ? void 0 : _a.jid);
            const chat = this.chats.get(jid);
            if (!chat)
                return;
            const FUNCTIONS = {
                'delete': () => {
                    chat['delete'] = 'true';
                    this.chats.delete(chat);
                    return 'delete';
                },
                'clear': () => {
                    if (!json[2])
                        chat.messages.clear();
                    else
                        json[2].forEach(item => chat.messages.filter(m => m.key.id !== item[1].index));
                    return 'clear';
                },
                'archive': () => {
                    chat.archive = 'true';
                    return 'archive';
                },
                'unarchive': () => {
                    delete chat.archive;
                    return 'archive';
                },
                'pin': () => {
                    chat.pin = json[1].pin;
                    return 'pin';
                }
            };
            const func = FUNCTIONS[updateType];
            if (func) {
                const property = func();
                this.emit('chat-update', { jid, [property]: chat[property] || null });
            }
        });
        // profile picture updates
        this.registerCallback(['Cmd', 'type:picture'], async (json) => {
            const jid = Utils_1.whatsappID(json[1].jid);
            const chat = this.chats.get(jid);
            if (!chat)
                return;
            await this.setProfilePicture(chat);
            this.emit('chat-update', { jid, imgUrl: chat.imgUrl });
        });
        // status updates
        this.registerCallback(['Status'], async (json) => {
            const jid = Utils_1.whatsappID(json[1].id);
            this.emit('user-status-update', { jid, status: json[1].status });
        });
        // read updates
        this.registerCallback(['action', null, 'read'], async (json) => {
            const update = json[2][0][1];
            const jid = Utils_1.whatsappID(update.jid);
            const chat = this.chats.get(jid) || await this.chatAdd(jid);
            if (update.type === 'false')
                chat.count = -1;
            else
                chat.count = 0;
            this.emit('chat-update', { jid: chat.jid, count: chat.count });
        });
        this.registerCallback(['action', 'add:relay', 'received'], json => {
            json = json[2][0][1];
            if (json.type === 'error') {
                const update = {
                    from: this.user.jid,
                    to: json.jid,
                    participant: this.user.jid,
                    timestamp: new Date(),
                    ids: [json.index],
                    type: Constants_1.WA_MESSAGE_STATUS_TYPE.ERROR,
                };
                this.forwardStatusUpdate(update);
            }
        });
        const func = json => {
            json = json[1];
            let ids = json.id;
            if (json.cmd === 'ack')
                ids = [json.id];
            const update = {
                from: json.from,
                to: json.to,
                participant: json.participant,
                timestamp: new Date(json.t * 1000),
                ids: ids,
                type: (+json.ack) + 1,
            };
            this.forwardStatusUpdate(update);
        };
        this.registerCallback('Msg', func);
        this.registerCallback('MsgInfo', func);
        this.on('qr', qr => QR.generate(qr, { small: true }));
    }
    /** Get the URL to download the profile picture of a person/group */
    async getProfilePicture(jid) {
        const response = await this.query({ json: ['query', 'ProfilePicThumb', jid || this.user.jid], expect200: true, requiresPhoneConnection: false });
        return response.eurl;
    }
    forwardStatusUpdate(update) {
        const chat = this.chats.get(Utils_1.whatsappID(update.to));
        if (!chat)
            return;
        this.emit('message-status-update', update);
        this.chatUpdatedMessage(update.ids, update.type, chat);
    }
    /** inserts an empty chat into the DB */
    async chatAdd(jid, name) {
        if (this.chats.get(jid))
            return;
        const chat = {
            jid: jid,
            t: Utils_1.unixTimestampSeconds(),
            messages: new keyed_db_1.default(Utils_1.waMessageKey, Utils_1.WA_MESSAGE_ID),
            count: 0,
            modify_tag: '',
            spam: 'false',
            name
        };
        this.chats.insert(chat);
        await this.setProfilePicture(chat);
        this.emit('chat-new', chat);
        return chat;
    }
    /** Adds the given message to the appropriate chat, if the chat doesn't exist, it is created */
    async chatAddMessageAppropriate(message) {
        const jid = Utils_1.whatsappID(message.key.remoteJid);
        const chat = this.chats.get(jid) || await this.chatAdd(jid);
        this.chatAddMessage(message, chat);
    }
    chatAddMessage(message, chat) {
        var _a;
        // add to count if the message isn't from me & there exists a message
        if (!message.key.fromMe && message.message) {
            chat.count += 1;
            const contact = this.contacts[chat.jid];
            if (contact && contact.lastKnownPresence === Constants_1.Presence.composing) { // update presence
                contact.lastKnownPresence = Constants_1.Presence.available; // emit change
                this.emit('user-presence-update', { id: chat.jid, presence: Constants_1.Presence.available, participant: message.participant });
            }
        }
        const protocolMessage = (_a = message.message) === null || _a === void 0 ? void 0 : _a.protocolMessage;
        // if it's a message to delete another message
        if (protocolMessage) {
            switch (protocolMessage.type) {
                case Constants_1.WAMessageProto.ProtocolMessage.PROTOCOL_MESSAGE_TYPE.REVOKE:
                    const found = chat.messages.get(Utils_1.GET_MESSAGE_ID(protocolMessage.key));
                    if (found === null || found === void 0 ? void 0 : found.message) {
                        this.logger.info('deleting message: ' + protocolMessage.key.id + ' in chat: ' + protocolMessage.key.remoteJid);
                        found.messageStubType = Constants_1.WA_MESSAGE_STUB_TYPE.REVOKE;
                        delete found.message;
                        this.emit('message-update', found);
                    }
                    break;
                default:
                    break;
            }
        }
        else {
            const messages = chat.messages;
            // if the message is already there
            if (messages.get(Utils_1.WA_MESSAGE_ID(message)))
                return;
            const last = messages.all().slice(-1);
            const lastEpoch = ((last && last[0]) && last[0]['epoch']) || 0;
            message['epoch'] = lastEpoch + 1;
            messages.insert(message);
            while (messages.length > this.maxCachedMessages) {
                messages.delete(messages.all()[0]); // delete oldest messages
            }
            // only update if it's an actual message
            if (message.message)
                this.chatUpdateTime(chat);
            this.emit('message-new', message);
            // check if the message is an action 
            if (message.messageStubType) {
                const jid = chat.jid;
                let actor = Utils_1.whatsappID(message.participant);
                let participants;
                switch (message.messageStubType) {
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_PARTICIPANT_LEAVE:
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_PARTICIPANT_REMOVE:
                        participants = message.messageStubParameters.map(Utils_1.whatsappID);
                        this.emit('group-participants-remove', { jid, actor, participants });
                        // mark the chat read only if you left the group
                        if (participants.includes(this.user.jid)) {
                            chat.read_only = 'true';
                            this.emit('chat-update', { jid, read_only: chat.read_only });
                        }
                        break;
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_PARTICIPANT_ADD:
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_PARTICIPANT_INVITE:
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_PARTICIPANT_ADD_REQUEST_JOIN:
                        participants = message.messageStubParameters.map(Utils_1.whatsappID);
                        if (participants.includes(this.user.jid) && chat.read_only === 'true') {
                            delete chat.read_only;
                            this.emit('chat-update', { jid, read_only: 'false' });
                        }
                        this.emit('group-participants-add', { jid, participants, actor });
                        break;
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_CHANGE_ANNOUNCE:
                        const announce = message.messageStubParameters[0] === 'on' ? 'true' : 'false';
                        this.emit('group-settings-update', { jid, announce, actor });
                        break;
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_CHANGE_ANNOUNCE:
                        const restrict = message.messageStubParameters[0] === 'on' ? 'true' : 'false';
                        this.emit('group-settings-update', { jid, restrict, actor });
                        break;
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_CHANGE_DESCRIPTION:
                        this.emit('group-description-update', { jid, actor });
                        break;
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_CHANGE_SUBJECT:
                    case Constants_1.WA_MESSAGE_STUB_TYPE.GROUP_CREATE:
                        chat.name = message.messageStubParameters[0];
                        this.emit('chat-update', { jid, name: chat.name });
                        break;
                }
            }
        }
    }
    chatUpdatedMessage(messageIDs, status, chat) {
        for (let id of messageIDs) {
            let msg = chat.messages.get(Utils_1.GET_MESSAGE_ID({ id, fromMe: true })) || chat.messages.get(Utils_1.GET_MESSAGE_ID({ id, fromMe: false }));
            if (msg && msg.status < status) {
                if (status <= Constants_1.WA_MESSAGE_STATUS_TYPE.PENDING)
                    msg.status = status;
                else if (Utils_1.isGroupID(chat.jid))
                    msg.status = status - 1;
                else
                    msg.status = status;
            }
        }
    }
    /** sets the profile picture of a chat */
    async setProfilePicture(chat) {
        chat.imgUrl = await this.getProfilePicture(chat.jid).catch(err => '');
    }
    on(event, listener) { return super.on(event, listener); }
    emit(event, ...args) { return super.emit(event, ...args); }
}
__decorate([
    Mutex_1.Mutex(jid => jid)
], WAConnection.prototype, "getProfilePicture", null);
exports.WAConnection = WAConnection;
