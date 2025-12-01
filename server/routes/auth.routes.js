import { OAuth2Client } from "google-auth-library";
import {
    addLibsignalVerifier,
    checkIfUserExists,
    createCSRFToken,
    createUser,
    uploadOneTimePrekeys,
    uploadPrivateKeys,
    uploadUserKeys,
    validateCSRFToken,
    validatePassword,
} from "../helpers/auth.helpers.js";
import bcrypt from "bcrypt";

// Create a new CSRF token
const generateCSRFToken = (req, res) => {
    const token = createCSRFToken(req, res);
    res.cookie("csrf-token", token, {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });
    res.status(200).send({
        "x-csrf-token": token,
    });
};

const auth = async (req, res) => {
    const csrfToken = validateCSRFToken(req, res);
    if (!csrfToken) return;

    // Google Sign-In validation
    const client = new OAuth2Client();
    const user = {};
    try {
        const ticket = await client.verifyIdToken({
            idToken: req.body.idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        user.email = payload.email;
        user.userID = payload.sub;
        user.name = payload.given_name + " " + payload.family_name;
        user.displayName = payload.name;
    } catch (err) {
        console.error(err);
        res.set("WWW-Authenticate", "Google Sign-In failed");
        res.status(401).send({
            error: "Google Sign-In failed",
            csrfToken: csrfToken,
        });
        return;
    }

    console.log("User:", user);
    // Create session and ensure it's saved before responding
    try {
        await new Promise((resolve, reject) => {
            req.session.regenerate((err) => {
                if (err) return reject(err);
                req.session.googleID = user.userID;
                req.session.email = user.email;
                req.session.displayName = user.displayName;
                req.session.name = user.name;
                req.session.loggedIn = false;
                req.session.save((errSave) => {
                    if (errSave) return reject(errSave);
                    resolve();
                });
            });
        });
    } catch (err) {
        console.error("Session regenerate/save failed", err);
        res.status(500).send({ error: "Session error", csrfToken: csrfToken });
        return;
    }

    // Check if user exists
    const dbUser = await checkIfUserExists(user.email);
    if (!dbUser) {
        res.status(200).send({
            newUser: true,
            csrfToken: csrfToken,
            name: user.displayName,
        });
        return;
    }

    res.status(200).send({
        newUser: false,
        csrfToken: csrfToken,
        name: user.displayName,
        salt: dbUser.salt,
        passwordIV: dbUser.password_iv,
    });
};

const verifyPassword = async (req, res) => {
    const csrfToken = validateCSRFToken(req, res);
    if (!csrfToken) return;

    if (!req.session.email || req.session.loggedIn !== false) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
            csrfToken: csrfToken,
        });
        return;
    }

    const user = await checkIfUserExists(req.session.email);
    let id, priv_key, pssw_iv, salt;
    if (!user) {
        // Check required fields for signal protocol
        if (
            !req.body.keyBundle ||
            !req.body.keyBundle.registrationId ||
            !req.body.keyBundle.identityKey ||
            !req.body.keyBundle.signedPreKey
        ) {
            res.status(400).send({
                error: "Missing key bundle for new user",
                csrfToken: csrfToken,
            });
            return;
        }

        const created = await createUser(req.session, req.body.password);
        if (!created[0]) {
            res.status(500).send({
                error: "Failed to create user",
                csrfToken: csrfToken,
            });
            return;
        }
        id = created[0];
        priv_key = created[1];
        pssw_iv = created[2];
        salt = created[3];

        // Upload key bundle (signal protocol)
        const uploadRes = await uploadUserKeys(id, req.body.keyBundle);
        if (!uploadRes) {
            res.status(500).send({
                error: "Failed to upload user keys. Try again.",
                csrfToken: csrfToken,
            });
            return;
        }
    } else {
        const allowed = await validatePassword(
            req.session.email,
            req.body.password,
        );
        if (!allowed) {
            res.status(401).send({
                error: "Invalid password",
                csrfToken: csrfToken,
            });
            return;
        }
    }

    req.session.loggedIn = true;
    req.session.userID = user ? user.id : id;
    req.session.save();

    res.status(200).send({
        csrfToken: csrfToken,
        userID: id,
        userCreated: !user,
        privKey: user ? user.priv_key : priv_key,
        psswIV: user ? user.password_iv : pssw_iv,
        salt: user ? user.salt : salt,
    });
};

const uploadPreKeys = async (req, res) => {
    const csrfToken = validateCSRFToken(req, res);
    if (!csrfToken) return;

    if (
        !req.body.prekeys ||
        !Array.isArray(req.body.prekeys) ||
        req.body.prekeys.length === 0
    ) {
        res.status(400).send({
            error: "Invalid prekeys format.",
            csrfToken: csrfToken,
        });
        return;
    }


    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
            csrfToken: csrfToken,
        });
        return;
    }

    const user = await checkIfUserExists(req.session.email);
    if (!user) {
        res.status(401).send({
            error: "User does not exist.",
            csrfToken: csrfToken,
        });
        return;
    }

    const uploaded = await uploadOneTimePrekeys(user.id, req.body.prekeys);
    if (!uploaded) {
        res.status(500).send({
            error: "Failed to upload one-time prekeys. Try again.",
            csrfToken: csrfToken,
        });
        return;
    }

    res.status(200).send({
        uploadedCount: uploaded,
        csrfToken: csrfToken,
    });
};

const uploadPrivKeys = async (req, res) => {
    const csrfToken = validateCSRFToken(req, res);
    if (!csrfToken) return;

    if (
        !req.body.identityKey ||
        !req.body.signedPreKey ||
        !req.body.idkIV ||
        !req.body.spkIV ||
        !req.body.verifierKey
    ) {
        res.status(400).send({
            error: "Invalid private keys format.",
            csrfToken: csrfToken,
        });
        return;
    }

    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
            csrfToken: csrfToken,
        });
        return;
    }

    const user = await checkIfUserExists(req.session.email);
    if (!user) {
        res.status(401).send({
            error: "User does not exist.",
            csrfToken: csrfToken,
        });
        return;
    }

    const uploaded = await uploadPrivateKeys(
        user.id,
        req.body.identityKey,
        req.body.signedPreKey,
        req.body.idkIV,
        req.body.spkIV
    );
    if (!uploaded) {
        res.status(500).send({
            error: "Failed to upload private keys. Try again.",
            csrfToken: csrfToken,
        });
        return;
    }

    const addedVerifier = await addLibsignalVerifier(user.id, req.body.verifierKey);
    
    if (!addedVerifier) {
        res.status(500).send({
            error: "Failed to add verifier key. Try again.",
            csrfToken: csrfToken,
        });
        return;
    }

    res.status(200).send({
        success: true,
        csrfToken: csrfToken,
    });
};

export {
    generateCSRFToken,
    auth,
    verifyPassword,
    uploadPreKeys,
    uploadPrivKeys,
};
