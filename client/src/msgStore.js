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

async function idbGetAll() {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
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
            const items = await idbGetAll();
            for (const [k, v] of items) this._map.set(k, v);
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
    put: function (key, value, store) {
        this._map.set(key, value);
        // persist async, don't block
        idbPut(key, value, store).catch((e) =>
            console.warn("application store: idbPut failed", key, e)
        );
    },
    remove: function (key, store) {
        this._map.delete(key);
        idbDelete(key, store).catch((e) =>
            console.warn("application store: idbDelete failed", key, e)
        );
    },
};
