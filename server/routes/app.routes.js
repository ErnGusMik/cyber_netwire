import query from "../db/db.connect.js";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { validateCSRFToken } from "../helpers/auth.helpers.js";
import {
    getUserFromDisplayName,
    sendKey,
    checkIfUserExists,
    checkIfUsersAreFriends,
    fetchPrekeyBundle,
} from "../helpers/app.helpers.js";

import {
    checkIfUserExists as checkIfUserExistsByEmail
} from "../helpers/auth.helpers.js";

const changeStatus = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    if (
        req.body.status !== "online" &&
        req.body.status !== "idle" &&
        req.body.status !== "offline"
    ) {
        res.status(400).send({
            error: "Invalid status",
        });
        return;
    }

    // Change status
    const result = await query(
        'UPDATE "user" SET status = $1 WHERE email = $2 RETURNING status',
        [
            req.body.status == "online" ? 1 : req.body.status == "idle" ? 2 : 0,
            req.session.email,
        ]
    );

    // Check if query was successful
    if (result.rowCount === 0) {
        res.status(500).send({
            error: "Failed to update status",
        });
        return;
    }

    res.status(200).send({
        status: result.rows[0].status,
    });
};

const getStatus = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        console.log(req.session);
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Get status
    const result = await query(
        'SELECT status, display_name, user_no FROM "user" WHERE email = $1',
        [req.session.email]
    );

    // Check if query was successful
    if (result.rowCount === 0) {
        res.status(500).send({
            error: "Failed to get status",
        });
        return;
    }

    res.status(200).send({
        status: result.rows[0].status,
        display_name: result.rows[0].display_name,
        user_no: result.rows[0].user_no,
    });
};

