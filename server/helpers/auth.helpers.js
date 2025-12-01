import crypto, { pbkdf2 } from "crypto";
import bcrypt from "bcrypt";

import query, { pool } from "../db/db.connect.js";
import format from "pg-format";
import * as argon from "argon2";

const checkIfUserExists = async (email) => {
    const res = await query('SELECT * FROM "user" WHERE email = $1', [email]);
    if (res.rows.length > 0) return res.rows[0];
    return false;
};

const createKey = async (password) => {
    // // Transform password to CryptoKey object
    // password = await crypto.subtle.importKey(
    //     "raw",
    //     Buffer.from(password),
    //     "PBKDF2",
    //     false,
    //     ["deriveKey"]
    // );

    // const salt = crypto.randomBytes(16);
    // // Use the password to create a key using the PBKDF2 algorithm
    // // to be used by the AES-GCM algorithm
    // const key = await crypto.subtle.deriveKey(
    //     {
    //         name: "PBKDF2",
    //         salt: salt,
    //         iterations: 100000,
    //         hash: "SHA-256",
    //     },
    //     password,
    //     {
    //         name: "AES-GCM",
    //         length: 256,
    //     },
    //     false,
    //     ["encrypt", "decrypt"]
    // );
    // return [key, salt];

    const salt = crypto.randomBytes(16);
    const key = await argon.hash(password, {
        salt: salt,
        hashLength: 32,
        parallelism: 1,
        memoryCost: 65536,
        type: argon.argon2id,
        iterations: 3,
        raw: true,
    });

    return [key, salt];
};

const generateRSA = async () => {
    // Generate RSA key pair
    const { publicKey, privateKey } = await crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 4096,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );

    return { publicKey, privateKey };
};

function buf2hex(buffer) {
    // buffer is an ArrayBuffer
    return [...new Uint8Array(buffer)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
}

function arrayBufferToBase64Node(ab) {
    return Buffer.from(ab).toString("base64");
}
// Node: base64 -> ArrayBuffer
function base64ToArrayBufferNode(b64) {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
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

const createUser = async (user, password) => {
    // Get key from password
    const [rawKey, saltPsswEncryption] = await createKey(password);

    const key = await crypto.subtle.importKey(
        "raw",
        toBuffer(rawKey),
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );

    // Encrypt user data
    const iv = crypto.randomBytes(16);

    const name = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        Buffer.from(String(user.name), "utf8")
    );

    // Hash password (not related to encryption)
    const salt = await bcrypt.genSalt(10);
    const pssw = await bcrypt.hash(password, salt);

    // Generate RSA key pair
    const rsa = await generateRSA();

    const private_key = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        await crypto.subtle.exportKey("pkcs8", rsa.privateKey)
    );
    const public_key = await crypto.subtle.exportKey("spki", rsa.publicKey);
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
        buf2hex(name),
        user.email,
        user.displayName,
        pssw,
        buf2hex(public_key),
        buf2hex(private_key),
        user_no,
        iv.toString("hex"),
        saltPsswEncryption.toString("hex"),
    ];

    // console.log(values);
    // log raw key
    console.log("Raw key:", buf2hex(rawKey));

    // Store user in database
    const dbRes = await query(
        'INSERT INTO "user" (google_id, name, email, display_name, password, pub_key, priv_key, user_no, password_iv, salt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        values
    );

    if (dbRes.rows.length === 0) {
        console.error("Failed to create user");
        return;
    }

    return [
        dbRes.rows[0].id,
        buf2hex(private_key),
        iv.toString("hex"),
        saltPsswEncryption.toString("hex"),
    ];
};

const validatePassword = async (email, password) => {
    const res = await query('SELECT libsignal_verifier FROM "user" WHERE email = $1', [
        email,
    ]);
    if (res.rows.length === 0) {
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
        sameSite: "lax",
    });
    return csrfToken;
};

const uploadUserKeys = async (userId, keyBundle) => {
    const res = await query(
        "INSERT INTO user_keys (user_id, device_id, registration_id, identity_key, spk_id, spk_public_key, spk_signature, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0)) RETURNING *",
        [
            userId,
            keyBundle.deviceId || 1,
            keyBundle.registrationId,
            toBuffer(keyBundle.identityKey),
            keyBundle.signedPreKey.keyId,
            toBuffer(keyBundle.signedPreKey.publicKey),
            toBuffer(keyBundle.signedPreKey.signature),
            keyBundle.timestamp || Date.now(),
        ]
    );

    return res.rows[0];
};

const uploadOneTimePrekeys = async (userId, preKeys) => {
    if (!preKeys || !Array.isArray(preKeys) || preKeys.length === 0) return 0;

    // Use a client from the pool for transaction
    const client = await pool.connect(); // or import pool from db.connect.js if you exported it
    try {
        await client.query("BEGIN");

        const insertText =
            "INSERT INTO opk_keys (user_id, key_id, public_key) VALUES ($1, $2, $3)";
        let inserted = 0;

        for (const pk of preKeys) {
            const buf = toBuffer(pk.publicKey);
            await client.query(insertText, [userId, pk.keyId, buf]);
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

const uploadPrivateKeys = async (userId, identityKey, signedPreKey, idkIV, spkIV) => {
    const res = await query(
        "INSERT INTO priv_keys (user_id, identity_key, signed_prekey, idk_iv, spk_iv) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [userId, toBuffer(identityKey), toBuffer(signedPreKey), toBuffer(idkIV), toBuffer(spkIV)]
    );

    return res.rows[0];
};

const addLibsignalVerifier = async (userId, verifierKey) => {
    // hash verifierKey before storing (bcrypt)
    const hashedVerifierKey = await bcrypt.hash(verifierKey, 10);
    console.log("Hashed verifier key:", hashedVerifierKey);

    const res = await query(
        'UPDATE "user" SET libsignal_verifier = $1 WHERE id = $2 RETURNING *',
        [hashedVerifierKey, userId]
    );
    return res.rows[0];
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
    addLibsignalVerifier,
};
