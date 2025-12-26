// IndexedDB store for messages and sessions

const DB_NAME = "app_store";
const STORE_CHATS = "chats";
const STORE_MESSAGES = "messages";
const STORE_PENDING = "pending_ciphertexts";

function openDb() {
    return new Promise((resolve, reject) => {
        const req = window.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (ev) => {
            const db = ev.target.result;
            if (!db.objectStoreNames.contains(STORE_CHATS)) {
                db.createObjectStore(STORE_CHATS, { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
                db.createObjectStore(STORE_MESSAGES, { keyPath: "key" });
            }
            if (!db.objectStoreNames.contains(STORE_PENDING)) {
                db.createObjectStore(STORE_PENDING, { keyPath: "key" });
            }
        };
        req.onsuccess = (ev) => resolve(ev.target.result);
        req.onerror = (ev) => reject(ev.target.error);
    });
}

// TODO: edit idbGetAll to accept storeName parameter, then create db according to specs

async function idbPut(key, value, storeName) {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);
        store.put({ key, value });
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

async function idbGetAll(storeName) {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readonly");
        const store = tx.objectStore(storeName);
        const items = new Map();
        const req = store.openCursor();
        req.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (!cursor) {
                db.close();
                resolve(items);
                return;
            }
            items.set(cursor.key, cursor.value.value);
            cursor.continue();
        };
        req.onerror = (ev_1) => {
            db.close();
            reject(ev_1.target.error);
        };
    });
}

async function idbDelete(key, storeName) {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], "readwrite");
        const store = tx.objectStore(storeName);
        store.delete(key);
        tx.oncomplete = () => {
            db.close();
            resolve();
        };
        tx.onerror = () => {
            db.close();
            reject(tx.error);
        };
    });
}

