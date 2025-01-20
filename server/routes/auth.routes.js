import { OAuth2Client } from "google-auth-library";
import {
    checkIfUserExists,
    createCSRFToken,
    createUser,
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

    // Create session
    req.session.regenerate(() => {
        req.session.googleID = user.userID;
        req.session.email = user.email;
        req.session.displayName = user.displayName;
        req.session.name = user.name;
        req.session.loggedIn = false;
        req.session.save();
    });

    // Check if user exists
    if (!(await checkIfUserExists(user.email))) {
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
    console.log(user);
    let id, priv_key, pssw_iv, salt;
    if (!user) {
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
    } else {
        const allowed = await validatePassword(req.session.email, req.body.password);
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

export { generateCSRFToken, auth, verifyPassword };
