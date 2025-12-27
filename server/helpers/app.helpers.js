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
    if (!pub) throw new TypeError("Input is null or undefined");
    if (Buffer.isBuffer(pub)) return pub;

    // Handle Strings - Assume Base64 (Standard for Signal)
    if (typeof pub === "string") {
        return Buffer.from(pub.trim(), "base64");
    }

    // Handle Uint8Array / TypedArrays (Crucial for Signal)
    if (ArrayBuffer.isView(pub)) {
        // Buffer.from(view.buffer, offset, length) is the most precise way
        return Buffer.from(pub.buffer, pub.byteOffset, pub.byteLength);
    }

    // Handle raw ArrayBuffer
    if (pub instanceof ArrayBuffer) {
        return Buffer.from(pub);
    }

    // Handle { data: [1, 2, 3] } - Result of JSON.stringify(Buffer)
    if (pub && typeof pub === "object" && Array.isArray(pub.data)) {
        return Buffer.from(pub.data);
    }

    if (Array.isArray(pub)) return Buffer.from(pub);

    throw new TypeError("Unsupported format for conversion to Buffer");
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

const getUserDisplayName = async (user_id) => {
    const result = await query(
        'SELECT display_name FROM "user" WHERE id = $1',
        [user_id]
    );

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0].display_name;
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
            deviceId: device.device_id,
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

            await query(
                "UPDATE opk_keys SET is_used = true WHERE user_id = $1 AND key_id = $2 AND device_id = $3",
                [userId, bundle.preKey.keyId, device.device_id]
            );
        }
        allBundles.push(bundle);
    }

    return allBundles;
};

const checkIfChatExists = async (chatId) => {
    // Check if chat exists
    const chat = await query("SELECT id FROM chats WHERE id = $1", [chatId]);

    if (chat.rowCount === 0) {
        return false;
    }

    return chat;
};

const getAllActiveDevicesForUser = async (userId) => {
    const devices = await query(
        "SELECT device_id FROM device_keys WHERE user_id = $1",
        [userId]
    );
    return devices.rows.map((row) => row.device_id);
};

const getAllChatMembers = async (chatId) => {
    const members = await query(
        "SELECT user_id FROM chat_members WHERE chat_id = $1",
        [chatId]
    );
    return members.rows.map((row) => row.user_id);
}

export {
    checkIfUserExists,
    checkIfUsersAreFriends,
    getUserFromDisplayName,
    fetchPrekeyBundle,
    checkIfChatExists,
    getAllActiveDevicesForUser,
    getAllChatMembers,
    toBuffer,
    buf2hex,
    getUserDisplayName,
};