const newChat = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Checks CSRF token
    const csrf = validateCSRFToken(req, res);
    if (!csrf) return;

    // Check for members
    if (!req.body.members || req.body.members.length === 0) {
        req.body.members = [];
    }

    // Check if other user exists
    for (let i = 0; i < req.body.members.length; i++) {
        const user = await checkIfUserExists(
            req.body.members[i].display_name,
            req.body.members[i].user_no
        );
        if (user.rowCount === 0) {
            res.status(400).send({
                error: "User does not exist",
            });
            return;
        }

        // Check if users are friends
        // const friends = await checkIfUsersAreFriends(
        //     req.session.userID,
        //     user.rows[0].id
        // );
        // if (friends === false) {
        //     res.status(400).send({
        //         error: "You are not friends with this user",
        //     });
        //     return;
        // }
    }
    let pssw = false;
    // Hash password
    if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        pssw = await bcrypt.hash(req.body.password, salt);
    }

    const creatorUser = await checkIfUserExistsByEmail(req.session.email);

    // Create chat
    const chat = await query(
        "INSERT INTO chats (chat_type, chat_name, disappearing, password, reports, description, discoverable) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id",
        [
            req.body.chat_type !== undefined || req.body.chat_type !== null
                ? req.body.chat_type
                : 1,
            req.body.chat_name
                ? req.body.chat_name
                : req.body.members.length == 1
                ? "DM-" +
                  req.body.members[0].display_name +
                  "_" +
                  req.body.members[0].user_no +
                  "-" +
                  creatorUser.display_name +
                  "_" +
                  creatorUser.user_no
                : "New Chat",
            req.body.disappearing ? req.body.disappearing : 0,
            pssw,
            0,
            req.body.description ? req.body.description : "",
            req.body.discoverable ? req.body.discoverable : false,
        ]
    );

    // Add creator to chat
    await query(
        "INSERT INTO chat_members (chat_id, user_id, joined_at, device_id) VALUES ($1, $2, $3, $4)",
        [chat.rows[0].id, req.session.userID, new Date().toUTCString(), req.session.deviceId]
    );

    // Create random key
    const key = crypto.randomBytes(32);

    // ! SIGNAL PROTOCOL VARIABLES
    let bundles;

    // Add & send key to all members
    for (let i = 0; i < req.body.members.length; i++) {
        const user = await getUserFromDisplayName(
            req.body.members[i].display_name,
            req.body.members[i].user_no
        );
        await query(
            "INSERT INTO chat_members (chat_id, user_id, joined_at, device_id) VALUES ($1, $2, $3, $4)",
            [chat.rows[0].id, user.rows[0].id, new Date().toUTCString(), user.rows[0].deviceId]
        );

        await sendKey(key, user.rows[0].id, chat.rows[0].id, 1);

        // ! SIGNAL PROTOCOL IMPLEMENTATION STARTS HERE
        // Initial key exchange (X3DH)
        // Fetch Prekey bundle
        // TODO NEXT: figure out storage -- where and what to store for multiple devices   
        const prekeyBundles = await fetchPrekeyBundle(user.rows[0].id);
        if (prekeyBundles.length === 0 || prekeyBundles === null) {
            res.status(500).send({
                error: "Failed to fetch Prekey Bundle for Signal Protocol",
            });
            return;
        }
        console.log("Prekey Bundle fetched for user ID:", user.rows[0].id);
        console.log(prekeyBundles);
        bundles.push({
            user_id: user.rows[0].id,
            bundles: prekeyBundles,
        })
        // ! SIGNAL PROTOCOL IMPLEMENTATION ENDS HERE
    }

    // Send key to creator
    await sendKey(key, req.session.userID, chat.rows[0].id, 1);

    // ! SIGNAL PROTOCOL IMPLEMENTATION STARTS HERE
    // DMs initial key exchange
    // Fetch Prekey bundle
    // const prekeyBundle = await fetchPrekeyBundle(req.session.userID, req.body.device_id);
    // if (prekeyBundle === null) {
    //     res.status(500).send({
    //         error: "Failed to fetch Prekey Bundle for Signal Protocol",
    //     });
    //     return;
    // }
    // console.log("Prekey Bundle fetched for user ID:", req.session.userID);
    // console.log(prekeyBundle);
    // ! SIGNAL PROTOCOL IMPLEMENTATION ENDS HERE

    res.status(201).send({
        chat_id: chat.rows[0].id,
        userId: req.session.userID,
        csrfToken: csrf,
        prekeyBundle: bundles,
    });
};

const getUserChats = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Get chats
    const feeds = await query(
        `SELECT
            c.chat_name,
            c.chat_type,
            c.id AS chat_id,
            COUNT(CASE WHEN mr.user_id IS NULL THEN 1 END) AS unread_count
        FROM
            chats c
        JOIN
            chat_members cm ON c.id = cm.chat_id
        LEFT JOIN
            messages m ON c.id = m.chat_id
        LEFT JOIN
            message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
        WHERE
            cm.user_id = $1 AND c.chat_type <> 0
        GROUP BY
            c.id, c.chat_name, c.chat_type
        ORDER BY
            c.chat_name;`,
        [req.session.userID]
    );

    const dms = await query(
        `SELECT
            c.chat_name,
            c.chat_type,
            c.id AS chat_id,
            COUNT(CASE WHEN mr.user_id IS NULL THEN 1 END) AS unread_count,
            ou.status AS other_user_status,
            ou.display_name AS other_user_name
        FROM
            chats c
        JOIN
            chat_members cm1 ON c.id = cm1.chat_id -- Alias for the current user's chat_members entry
        JOIN
            chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id <> $1 -- Join to find the other user
        LEFT JOIN
            messages m ON c.id = m.chat_id
        LEFT JOIN
            message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
        JOIN
            "user" ou ON cm2.user_id = ou.id
        WHERE
            cm1.user_id = $1 AND c.chat_type = 0
        GROUP BY
            c.id, c.chat_name, c.chat_type, ou.status, ou.display_name
        ORDER BY
            c.chat_name;`,
        [req.session.userID]
    );

    res.status(200).send({
        chats: [...feeds.rows, ...dms.rows],
    });
};

