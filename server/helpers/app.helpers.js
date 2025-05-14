import crypto from 'crypto';
import query from './../db/db.connect.js';

function buf2hex(buffer) {
    // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
}

const checkIfUserExists = async (displayName, userNo) => {
    userNo = parseInt(userNo);
    const result = await query('SELECT * FROM "user" WHERE display_name = $1 AND user_no = $2', [displayName, userNo]);
    console.log(result.rows)
    if (result.rowCount === 0) {
        return false;
    }

    return result;
}

const checkIfUsersAreFriends = async (userNo, friendNo) => {
    const result = await query('SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2', [userNo, friendNo]);
    const result2 = await query('SELECT * FROM friends WHERE user_id = $1 AND friend_id = $2', [friendNo, userNo]);

    if (result.rowCount === 0 && result2.rowCount === 0) {
        return false;
    }

    return result.rowCount > 0 ? result : result2;
}

const sendKey = async (key, user_id, chat_id, key_version) => {
    const pub_key = await query('SELECT pub_key FROM "user" WHERE id = $1', [user_id]);
    if (pub_key.rowCount === 0) {
        return false;
    }
    const pubKey = crypto.createPublicKey({
        key: Buffer.from(pub_key.rows[0].pub_key, 'hex'),
        format: 'der',
        type: 'spki'
    });

    const encryptedKey = crypto.publicEncrypt(pubKey, key);
    const upload = await query('INSERT INTO keys (recipient_id, chat_id, key_version, key, pub_key) VALUES ($1, $2, $3, $4, $5) RETURNING key', [user_id, chat_id, key_version, buf2hex(encryptedKey), pub_key.rows[0].pub_key]);
    if (upload.rowCount === 0) {
        return false;
    }

    return upload;
};

const getUserFromDisplayName = async (displayName, user_no) => {
    const result = await query('SELECT * FROM "user" WHERE display_name = $1 AND user_no = $2', [displayName, user_no]);

    if (result.rowCount === 0) {
        return false;
    }

    return result;
};



export {
    checkIfUserExists,
    checkIfUsersAreFriends,
    sendKey,
    getUserFromDisplayName
}