// libsignal storage implementation with in-memory Map + IndexedDB persistence
// Implements common methods expected by libsignal-protocol-typescript
// This was mostly AI generated

const DB_NAME = "libsignal_store";
const STORE_NAME = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = (ev) => resolve(ev.target.result);
    req.onerror = (ev) => reject(ev.target.error);
  });
}

async function idbPut(key, value) {
  const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
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

async function idbDelete(key) {
  const db = await openDb();
    return await new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
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

// Utility to stringify address objects used by libsignal
function addressToString(address) {
  if (!address) return String(address);
  if (typeof address === "string") return address;
  // libsignal SignalProtocolAddress has .name and .deviceId
  if (address.name !== undefined && address.deviceId !== undefined) {
    return `${address.name}:${address.deviceId}`;
  }
  // fallback
  try {
    return JSON.stringify(address);
  } catch (e) {
    return String(address);
  }
}

const store = {
  _map: new Map(),
  // init hydrates the in-memory store from IndexedDB
  init: async function () {
    try {
      const items = await idbGetAll();
      for (const [k, v] of items) this._map.set(k, v);
    } catch (e) {
      console.warn("libsignal store: failed to hydrate from IndexedDB:", e);
    }
  },

  // Generic map API
  get: function (key, defaultValue) {
    return this._map.has(key) ? this._map.get(key) : defaultValue;
  },
  put: function (key, value) {
    this._map.set(key, value);
    // persist async, don't block
    idbPut(key, value).catch((e) =>
      console.warn("libsignal store: idbPut failed", key, e)
    );
  },
  remove: function (key) {
    this._map.delete(key);
    idbDelete(key).catch((e) =>
      console.warn("libsignal store: idbDelete failed", key, e)
    );
  },

  // Identity key pair helpers
  getIdentityKeyPair: function () {
    return this.get("identityKey");
  },
  putIdentityKeyPair: function (pair) {
    this.put("identityKey", pair);
  },

  // Registration id
  getLocalRegistrationId: function () {
    return this.get("registrationId", null);
  },
  putLocalRegistrationId: function (regId) {
    this.put("registrationId", regId);
  },

  // PreKeys
  storePreKey: function (preKeyId, keyPair) {
    this.put(`preKey:${preKeyId}`, keyPair);
  },
  loadPreKey: function (preKeyId) {
    return this.get(`preKey:${preKeyId}`);
  },
  removePreKey: function (preKeyId) {
    this.remove(`preKey:${preKeyId}`);
  },

  // Signed PreKeys
  storeSignedPreKey: function (id, record) {
    this.put(`signedPreKey:${id}`, record);
  },
  loadSignedPreKey: function (id) {
    return this.get(`signedPreKey:${id}`);
  },
  removeSignedPreKey: function (id) {
    this.remove(`signedPreKey:${id}`);
  },

  // Sessions (address -> serialized session record)
  storeSession: function (address, record) {
    const k = `session:${addressToString(address)}`;
    this.put(k, record);
  },
  loadSession: function (address) {
    return this.get(`session:${addressToString(address)}`);
  },
  removeSession: function (address) {
    this.remove(`session:${addressToString(address)}`);
  },

  // Identity trust management
  isTrustedIdentity: function (identifier, identityKey, direction) {
    const keyName = `identityKey:${identifier}`;
    const existing = this.get(keyName);
    if (!existing) {
      this.put(keyName, identityKey);
      return true;
    }
    // compare ArrayBuffer/Uint8Array
    try {
      const a = new Uint8Array(existing);
      const b = new Uint8Array(identityKey);
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
      return true;
    } catch (e) {
      // fallback to direct equality
      return existing === identityKey;
    }
  },

  // Legacy compatibility: check identity
  saveIdentity: function (identifier, identityKey) {
    this.put(`identityKey:${identifier}`, identityKey);
  },

  // Utility to export store content (for debugging)
  dump: function () {
    const obj = {};
    for (const [k, v] of this._map) obj[k] = v;
    return obj;
  },
};

// Initialize hydration immediately (caller may await store.init if desired)
store.init();

export default store;
