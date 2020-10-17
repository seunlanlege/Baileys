import { WAChat, WAConnectOptions, WAOpenResult } from './Constants';
import { WAConnection as Base } from './1.Validation';
export declare class WAConnection extends Base {
    /** Connect to WhatsApp Web */
    connect(): Promise<WAOpenResult>;
    /** Meat of the connect logic */
    protected connectInternal(options: WAConnectOptions, delayMs?: number): Promise<void | {
        [k: string]: Partial<WAChat>;
    }>;
    /**
     * Sets up callbacks to receive chats, contacts & messages.
     * Must be called immediately after connect
     */
    protected receiveChatsAndContacts(waitOnlyForLast: boolean): {
        waitForChats: Promise<{
            [k: string]: Partial<WAChat>;
        }>;
        cancelChats: () => void;
    };
    private releasePendingRequests;
    private onMessageRecieved;
    /** Send a keep alive request every X seconds, server updates & responds with last seen */
    private startKeepAliveRequest;
}