const store = {
    _map: new Map(),

    init: async function () {
        try {
            // Hydrate from all stores
            const chats = await idbGetAll(STORE_CHATS);
            const messages = await idbGetAll(STORE_MESSAGES);
            const pending = await idbGetAll(STORE_PENDING);
            for (const [k, v] of chats) this._map.set(`chats:${k}`, v);
            for (const [k, v] of messages) this._map.set(`messages:${k}`, v);
            for (const [k, v] of pending) this._map.set(`pending:${k}`, v);
        } catch (e) {
            console.warn(
                "application store: failed to hydrate from IndexedDB:",
                e
            );
        }
    },

    // Generic map API
    get: function (key, defaultValue) {
        return this._map.has(key) ? this._map.get(key) : defaultValue;
    },
    put: function (key, value, storeName = STORE_CHATS) {
        this._map.set(key, value);
        // persist async, don't block
        idbPut(key, value, storeName).catch((e) =>
            console.warn("application store: idbPut failed", key, e)
        );
    },
    remove: function (key, storeName = STORE_CHATS) {
        this._map.delete(key);
        idbDelete(key, storeName).catch((e) =>
            console.warn("application store: idbDelete failed", key, e)
        );
    },

    // CHATS - store a new chat or update existing
    createChat: function (chatId, chatName, dmPartnerId = null) {
        const chat = {
            chat_id: chatId,
            dm_partner_id: dmPartnerId,
            chat_name: chatName,
            last_message_text: "",
            last_message_timestamp: Date.now(),
            unread_count: 0,
        };
        this.put(chatId, chat, STORE_CHATS);
        return chat;
    },

    // Get a single chat by ID
    getChat: function (chatId) {
        return this.get(`chats:${chatId}`);
    },

    // Get all chats (returns array sorted by last_message_timestamp descending)
    getAllChats: function () {
        const chats = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("chats:")) {
                chats.push(v);
            }
        }
        // Sort by last_message_timestamp descending (newest first)
        chats.sort((a, b) => b.last_message_timestamp - a.last_message_timestamp);
        return chats;
    },

    // Update chat name
    updateChatName: function (chatId, newName) {
        const chat = this.getChat(chatId);
        if (chat) {
            chat.chat_name = newName;
            this.put(chatId, chat, STORE_CHATS);
        }
    },

    
    // Update last message info (text and timestamp)
    updateLastMessage: function (chatId, messageText, timestamp = Date.now()) {
        const chat = this.getChat(chatId);
        if (chat) {
            chat.last_message_text = messageText;
            chat.last_message_timestamp = timestamp;
            this.put(chatId, chat, STORE_CHATS);
        }
    },

    // Increment unread count
    incrementUnreadCount: function (chatId) {
        const chat = this.getChat(chatId);
        if (chat) {
            chat.unread_count += 1;
            this.put(chatId, chat, STORE_CHATS);
        }
    },

    // Decrement unread count (usually to 0 when user opens chat)
    decrementUnreadCount: function (chatId, amount = null) {
        const chat = this.getChat(chatId);
        if (chat) {
            const decrementAmount = amount !== null ? amount : chat.unread_count;
            chat.unread_count = Math.max(0, chat.unread_count - decrementAmount);
            this.put(chatId, chat, STORE_CHATS);
        }
    },

    // Set unread count to 0
    markChatAsRead: function (chatId) {
        const chat = this.getChat(chatId);
        if (chat) {
            chat.unread_count = 0;
            this.put(chatId, chat, STORE_CHATS);
        }
    },

    // Delete a chat
    deleteChat: function (chatId) {
        this.remove(chatId, STORE_CHATS);
    },

    // Get total unread count across all chats
    getTotalUnreadCount: function () {
        let total = 0;
        for (const [k, v] of this._map) {
            if (k.startsWith("chats:") && v.unread_count) {
                total += v.unread_count;
            }
        }
        return total;
    },

    // Get chats with unread messages
    getUnreadChats: function () {
        const unread = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("chats:") && v.unread_count > 0) {
                unread.push(v);
            }
        }
        return unread;
    },

    // Devices - per chat + user device id storage utilities

    // Add a single deviceId for a given chat and user (id stored as string)
    // Equivalent to: add one by one with user id and chat id
    addDeviceForChatUser: function (chatId, userId, deviceId) {
        if (!chatId || !userId || deviceId === undefined || deviceId === null) return;
        const key = `chatDevice:${chatId}:${userId}`;
        const existing = this.get(key) || [];
        const strId = String(deviceId);
        if (!existing.some((d) => String(d) === strId)) {
            existing.push(strId);
            this.put(key, existing, STORE_CHATS);
        }
    },

    // Get all deviceIds in a chat for a specific user
    getDeviceIdsForChatUser: function (chatId, userId) {
        if (!chatId || !userId) return [];
        const key = `chatDevice:${chatId}:${userId}`;
        return this.get(key) || [];
    },

    // Remove a deviceId for a given chat and user
    removeDeviceForChatUser: function (chatId, userId, deviceId) {
        if (!chatId || !userId || deviceId === undefined || deviceId === null) return;
        const key = `chatDevice:${chatId}:${userId}`;
        const existing = this.get(key) || [];
        const strId = String(deviceId);
        const filtered = existing.filter((d) => String(d) !== strId);
        if (filtered.length === 0) this.remove(key, STORE_CHATS);
        else this.put(key, filtered, STORE_CHATS);
    },

    // Remove device by id across chat (if you only have chatId+deviceId and want to remove for all users)
    // Not strictly required but provided for convenience
    removeDeviceFromChat: function (chatId, deviceId) {
        if (!chatId || deviceId === undefined || deviceId === null) return;
        const prefix = `chatDevice:${chatId}:`;
        const strId = String(deviceId);
        for (const [k, v] of this._map) {
            const keyStr = String(k);
            if (keyStr.startsWith(prefix) || keyStr.startsWith(`chats:${prefix}`)) {
                const existing = this.get(k) || [];
                const filtered = existing.filter((d) => String(d) !== strId);
                if (filtered.length === 0) this.remove(k, STORE_CHATS);
                else this.put(k, filtered, STORE_CHATS);
            }
        }
    },

    // Get a mapping of userId -> [deviceId,...] for all users in a chat
    getAllDeviceIdsForChat: function (chatId) {
        const result = {};
        if (!chatId) return result;
        const prefix = `chatDevice:${chatId}:`;
        const altPrefix = `chats:${prefix}`;
        for (const [k, v] of this._map) {
            const keyStr = String(k);
            if (keyStr.startsWith(prefix)) {
                const userId = keyStr.slice(prefix.length);
                result[userId] = Array.isArray(v) ? v.slice() : [];
            } else if (keyStr.startsWith(altPrefix)) {
                const userId = keyStr.slice(altPrefix.length);
                result[userId] = Array.isArray(v) ? v.slice() : [];
            }
        }
        return result;
    },

    // Get device list for a chat as an array of { userId, deviceIds }
    // This is useful when callers expect an indexed array and want to access
    // `result[i].userId` and `result[i].deviceIds`.
    getDeviceListForChat: function (chatId) {
        const list = [];
        if (!chatId) return list;
        const prefix = `chatDevice:${chatId}:`;
        const altPrefix = `chats:${prefix}`;
        for (const [k, v] of this._map) {
            const keyStr = String(k);
            if (keyStr.startsWith(prefix)) {
                const userId = keyStr.slice(prefix.length);
                list.push({ userId, deviceIds: Array.isArray(v) ? v.slice() : [] });
            } else if (keyStr.startsWith(altPrefix)) {
                const userId = keyStr.slice(altPrefix.length);
                list.push({ userId, deviceIds: Array.isArray(v) ? v.slice() : [] });
            }
        }
        return list;
    },

    // MESSAGES - store a new message
    createMessage: function (messageId, chatId, senderId, plaintextContent, status = "SENT", timestamp = Date.now(), senderName = "Other user") {
        const message = {
            message_id: messageId,
            chat_id: chatId,
            timestamp: timestamp,
            sender_id: senderId,
            sender_name: senderName,
            plaintext_content: plaintextContent,
            status: status,
        };
        const key = `messages:${messageId}`;
        this.put(key, message, STORE_MESSAGES);
        return message;
    },

    // Get a single message by ID
    getMessage: function (messageId) {
        return this.get(`messages:${messageId}`);
    },

    // Get all messages for a specific chat (sorted by timestamp ascending - oldest first)
    getMessagesByChatId: function (chatId) {
        const messages = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("messages:") && v.chat_id === chatId) {
                messages.push(v);
            }
        }
        // Sort by timestamp ascending (oldest first for chronological rendering)
        messages.sort((a, b) => a.timestamp - b.timestamp);
        return messages;
    },

    // Get all messages for a chat with pagination (limit and offset)
    getMessagesByChatIdPaginated: function (chatId, limit = 50, offset = 0) {
        const allMessages = this.getMessagesByChatId(chatId);
        return allMessages.slice(offset, offset + limit);
    },

    // Update message status (SENT -> DELIVERED -> READ)
    updateMessageStatus: function (messageId, newStatus) {
        const message = this.getMessage(messageId);
        if (message) {
            message.status = newStatus;
            const key = `messages:${messageId}`;
            this.put(key, message, STORE_MESSAGES);
        }
    },

    // Update message content (for edits)
    updateMessageContent: function (messageId, newContent) {
        const message = this.getMessage(messageId);
        if (message) {
            message.plaintext_content = newContent;
            const key = `messages:${messageId}`;
            this.put(key, message, STORE_MESSAGES);
        }
    },

    // Mark all messages in a chat as READ
    markChatMessagesAsRead: function (chatId) {
        const messages = this.getMessagesByChatId(chatId);
        for (const msg of messages) {
            if (msg.status !== "READ") {
                msg.status = "READ";
                this.put(msg.message_id, msg, STORE_MESSAGES);
            }
        }
    },

    // Delete a single message
    deleteMessage: function (messageId) {
        const key = `messages:${messageId}`;
        this.remove(key, STORE_MESSAGES);
    },

    // Delete all messages in a chat
    deleteMessagesByChat: function (chatId) {
        const messages = this.getMessagesByChatId(chatId);
        for (const msg of messages) {
            const key = `messages:${msg.message_id}`;
            this.remove(key, STORE_MESSAGES);
        }
    },

    // Get count of messages in a chat
    getMessageCountByChatId: function (chatId) {
        let count = 0;
        for (const [k, v] of this._map) {
            if (k.startsWith("messages:") && v.chat_id === chatId) {
                count++;
            }
        }
        return count;
    },

    // Get last message in a chat
    getLastMessageByChat: function (chatId) {
        const messages = this.getMessagesByChatId(chatId);
        return messages.length > 0 ? messages[messages.length - 1] : null;
    },

    // Search messages in a chat by content (case-insensitive substring match)
    searchMessagesInChat: function (chatId, searchText) {
        const messages = this.getMessagesByChatId(chatId);
        const lowerSearch = searchText.toLowerCase();
        return messages.filter((msg) =>
            String(msg.plaintext_content).toLowerCase().includes(lowerSearch)
        );
    },

    // Get all undelivered/unread messages
    getUndeliveredMessages: function () {
        const undelivered = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("messages:") && (v.status === "SENT" || v.status === "DELIVERED")) {
                undelivered.push(v);
            }
        }
        return undelivered;
    },

    // PENDING CIPHERTEXTS - store encrypted message received from server
    storePendingCiphertext: function (id, address, messageIndex, ciphertext) {
        const pending = {
            id: id,
            address: address,
            message_index: messageIndex,
            ciphertext: ciphertext,
        };
        this.put(id, pending, STORE_PENDING);
        return pending;
    },

    // Get a single pending ciphertext by ID
    getPendingCiphertext: function (id) {
        return this.get(`pending:${id}`);
    },

    // Get all pending ciphertexts (for bulk processing)
    getAllPendingCiphertexts: function () {
        const pending = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:")) {
                pending.push(v);
            }
        }
        // Sort by message_index ascending (process in order)
        pending.sort((a, b) => a.message_index - b.message_index);
        return pending;
    },

    // Get pending ciphertexts for a specific address (sender)
    getPendingCiphertextsByAddress: function (address) {
        const pending = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:") && v.address === address) {
                pending.push(v);
            }
        }
        // Sort by message_index ascending
        pending.sort((a, b) => a.message_index - b.message_index);
        return pending;
    },

    // Get pending ciphertexts by message_index range (for partial sync)
    getPendingCiphertextsByIndexRange: function (minIndex, maxIndex) {
        const pending = [];
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:") && v.message_index >= minIndex && v.message_index <= maxIndex) {
                pending.push(v);
            }
        }
        pending.sort((a, b) => a.message_index - b.message_index);
        return pending;
    },

    // Remove a pending ciphertext after successful decryption
    removePendingCiphertext: function (id) {
        this.remove(id, STORE_PENDING);
    },

    // Remove all pending ciphertexts for a specific address
    removePendingCiphertextsByAddress: function (address) {
        const pending = this.getPendingCiphertextsByAddress(address);
        for (const item of pending) {
            this.remove(item.id, STORE_PENDING);
        }
    },

    // Get count of pending ciphertexts
    getPendingCiphertextCount: function () {
        let count = 0;
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:")) {
                count++;
            }
        }
        return count;
    },

    // Get count of pending ciphertexts for a specific address
    getPendingCiphertextCountByAddress: function (address) {
        let count = 0;
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:") && v.address === address) {
                count++;
            }
        }
        return count;
    },

    // Check if a ciphertext with specific index from address exists
    hasPendingCiphertext: function (address, messageIndex) {
        for (const [k, v] of this._map) {
            if (k.startsWith("pending:") && v.address === address && v.message_index === messageIndex) {
                return true;
            }
        }
        return false;
    },

    // Clear all pending ciphertexts (use with caution)
    clearAllPendingCiphertexts: function () {
        const pending = this.getAllPendingCiphertexts();
        for (const item of pending) {
            this.remove(item.id, STORE_PENDING);
        }
    },  
};

store.init();

export default store;