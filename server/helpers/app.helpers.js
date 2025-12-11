import crypto from "crypto";
import query from "./../db/db.connect.js";

function buf2hex(buffer) {
    // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
}

function arrayBufferToBase64Node(ab) {
    return Buffer.from(ab).toString("base64");
}

// convert various incoming formats into Node Buffer
const toBuffer = (pub) => {
    if (Buffer.isBuffer(pub)) return pub;
    if (typeof pub === "string") {
        const s = pub.trim();
        // detect hex (only hex chars, even length)
        if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0)
            return Buffer.from(s, "hex");
        // otherwise assume base64
        return Buffer.from(s, "base64");
    }
    if (pub instanceof ArrayBuffer) return Buffer.from(new Uint8Array(pub));
    if (pub instanceof Uint8Array) return Buffer.from(pub);
    if (Array.isArray(pub)) return Buffer.from(pub);
    // object shape like { data: [...] }
    if (pub && typeof pub === "object" && Array.isArray(pub.data))
        return Buffer.from(pub.data);
    throw new TypeError("Unsupported publicKey format");
};

const checkIfUserExists = async (displayName, userNo) => {
    userNo = parseInt(userNo);
    const result = await query(
        'SELECT * FROM "user" WHERE display_name = $1 AND user_no = $2',
        [displayName, userNo]
    );
    console.log(result.rows);
    if (result.rowCount === 0) {
        return false;
    }

    return result;
};

const checkIfUsersAreFriends = async (userNo, friendNo) => {
    const result = await query(
        "SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2",
        [userNo, friendNo]
    );
    const result2 = await query(
        "SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2",
        [friendNo, userNo]
    );

    if (result.rowCount === 0 && result2.rowCount === 0) {
        return false;
    }

    return result.rowCount > 0 ? result : result2;
};

const sendKey = async (key, user_id, chat_id, key_version) => {
    const pub_key = await query('SELECT pub_key FROM "user" WHERE id = $1', [
        user_id,
    ]);
    if (pub_key.rowCount === 0) {
        return false;
    }
    const pubKey = crypto.createPublicKey({
        key: Buffer.from(pub_key.rows[0].pub_key, "hex"),
        format: "der",
        type: "spki",
    });

    const encryptedKey = crypto.publicEncrypt(pubKey, key);
    const upload = await query(
        "INSERT INTO keys (recipient_id, chat_id, key_version, key, pub_key) VALUES ($1, $2, $3, $4, $5) RETURNING key",
        [
            user_id,
            chat_id,
            key_version,
            buf2hex(encryptedKey),
            pub_key.rows[0].pub_key,
        ]
    );
    if (upload.rowCount === 0) {
        return false;
    }

    return upload;
};

const getUserFromDisplayName = async (displayName, user_no) => {
    const userResult = await query(
        `SELECT * FROM "user" WHERE display_name = $1 AND user_no = $2`,
        [displayName, user_no]
    );

    if (userResult.rowCount === 0) {
        return false;
    }

    return userResult;
};

const fetchPrekeyBundle = async (userId) => {
    const identityBundle = await query(
        "SELECT * FROM user_keys WHERE user_id = $1",
        [userId]
    );
    if (identityBundle.rows.length === 0) {
        return null;
    }

    let allBundles = [];
    const deviceBundles = await query(
        "SELECT * FROM device_keys WHERE user_id = $1",
        [userId]
    );

    for (let device of deviceBundles.rows) {
        const bundle = {
            registrationId: identityBundle.rows[0].registration_id,
            deviceId: device.device_id,
            identityKey: arrayBufferToBase64Node(
                identityBundle.rows[0].identity_key
            ), // ArrayBuffer
            signedPreKey: {
                keyId: device.spk_id,
                publicKey: arrayBufferToBase64Node(device.spk_public_key), // ArrayBuffer
                signature: arrayBufferToBase64Node(device.spk_signature), // ArrayBuffer
            },
            preKey: {},
        };
        const prekeyRes = await query(
            "SELECT * FROM opk_keys WHERE user_id = $1 AND is_used = false AND device_id = $2 ORDER BY key_id ASC LIMIT 1",
            [userId, device.device_id]
        );

        if (prekeyRes.rows.length > 0) {
            bundle.preKey = {
                keyId: prekeyRes.rows[0].key_id,
                publicKey: arrayBufferToBase64Node(
                    prekeyRes.rows[0].public_key
                ), // ArrayBuffer
            };
        }

        await query(
            "UPDATE opk_keys SET is_used = true WHERE user_id = $1 AND key_id = $2",
            [userId, bundle.preKey.keyId]
        );
        allBundles.push(bundle);
    }

    // const bundle = {
    //     registrationId: identityBundle.rows[0].registration_id,
    //     deviceId: deviceBundle.rows[0].device_id,
    //     identityKey: arrayBufferToBase64Node(
    //         identityBundle.rows[0].identity_key
    //     ), // ArrayBuffer
    //     signedPreKey: {
    //         keyId: deviceBundle.rows[0].spk_id,
    //         publicKey: arrayBufferToBase64Node(
    //             deviceBundle.rows[0].spk_public_key
    //         ), // ArrayBuffer
    //         signature: arrayBufferToBase64Node(
    //             deviceBundle.rows[0].spk_signature
    //         ), // ArrayBuffer
    //     },
    //     preKey: {},
    // };

    return allBundles;
};

export {
    checkIfUserExists,
    checkIfUsersAreFriends,
    sendKey,
    getUserFromDisplayName,
    fetchPrekeyBundle,
};