const getUserFriends = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Get friends
    const friends = await query(
        `SELECT
            u.display_name,
            u.status
        FROM
            "user" u
        JOIN
            friends f ON (u.id = f.friend_id)
        WHERE
            f.user_id = $1; `,
        [req.session.userID]
    );

    res.status(200).send({
        friends: friends.rows,
    });
};

const getUserPublicKeyHash = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    const result = await query('SELECT pub_key FROM "user" WHERE id = $1', [
        req.session.userID,
    ]);

    if (result.rowCount === 0) {
        res.status(500).send({
            error: "Failed to get public key",
        });
        return;
    }

    res.status(200).send({
        public_key: crypto
            .createHash("sha1")
            .update(result.rows[0].pub_key)
            .digest("hex"),
    });
};

const getChatMessages = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Get chat messages
    const messages = await query(
        `SELECT
            m.id,
            m.content,
            m.timestamp,
            u.display_name,
            u.user_no
        FROM
            messages m
        JOIN
            "user" u ON m.sender_id = u.id
        WHERE
            m.chat_id = $1
        ORDER BY
            m.timestamp
        LIMIT $2;`,
        [req.params.chat_id, req.params.limit]
    );

    res.status(200).send({
        messages: messages.rows,
    });
};

const getChatKey = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }
    let key;
    console.log(req.params.version);
    console.log(req.params.chat_id);
    console.log(req.session.userID);
    if (req.params.version == "latest") {
        key = await query(
            `SELECT
                key,
                key_version,
                expires_at
            FROM
                keys
            WHERE
                chat_id = $1
            AND
                recipient_id = $2
            ORDER BY
                key_version DESC
            LIMIT 1;`,
            [req.params.chat_id, req.session.userID]
        );
    } else {
        key = await query(
            `SELECT
                key,
                key_version,
                expires_at
            FROM
                keys
            WHERE
                chat_id = $1
            AND
                recipient_id = $2
            AND
                key_version = $3;`,
            [req.params.chat_id, req.session.userID, req.params.version]
        );
    }

    if (key.rowCount === 0) {
        res.status(404).send({
            error: "Key not found",
        });
        return;
    }

    res.status(200).send({
        key: key.rows[0].key,
        key_version: key.rows[0].key_version,
        expires_at: key.rows[0].expires_at,
    });
};

const postMessage = async (req, res, next) => {
    // Check if user is logged in
    if (!req.session.email || req.session.loggedIn !== true) {
        res.status(401).send({
            error: "Invalid session. Have you logged in?",
        });
        return;
    }

    // Checks CSRF token
    const csrf = validateCSRFToken(req, res);
    if (!csrf) return;

    // Check if chat exists
    const chat = await query("SELECT id FROM chats WHERE id = $1", [
        req.params.chat_id,
    ]);

    if (chat.rowCount === 0) {
        res.status(400).send({
            error: "Chat does not exist",
        });
        return;
    }

    // Check if user is in chat
    const member = await query(
        "SELECT id FROM chat_members WHERE chat_id = $1 AND user_id = $2",
        [req.params.chat_id, req.session.userID]
    );

    if (member.rowCount === 0) {
        res.status(400).send({
            error: "You are not in this chat",
        });
        return;
    }

    // Post message
    await query(
        "INSERT INTO messages (chat_id, sender_id, content, timestamp) VALUES ($1, $2, $3, $4)",
        [
            req.params.chat_id,
            req.session.userID,
            req.body.content,
            new Date().toUTCString(),
        ]
    );

    res.status(201).send({
        csrfToken: csrf,
    });
};

export {
    changeStatus,
    getStatus,
    newChat,
    getUserChats,
    getUserFriends,
    getUserPublicKeyHash,
    getChatMessages,
    postMessage,
    getChatKey,
};
