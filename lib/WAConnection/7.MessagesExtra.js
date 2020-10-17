"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAConnection = void 0;
const _6_MessagesSend_1 = require("./6.MessagesSend");
const Constants_1 = require("./Constants");
const Utils_1 = require("./Utils");
const Mutex_1 = require("./Mutex");
class WAConnection extends _6_MessagesSend_1.WAConnection {
    async loadAllUnreadMessages() {
        const tasks = this.chats.all()
            .filter(chat => chat.count > 0)
            .map(chat => this.loadMessages(chat.jid, chat.count));
        const list = await Promise.all(tasks);
        const combined = [];
        list.forEach(({ messages }) => combined.push(...messages));
        return combined;
    }
    /** Get the message info, who has read it, who its been delivered to */
    async messageInfo(jid, messageID) {
        const query = ['query', { type: 'message_info', index: messageID, jid: jid, epoch: this.msgCount.toString() }, null];
        const response = (await this.query({ json: query, binaryTags: [22, Constants_1.WAFlag.ignore], expect200: true }))[2];
        const info = { reads: [], deliveries: [] };
        if (response) {
            //console.log (response)
            const reads = response.filter(node => node[0] === 'read');
            if (reads[0]) {
                info.reads = reads[0][2].map(item => item[1]);
            }
            const deliveries = response.filter(node => node[0] === 'delivery');
            if (deliveries[0]) {
                info.deliveries = deliveries[0][2].map(item => item[1]);
            }
        }
        return info;
    }
    /**
     * Marks a chat as read/unread; updates the chat object too
     * @param jid the ID of the person/group whose message you want to mark read
     * @param unread unreads the chat, if true
     */
    async chatRead(jid, type = 'read') {
        jid = Utils_1.whatsappID(jid);
        const chat = this.assertChatGet(jid);
        if (type === 'unread')
            await this.sendReadReceipt(jid, null, -2);
        else if (chat.count !== 0) {
            const { messages } = await this.loadMessages(jid, 1);
            await this.sendReadReceipt(jid, messages[0].key, Math.abs(chat.count));
        }
        chat.count = type === 'unread' ? -1 : 0;
        this.emit('chat-update', { jid, count: chat.count });
    }
    /**
     * Sends a read receipt for a given message;
     * does not update the chat do @see chatRead
     * @param jid the ID of the person/group whose message you want to mark read
     * @param messageKey the key of the message
     * @param count number of messages to read, set to < 0 to unread a message
     */
    async sendReadReceipt(jid, messageKey, count) {
        var _a;
        const attributes = {
            jid: jid,
            count: count.toString(),
            index: messageKey === null || messageKey === void 0 ? void 0 : messageKey.id,
            owner: (_a = messageKey === null || messageKey === void 0 ? void 0 : messageKey.fromMe) === null || _a === void 0 ? void 0 : _a.toString()
        };
        const read = await this.setQuery([['read', attributes, null]]);
        return read;
    }
    async fetchMessagesFromWA(jid, count, indexMessage, mostRecentFirst = true) {
        var _a;
        const json = [
            'query',
            {
                epoch: this.msgCount.toString(),
                type: 'message',
                jid: jid,
                kind: mostRecentFirst ? 'before' : 'after',
                count: count.toString(),
                index: indexMessage === null || indexMessage === void 0 ? void 0 : indexMessage.id,
                owner: (indexMessage === null || indexMessage === void 0 ? void 0 : indexMessage.fromMe) === false ? 'false' : 'true',
            },
            null,
        ];
        const response = await this.query({ json, binaryTags: [Constants_1.WAMetric.queryMessages, Constants_1.WAFlag.ignore], expect200: false });
        return ((_a = response[2]) === null || _a === void 0 ? void 0 : _a.map(item => item[2])) || [];
    }
    /**
     * Load the conversation with a group or person
     * @param count the number of messages to load
     * @param cursor the data for which message to offset the query by
     * @param mostRecentFirst retreive the most recent message first or retreive from the converation start
     */
    async loadMessages(jid, count, cursor, mostRecentFirst = true) {
        var _a;
        jid = Utils_1.whatsappID(jid);
        const retreive = (count, indexMessage) => this.fetchMessagesFromWA(jid, count, indexMessage, mostRecentFirst);
        const chat = this.chats.get(jid);
        const hasCursor = (cursor === null || cursor === void 0 ? void 0 : cursor.id) && typeof (cursor === null || cursor === void 0 ? void 0 : cursor.fromMe) !== 'undefined';
        const cursorValue = hasCursor && chat.messages.get(Utils_1.GET_MESSAGE_ID(cursor));
        let messages;
        if (chat && mostRecentFirst && (!hasCursor || cursorValue)) {
            messages = chat.messages.paginatedByValue(cursorValue, count, null, 'before');
            const diff = count - messages.length;
            if (diff < 0) {
                messages = messages.slice(-count); // get the last X messages
            }
            else if (diff > 0) {
                const fMessage = chat.messages.all()[0];
                let fepoch = (fMessage && fMessage['epoch']) || 0;
                const extra = await retreive(diff, ((_a = messages[0]) === null || _a === void 0 ? void 0 : _a.key) || cursor);
                // add to DB
                for (let i = extra.length - 1; i >= 0; i--) {
                    const m = extra[i];
                    fepoch -= 1;
                    m['epoch'] = fepoch;
                    if (chat.messages.length < this.maxCachedMessages && !chat.messages.get(Utils_1.WA_MESSAGE_ID(m))) {
                        chat.messages.insert(m);
                    }
                }
                messages.unshift(...extra);
            }
        }
        else
            messages = await retreive(count, cursor);
        if (messages[0])
            cursor = { id: messages[0].key.id, fromMe: messages[0].key.fromMe };
        else
            cursor = null;
        return { messages, cursor };
    }
    /**
     * Load the entire friggin conversation with a group or person
     * @param onMessage callback for every message retreived
     * @param chunkSize the number of messages to load in a single request
     * @param mostRecentFirst retreive the most recent message first or retreive from the converation start
     */
    loadAllMessages(jid, onMessage, chunkSize = 25, mostRecentFirst = true) {
        let offsetID = null;
        const loadMessage = async () => {
            const { messages } = await this.loadMessages(jid, chunkSize, offsetID, mostRecentFirst);
            // callback with most recent message first (descending order of date)
            let lastMessage;
            if (mostRecentFirst) {
                for (let i = messages.length - 1; i >= 0; i--) {
                    onMessage(messages[i]);
                    lastMessage = messages[i];
                }
            }
            else {
                for (let i = 0; i < messages.length; i++) {
                    onMessage(messages[i]);
                    lastMessage = messages[i];
                }
            }
            // if there are still more messages
            if (messages.length >= chunkSize) {
                offsetID = lastMessage.key; // get the last message
                return new Promise((resolve, reject) => {
                    // send query after 200 ms
                    setTimeout(() => loadMessage().then(resolve).catch(reject), 200);
                });
            }
        };
        return loadMessage();
    }
    /**
     * Find a message in a given conversation
     * @param chunkSize the number of messages to load in a single request
     * @param onMessage callback for every message retreived, if return true -- the loop will break
     */
    async findMessage(jid, chunkSize, onMessage) {
        var _a;
        const chat = this.chats.get(Utils_1.whatsappID(jid));
        let count = ((_a = chat === null || chat === void 0 ? void 0 : chat.messages) === null || _a === void 0 ? void 0 : _a.all().length) || chunkSize;
        let offsetID;
        while (true) {
            const { messages, cursor } = await this.loadMessages(jid, count, offsetID, true);
            // callback with most recent message first (descending order of date)
            for (let i = messages.length - 1; i >= 0; i--) {
                if (onMessage(messages[i]))
                    return;
            }
            if (messages.length === 0)
                return;
            // if there are more messages
            offsetID = cursor;
            await Utils_1.delay(200);
        }
    }
    /**
     * Loads all messages sent after a specific date
     */
    async messagesReceivedAfter(date, onlyUnrespondedMessages = false) {
        const stamp = Utils_1.unixTimestampSeconds(date);
        // find the index where the chat timestamp becomes greater
        const idx = this.chats.all().findIndex(c => c.t < stamp);
        // all chats before that index -- i.e. all chats that were updated after that
        const chats = this.chats.all().slice(0, idx);
        const messages = [];
        await Promise.all(chats.map(async (chat) => {
            await this.findMessage(chat.jid, 5, m => {
                if (Utils_1.toNumber(m.messageTimestamp) < stamp || (onlyUnrespondedMessages && m.key.fromMe))
                    return true;
                messages.push(m);
            });
        }));
        return messages;
    }
    /** Load a single message specified by the ID */
    async loadMessage(jid, id) {
        let message;
        jid = Utils_1.whatsappID(jid);
        const chat = this.chats.get(jid);
        if (chat) {
            // see if message is present in cache
            message = chat.messages.get(Utils_1.GET_MESSAGE_ID({ id, fromMe: true })) || chat.messages.get(Utils_1.GET_MESSAGE_ID({ id, fromMe: false }));
        }
        if (!message) {
            // load the message before the given message
            let messages = (await this.loadMessages(jid, 1, { id, fromMe: true })).messages;
            if (!messages[0])
                messages = (await this.loadMessages(jid, 1, { id, fromMe: false })).messages;
            // the message after the loaded message is the message required
            const actual = await this.loadMessages(jid, 1, messages[0] && messages[0].key, false);
            message = actual.messages[0];
        }
        return message;
    }
    /**
     * Search WhatsApp messages with a given text string
     * @param txt the search string
     * @param inJid the ID of the chat to search in, set to null to search all chats
     * @param count number of results to return
     * @param page page number of results (starts from 1)
     */
    async searchMessages(txt, inJid, count, page) {
        const json = [
            'query',
            {
                epoch: this.msgCount.toString(),
                type: 'search',
                search: Buffer.from(txt, 'utf-8'),
                count: count.toString(),
                page: page.toString(),
                jid: inJid
            },
            null,
        ];
        const response = await this.query({ json, binaryTags: [24, Constants_1.WAFlag.ignore], expect200: true }); // encrypt and send  off
        const messages = response[2] ? response[2].map(row => row[2]) : [];
        return { last: response[1]['last'] === 'true', messages: messages };
    }
    /**
     * Delete a message in a chat for yourself
     * @param messageKey key of the message you want to delete
     */
    async clearMessage(messageKey) {
        const tag = Math.round(Math.random() * 1000000);
        const attrs = [
            'chat',
            { jid: messageKey.remoteJid, modify_tag: tag.toString(), type: 'clear' },
            [
                ['item', { owner: `${messageKey.fromMe}`, index: messageKey.id }, null]
            ]
        ];
        const result = await this.setQuery([attrs]);
        const chat = this.chats.get(Utils_1.whatsappID(messageKey.remoteJid));
        if (chat) {
            const value = chat.messages.get(Utils_1.GET_MESSAGE_ID(messageKey));
            value && chat.messages.delete(value);
        }
        return result;
    }
    /**
     * Delete a message in a chat for everyone
     * @param id the person or group where you're trying to delete the message
     * @param messageKey key of the message you want to delete
     */
    async deleteMessage(id, messageKey) {
        const json = {
            protocolMessage: {
                key: messageKey,
                type: Constants_1.WAMessageProto.ProtocolMessage.PROTOCOL_MESSAGE_TYPE.REVOKE
            }
        };
        const waMessage = this.prepareMessageFromContent(id, json, {});
        await this.relayWAMessage(waMessage);
        return waMessage;
    }
    /**
     * Forward a message like WA does
     * @param id the id to forward the message to
     * @param message the message to forward
     * @param forceForward will show the message as forwarded even if it is from you
     */
    async forwardMessage(id, message, forceForward = false) {
        var _a;
        const content = message.message;
        if (!content)
            throw new Error('no content in message');
        let key = Object.keys(content)[0];
        let score = ((_a = content[key].contextInfo) === null || _a === void 0 ? void 0 : _a.forwardingScore) || 0;
        score += message.key.fromMe && !forceForward ? 0 : 1;
        if (key === Constants_1.MessageType.text) {
            content[Constants_1.MessageType.extendedText] = { text: content[key] };
            delete content[Constants_1.MessageType.text];
            key = Constants_1.MessageType.extendedText;
        }
        if (score > 0)
            content[key].contextInfo = { forwardingScore: score, isForwarded: true };
        else
            content[key].contextInfo = {};
        const waMessage = this.prepareMessageFromContent(id, content, {});
        await this.relayWAMessage(waMessage);
        return waMessage;
    }
}
__decorate([
    Mutex_1.Mutex()
], WAConnection.prototype, "loadAllUnreadMessages", null);
__decorate([
    Mutex_1.Mutex((jid, messageID) => jid + messageID)
], WAConnection.prototype, "messageInfo", null);
__decorate([
    Mutex_1.Mutex(jid => jid)
], WAConnection.prototype, "chatRead", null);
__decorate([
    Mutex_1.Mutex(jid => jid)
], WAConnection.prototype, "loadMessages", null);
__decorate([
    Mutex_1.Mutex(m => m.remoteJid)
], WAConnection.prototype, "clearMessage", null);
exports.WAConnection = WAConnection;
