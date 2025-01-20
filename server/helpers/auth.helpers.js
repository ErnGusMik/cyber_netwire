import crypto, { pbkdf2 } from "crypto";
import bcrypt from "bcrypt";

import query from "../db/db.connect.js";

const checkIfUserExists = async (email) => {
    const res = await query('SELECT * FROM "user" WHERE email = $1', [email]);
    if (res.rows.length > 0) return res.rows[0];
    return false;
};

const createKey = async (password) => {
    // Transform password to CryptoKey object
    password = await crypto.subtle.importKey(
        "raw",
        Buffer.from(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const salt = crypto.randomBytes(16);
    // Use the password to create a key using the PBKDF2 algorithm
    // to be used by the AES-GCM algorithm
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        password,
        {
            name: "AES-GCM",
            length: 256,
        },
        false,
        ["encrypt", "decrypt"]
    );
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

const createUser = async (user, password) => {
    // Get key from password
    const [key, saltPsswEncryption] = await createKey(password);

    // Encrypt user data
    const iv = crypto.randomBytes(16);

    const name = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new ArrayBuffer(user.name)
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

    console.log("NAME " + buf2hex(name));
    console.log("PRIV KEY " + buf2hex(await crypto.subtle.exportKey("pkcs8", rsa.privateKey)));
    console.log("PUB KEY " + buf2hex(public_key));
    console.log("IV " + typeof iv);

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

    console.log(values);

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
    const res = await query('SELECT password FROM "user" WHERE email = $1', [
        email,
    ]);
    if (res.rows.length === 0) {
        return false;
    }

    return await bcrypt.compare(password, res.rows[0].password);
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

export {
    checkIfUserExists,
    createUser,
    createCSRFToken,
    validateCSRFToken,
    validatePassword,
};
