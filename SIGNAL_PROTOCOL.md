This document explains the implementation of the Signal Protocol in the Cyber Netwire application.

## Hybrid Sesame Model

### Architecture Summary & Core Compromises
| Feature | Design | Compromise |
|---------|--------|------------|
| Authentication | Google OAuth 2.0 (identity) + User password (decryption) | High identity assurance |
| Identity key storage | Private key is encrypted and stored on server | No absolute E2E security. Password theft + server breach can compromise all history |
| Decryption key | Derived from user password using Argon2id, never leaves the device. | Security depends on password strength. Server cannot decrypt keys without password |
| Messaging | Signal Protocol with unique device IDs | Provides Perfect Forward Secrecy (PFS) per message but not Post-Compromise Security (PCS) against a full server backup compromise. |

### Key Management & Device Lifecycle
**Device Identity**
- Identity key -- shared across all devices, encrypted with password-derived key. (decrypted locally)
- Device ID -- unique integer per active device.
- User ID -- unique integer per user, shared across devices.
- Device keys -- each device generates its own signed prekey and 50 one-time prekeys and send the public keys to the server. Private keys do not leave the device. On logout, the private keys are deleted locally.

**Login & Key Sync flow**
1. Identity verification: User logs in with Google OAuth
2. Key retrieval: User enters password and sends an Argon2id hashed HKDF expanded verifier to server, which verifies the password and returns the encrypted identity key, initialization vector, and salt from server.
3. Local decryption: Client derives decryption key using Argon2id with the password and salt.
4. Device registration: Client generates a new device ID, signed prekey, and 50 one-time prekeys.
5. Key upload: Client uploads the SPK and OPK public keys to the server under the new device ID.

**Device Pruning (Logout/Wipe)** <br>
To minimize complexity and reducec overheads, a maximum of 5 active devices per user is enforced. On login, if the user has 5 active devices, the oldest device (based on last active timestamp) is automatically logged, by keys being deleted from the server. On next login, the server rejects any requests from the unexistant device ID, forcing the user to re-register the device.
- Explicit logout: User-initiated logout deletes device keys from server and local storage.
- Implicit logout: The server deletes the least recently used device keys when the maximum device limit is reached. 

### Messaging and Session Flow
**Session Creation (X3DH)**
1. Device discovery: User A asks the server for all active device IDs and prekey bundles of User B.
2. Session initialization: User A treats each device of User B as a separate address and performs the X3DH handshake with each one independently, establishing a unique Double Ratchet session for each device.

**Message Sending**
- 1:1 DMs: User A encrypts the message separately for each of User B's devices using the respective session key. User A bundles the ciphertexts and sends them to the server.
- Group chats: User A encrypts the message with a random Sender key. User A subsequently encrypts the Sender key separately for each recipient device using their respective session keys. The server distributes the encrypted Sender key and ciphertext to all group members.

**Message Storage**
- Server storage: The server is a permanent relay. It stores all encrypted messages, sender keys, and metadata (sender ID, timestamp, chat ID) but cannot decrypt message contents.
- Client storage: The client stores decrypted messages and session states locally in IndexedDB. On explicit logout, all session data is deleted from the device.

**History Sync** <br>
This is required to allow new devices to access past messages.
1. Retrieve history: New device requests the last 100 messages from the server for a specific chat, ordered by timestamp.
2. Session rebuild: For the first retrieved message in the chat history, the user uses its private identity key and the sender's public Diffie-Hellman key to perform a DH ratchet step, rebuilding the session state. This process establishes the initial Root Key and Chain Keys.
3. Message decryption: The user iteratively decrypts each message using the Double Ratchet algorithm, updating the session state with each decryption to derive the necessary message keys.