/// <reference types="node" />
import { WA } from '../Binary/Constants';
import { proto } from '../../WAMessage/WAMessage';
import { Agent } from 'https';
export declare const WS_URL = "wss://web.whatsapp.com/ws";
export declare const DEFAULT_ORIGIN = "https://web.whatsapp.com";
export declare const KEEP_ALIVE_INTERVAL_MS: number;
export { proto as WAMessageProto };
export declare type WANode = WA.Node;
export declare type WAMessage = proto.WebMessageInfo;
export declare type WAMessageContent = proto.IMessage;
export declare type WAContactMessage = proto.ContactMessage;
export declare type WAMessageKey = proto.IMessageKey;
export declare type WATextMessage = proto.ExtendedTextMessage;
export declare type WAContextInfo = proto.IContextInfo;
export declare type WAGenericMediaMessage = proto.IVideoMessage | proto.IImageMessage | proto.IAudioMessage | proto.IDocumentMessage | proto.IStickerMessage;
export import WA_MESSAGE_STUB_TYPE = proto.WebMessageInfo.WEB_MESSAGE_INFO_STUBTYPE;
export import WA_MESSAGE_STATUS_TYPE = proto.WebMessageInfo.WEB_MESSAGE_INFO_STATUS;
import KeyedDB from '@adiwajshing/keyed-db';
export interface WALocationMessage {
    degreesLatitude: number;
    degreesLongitude: number;
    address?: string;
}
/** Reverse stub type dictionary */
export declare const WA_MESSAGE_STUB_TYPES: Record<number, string>;
export declare class BaileysError extends Error {
    status?: number;
    context: any;
    constructor(message: string, context: any);
}
export declare const TimedOutError: () => BaileysError;
export declare const CancelledError: () => BaileysError;
export interface WAQuery {
    json: any[] | WANode;
    binaryTags?: WATag;
    timeoutMs?: number;
    tag?: string;
    expect200?: boolean;
    waitForOpen?: boolean;
    longTag?: boolean;
    requiresPhoneConnection?: boolean;
    startDebouncedTimeout?: boolean;
}
export declare enum ReconnectMode {
    /** does not reconnect */
    off = 0,
    /** reconnects only when the connection is 'lost' or 'close' */
    onConnectionLost = 1,
    /** reconnects on all disconnects, including take overs */
    onAllErrors = 2
}
export declare type WALoadChatOptions = {
    searchString?: string;
    custom?: (c: WAChat) => boolean;
    loadProfilePicture?: boolean;
};
export declare type WAConnectOptions = {
    /** New QR generation interval, set to null if you don't want to regenerate */
    regenerateQRIntervalMs?: number;
    /** fails the connection if no data is received for X seconds */
    maxIdleTimeMs?: number;
    /** maximum attempts to connect */
    maxRetries?: number;
    /** should the chats be waited for */
    waitForChats?: boolean;
    /** if set to true, the connect only waits for the last message of the chat */
    waitOnlyForLastMessage?: boolean;
    /** max time for the phone to respond to a connectivity test */
    phoneResponseTime?: number;
    connectCooldownMs?: number;
    /** agent used for WS connections */
    agent?: Agent;
    /** agent used for fetch requests -- uploading/downloading media */
    fetchAgent?: Agent;
    /** Always uses takeover for connections */
    alwaysUseTakeover?: boolean;
};
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
export declare const URL_REGEX: RegExp;
export declare type WAConnectionState = 'open' | 'connecting' | 'close';
export declare const UNAUTHORIZED_CODES: number[];
/** Types of Disconnect Reasons */
export declare enum DisconnectReason {
    /** The connection was closed intentionally */
    intentional = "intentional",
    /** The connection was terminated either by the client or server */
    close = "close",
    /** The connection was lost, called when the server stops responding to requests */
    lost = "lost",
    /** When WA Web is opened elsewhere & this session is disconnected */
    replaced = "replaced",
    /** The credentials for the session have been invalidated, i.e. logged out either from the phone or WA Web */
    invalidSession = "invalid_session",
    /** Received a 500 result in a query -- something has gone very wrong */
    badSession = "bad_session",
    /** No idea, can be a sign of log out too */
    unknown = "unknown",
    /** Well, the connection timed out */
    timedOut = "timed out"
}
export interface MediaConnInfo {
    auth: string;
    ttl: number;
    hosts: {
        hostname: string;
    }[];
    fetchDate: Date;
}
export interface AuthenticationCredentials {
    clientID: string;
    serverToken: string;
    clientToken: string;
    encKey: Buffer;
    macKey: Buffer;
}
export interface AuthenticationCredentialsBase64 {
    clientID: string;
    serverToken: string;
    clientToken: string;
    encKey: string;
    macKey: string;
}
export interface AuthenticationCredentialsBrowser {
    WABrowserId: string;
    WASecretBundle: {
        encKey: string;
        macKey: string;
    } | string;
    WAToken1: string;
    WAToken2: string;
}
export declare type AnyAuthenticationCredentials = AuthenticationCredentialsBrowser | AuthenticationCredentialsBase64 | AuthenticationCredentials;
export interface WAGroupCreateResponse {
    status: number;
    gid?: string;
    participants?: [{
        [key: string]: any;
    }];
}
export interface WAGroupMetadata {
    id: string;
    owner: string;
    subject: string;
    creation: number;
    desc?: string;
    descOwner?: string;
    descId?: string;
    /** is set when the group only allows admins to change group settings */
    restrict?: 'true';
    /** is set when the group only allows admins to write messages */
    announce?: 'true';
    participants: [{
        id: string;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    }];
}
export interface WAGroupModification {
    status: number;
    participants?: {
        [key: string]: any;
    };
}
export interface WAContact {
    verify?: string;
    /** name of the contact, the contact has set on their own on WA */
    notify?: string;
    jid: string;
    /** I have no idea */
    vname?: string;
    /** name of the contact, you have saved on your WA */
    name?: string;
    index?: string;
    /** short name for the contact */
    short?: string;
    lastKnownPresence?: Presence;
    lastSeen?: number;
}
export interface WAUser extends WAContact {
    phone: any;
    imgUrl?: string;
}
export interface WAChat {
    jid: string;
    t: number;
    /** number of unread messages, is < 0 if the chat is manually marked unread */
    count: number;
    archive?: 'true' | 'false';
    read_only?: 'true' | 'false';
    mute?: string;
    pin?: string;
    spam: 'false' | 'true';
    modify_tag: string;
    name?: string;
    messages: KeyedDB<WAMessage, string>;
    imgUrl?: string;
}
export declare enum WAMetric {
    debugLog = 1,
    queryResume = 2,
    liveLocation = 3,
    queryMedia = 4,
    queryChat = 5,
    queryContact = 6,
    queryMessages = 7,
    presence = 8,
    presenceSubscribe = 9,
    group = 10,
    read = 11,
    chat = 12,
    received = 13,
    picture = 14,
    status = 15,
    message = 16,
    queryActions = 17,
    block = 18,
    queryGroup = 19,
    queryPreview = 20,
    queryEmoji = 21,
    queryVCard = 29,
    queryStatus = 30,
    queryStatusUpdate = 31,
    queryLiveLocation = 33,
    queryLabel = 36,
    queryQuickReply = 39
}
export declare const STORIES_JID = "status@broadcast";
export declare enum WAFlag {
    ignore = 128,
    acknowledge = 64,
    available = 32,
    unavailable = 16,
    expires = 8,
    skipOffline = 4
}
/** Tag used with binary queries */
export declare type WATag = [WAMetric, WAFlag];
/** set of statuses visible to other people; see updatePresence() in WhatsAppWeb.Send */
export declare enum Presence {
    available = "available",
    unavailable = "unavailable",
    composing = "composing",
    recording = "recording",
    paused = "paused"
}
/** Set of message types that are supported by the library */
export declare enum MessageType {
    text = "conversation",
    extendedText = "extendedTextMessage",
    contact = "contactMessage",
    location = "locationMessage",
    liveLocation = "liveLocationMessage",
    image = "imageMessage",
    video = "videoMessage",
    sticker = "stickerMessage",
    document = "documentMessage",
    audio = "audioMessage",
    product = "productMessage"
}
export declare const MessageTypeProto: {
    imageMessage: typeof proto.ImageMessage;
    videoMessage: typeof proto.VideoMessage;
    audioMessage: typeof proto.AudioMessage;
    stickerMessage: typeof proto.StickerMessage;
    documentMessage: typeof proto.DocumentMessage;
};
export declare enum ChatModification {
    archive = "archive",
    unarchive = "unarchive",
    pin = "pin",
    unpin = "unpin",
    mute = "mute",
    unmute = "unmute"
}
export declare const HKDFInfoKeys: {
    imageMessage: string;
    audioMessage: string;
    videoMessage: string;
    documentMessage: string;
    stickerMessage: string;
};
export declare enum Mimetype {
    jpeg = "image/jpeg",
    png = "image/png",
    mp4 = "video/mp4",
    gif = "video/gif",
    pdf = "application/pdf",
    ogg = "audio/ogg; codecs=opus",
    mp4Audio = "audio/mp4",
    /** for stickers */
    webp = "image/webp"
}
export interface MessageOptions {
    /** the message you want to quote */
    quoted?: WAMessage;
    /** some random context info (can show a forwarded message with this too) */
    contextInfo?: WAContextInfo;
    /** optional, if you want to manually set the timestamp of the message */
    timestamp?: Date;
    /** (for media messages) the caption to send with the media (cannot be sent with stickers though) */
    caption?: string;
    /**
     * For location & media messages -- has to be a base 64 encoded JPEG if you want to send a custom thumb,
     * or set to null if you don't want to send a thumbnail.
     * Do not enter this field if you want to automatically generate a thumb
     * */
    thumbnail?: string;
    /** (for media messages) specify the type of media (optional for all media types except documents) */
    mimetype?: Mimetype | string;
    /** (for media messages) file name for the media */
    filename?: string;
    /** For audio messages, if set to true, will send as a `voice note` */
    ptt?: boolean;
    /** Optional agent for media uploads */
    uploadAgent?: Agent;
    /** If set to true (default), automatically detects if you're sending a link & attaches the preview*/
    detectLinks?: boolean;
    /** Optionally specify the duration of the media (audio/video) in seconds */
    duration?: number;
    /** Fetches new media options for every media file */
    forceNewMediaOptions?: boolean;
}
export interface WABroadcastListInfo {
    status: number;
    name: string;
    recipients?: {
        id: string;
    }[];
}
export interface WAUrlInfo {
    'canonical-url': string;
    'matched-text': string;
    title: string;
    description: string;
    jpegThumbnail?: Buffer;
}
export interface WAProfilePictureChange {
    status: number;
    tag: string;
    eurl: string;
}
export interface MessageInfo {
    reads: {
        jid: string;
        t: string;
    }[];
    deliveries: {
        jid: string;
        t: string;
    }[];
}
export interface WAMessageStatusUpdate {
    from: string;
    to: string;
    /** Which participant caused the update (only for groups) */
    participant?: string;
    timestamp: Date;
    /** Message IDs read/delivered */
    ids: string[];
    /** Status of the Message IDs */
    type: WA_MESSAGE_STATUS_TYPE;
}
export interface WAOpenResult {
    /** Was this connection opened via a QR scan */
    newConnection: boolean;
    user: WAUser;
    updatedChats?: {
        [k: string]: Partial<WAChat>;
    };
}
export declare enum GroupSettingChange {
    messageSend = "announcement",
    settingsChange = "locked"
}
export interface PresenceUpdate {
    id: string;
    participant?: string;
    t?: string;
    type?: Presence;
    deny?: boolean;
}
export declare const MediaPathMap: {
    imageMessage: string;
    videoMessage: string;
    documentMessage: string;
    audioMessage: string;
    stickerMessage: string;
};
export declare const MimetypeMap: {
    imageMessage: Mimetype;
    videoMessage: Mimetype;
    documentMessage: Mimetype;
    audioMessage: Mimetype;
    stickerMessage: Mimetype;
};
export interface WASendMessageResponse {
    status: number;
    messageID: string;
    message: WAMessage;
}
export declare type BaileysEvent = 'open' | 'connecting' | 'close' | 'intermediate-close' | 'qr' | 'connection-phone-change' | 'user-presence-update' | 'user-status-update' | 'chat-new' | 'chat-update' | 'message-new' | 'message-update' | 'message-status-update' | 'group-participants-add' | 'group-participants-remove' | 'group-participants-promote' | 'group-participants-demote' | 'group-settings-update' | 'group-description-update' | 'received-pong' | 'credentials-updated' | 'connection-validated';
