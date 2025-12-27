import crypto, { pbkdf2 } from "crypto";
import bcrypt from "bcrypt";

import query, { pool } from "../db/db.connect.js";

const checkIfUserExists = async (email) => {
    const res = await query('SELECT * FROM "user" WHERE email = $1', [email]);
    if (res.rows.length > 0) return res.rows[0];
    return false;
};

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

const createUser = async (user, password, salt) => {
    // Hash password verifier
    const hashedVerifierKey = await bcrypt.hash(password, 10);

    // Check for user number with according display name
    const res = await query(
        'SELECT user_no FROM "user" WHERE display_name = $1',
        [user.displayName]
    );
    let user_no = Math.floor(Math.random() * 1000);
    while (res.rows.includes("user_no")) {
        user_no = Math.floor(Math.random() * 1000);
    }

    const values = [
        user.googleID,
        user.name,
        user.email,
        user.displayName,
        user_no,
        salt,
        hashedVerifierKey,
    ];


    // Store user in database
    const dbRes = await query(
        'INSERT INTO "user" (google_id, name, email, display_name, user_no, salt, libsignal_verifier) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        values
    );

    if (dbRes.rows.length === 0) {
        console.error("Failed to create user");
        return;
    }

    console.log("CREATED USER VERIFIER:", password);
    return [dbRes.rows[0].id, salt];
};

const validatePassword = async (email, password) => {
    const res = await query(
        'SELECT libsignal_verifier FROM "user" WHERE email = $1',
        [email]
    );
    if (res.rows.length === 0) {
        console.log("No user found for email:", email);
        return false;
    }
    const existingHash = res.rows[0].libsignal_verifier;

    return await bcrypt.compare(password, existingHash);
};

const createCSRFToken = (req, res) => {
    const message = `${req.sessionID}!${crypto
        .randomBytes(32)
        .toString("hex")}`;
    const hmac = crypto
        .createHmac("sha256", process.env.CSRF_SECRET)
        .update(message)
        .digest("hex");

    return `${hmac}.${message}`;
};

const validateCSRFToken = (req, res) => {
    if (!req.headers["x-csrf-token"] || !req.cookies["csrf-token"]) {
        res.status(400).send({
            error: "CSRF-Token required",
            cookies: req.cookies["csrf-token"] ? "true" : "false",
            headers: req.headers["x-csrf-token"] ? "true" : "false",
        });
        return false;
    }

    const parts = req.headers["x-csrf-token"].split(".");

    if (parts.length !== 2) {
        res.status(400).send({
            error: "Invalid CSRF-Token",
        });
        return false;
    }

    const expectedToken = crypto
        .createHmac("sha256", process.env.CSRF_SECRET)
        .update(parts[1])
        .digest("hex");

    const isEq = crypto.timingSafeEqual(
        Buffer.from(parts[0]),
        Buffer.from(expectedToken)
    );

    const isEq2 = crypto.timingSafeEqual(
        Buffer.from(req.cookies["csrf-token"]),
        Buffer.from(req.headers["x-csrf-token"])
    );

    if (!isEq || !isEq2) {
        res.status(403).send({
            error: "Invalid CSRF-Token",
        });
        return false;
    }

    // Create new CSRF token
    const csrfToken = createCSRFToken(req, res);
    res.cookie("csrf-token", csrfToken, {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        domain: process.env.NODE_ENV === "production" ? ".ernestsgm.com" : undefined,
    });
    return csrfToken;
};

const uploadUserKeys = async (userId, keyBundle) => {
    const res = await query(
        "INSERT INTO user_keys (user_id, registration_id, identity_key, created_at) VALUES ($1, $2, $3, to_timestamp($4 / 1000.0)) RETURNING *",
        [
            userId,
            keyBundle.registrationId,
            toBuffer(keyBundle.identityKey),
            keyBundle.timestamp || Date.now(),
        ]
    );

    return res.rows[0];
};

const uploadOneTimePrekeys = async (userId, preKeys, deviceId) => {
    if (!preKeys || !Array.isArray(preKeys) || preKeys.length === 0) return 0;

    // Use a client from the pool for transaction
    const client = await pool.connect(); // or import pool from db.connect.js if you exported it
    try {
        await client.query("BEGIN");

        const insertText =
            "INSERT INTO opk_keys (user_id, key_id, public_key, priv_key, key_iv, device_id) VALUES ($1, $2, $3, $4, $5, $6)";
        let inserted = 0;

        for (const pk of preKeys) {
            const bufPub = toBuffer(pk.publicKey);
            await client.query(insertText, [
                userId,
                pk.keyId,
                bufPub,
                toBuffer(pk.privKey),
                toBuffer(pk.iv),
                deviceId,
            ]);
            inserted++;
        }

        await client.query("COMMIT");
        return inserted;
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        console.error("uploadOneTimePrekeys failed", err);
        throw err; // or return 0 depending on your error strategy
    } finally {
        client.release();
    }
};

const uploadPrivateKeys = async (userId, identityKey, idkIV) => {
    const res = await query(
        "INSERT INTO priv_keys (user_id, identity_key, idk_iv) VALUES ($1, $2, $3) RETURNING *",
        [userId, toBuffer(identityKey), toBuffer(idkIV)]
    );

    return res.rows[0];
};

const loadPrivateKeys = async (userId) => {
    const res = await query("SELECT * FROM priv_keys WHERE user_id = $1", [
        userId,
    ]);
    if (res.rows.length === 0) {
        return null;
    }
    const keys = {
        identity_key: arrayBufferToBase64Node(res.rows[0].identity_key),
        idk_iv: arrayBufferToBase64Node(res.rows[0].idk_iv),
    };
    return keys;
};

const fetchAllOPKs = async (userId) => {
    const res = await query(
        "SELECT key_id, public_key, priv_key, key_iv FROM opk_keys WHERE user_id = $1 AND is_used = false",
        [userId]
    );
    return res.rows.map((row) => ({
        keyId: row.key_id,
        publicKey: arrayBufferToBase64Node(row.public_key),
        privKey: arrayBufferToBase64Node(row.priv_key),
        iv: arrayBufferToBase64Node(row.key_iv),
    }));
};

const registerDevice = async (
    userId,
    spkId,
    spkPubKey,
    spkSignature,
    identityKey
) => {
    const res = await query(
        "INSERT INTO device_keys (user_id, spk_id, spk_public_key, spk_signature, identity_key, last_seen) VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0)) RETURNING device_id",
        [
            userId,
            spkId,
            toBuffer(spkPubKey),
            toBuffer(spkSignature),
            toBuffer(identityKey),
            Date.now(),
        ]
    );
    return res.rows[0].device_id;
};

const fetchRegistrationBundle = async (userId) => {
    const bundleRes = await query(
        "SELECT * FROM user_keys WHERE user_id = $1",
        [userId]
    );
    if (bundleRes.rows.length === 0) {
        return null;
    }
    const bundle = {
        registrationId: bundleRes.rows[0].registration_id,
        deviceId: bundleRes.rows[0].device_id,
        identityKey: arrayBufferToBase64Node(bundleRes.rows[0].identity_key), // ArrayBuffer
    };

    return bundle;
};

export {
    checkIfUserExists,
    createUser,
    createCSRFToken,
    validateCSRFToken,
    validatePassword,
    uploadUserKeys,
    uploadOneTimePrekeys,
    uploadPrivateKeys,
    loadPrivateKeys,
    fetchAllOPKs,
    registerDevice,
    fetchRegistrationBundle,
};
