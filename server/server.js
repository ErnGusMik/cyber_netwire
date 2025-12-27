import "dotenv/config";
import session from "express-session";
import { pool } from "./db/db.connect.js";
import cookieParser from "cookie-parser";
import connectPgSimple from "connect-pg-simple";

import { WebSocketServer } from "ws";
import http from "http";

// Attach websocket handlers after creating wss (avoid circular imports)
import { attachWss } from "./routes/messages.ws.js";

import express from "express";
const app = express();
const FALLBACK_PORT = 8080;

// For POST routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allows cookie use
app.use(cookieParser());

// Session setup - create a reusable session parser for HTTP and WebSocket upgrades
const sessionParser = session({
    secret:
        process.env.SESSION_SECRET ||
        "this-is-my-dev-secret-which-should-probably-be-changed",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        domain:
            process.env.NODE_ENV === "production"
                ? ".ernestsgm.com"
                : undefined,
        partitioned: process.env.NODE_ENV === "production",
    },
    store: new (connectPgSimple(session))({ pool: pool }),
});

app.use(sessionParser);

// CORS
app.use((req, res, next) => {
    // In production, this is not needed, because CORS is set by the Apache server
    const allowedOrigins = [
        "https://ernestsgm.com",
        "http://ernestsgm.com",
        "https://www.ernestsgm.com",
        "http://localhost:3000",
    ];

    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    res.set(
        "Access-Control-Allow-Headers",
        "Content-Type, X-CSRF-Token, Accept, Authorization"
    );
    res.set("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

// Routes
import router from "./handlers/auth.handlers.js";
app.use("/auth", router);

import appRouter from "./handlers/app.handlers.js";
app.use("/api", appRouter);

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Allowed origins for upgrades (comma-separated env var)
const allowedOrigins = (
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:3000,https://ernestsgm.com,https://www.ernestsgm.com"
).split(",");

server.on("upgrade", (req, socket, head) => {
    const origin = req.headers.origin;

    // Only accept upgrades for the messages websocket path
    // If your client connects to a different path, it will never trigger this handler
    if (!req.url || !req.url.startsWith("/ws/messages")) {
        console.warn("WS upgrade rejected: unexpected path", { url: req.url });
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
    }
    if (origin && !allowedOrigins.includes(origin)) {
        console.warn("WS upgrade rejected: origin not allowed", { origin });
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
    }

    // Parse session using the same parser used by Express
    sessionParser(req, {}, () => {
        if (!req.session || !req.session.userID) {
            console.warn("WS upgrade rejected: no valid session on request", {
                cookie: req.headers.cookie,
                session: req.session,
            });
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            // Attach session information to the ws for later use
            ws.session = req.session;
            ws.userID = req.session.userID;
            ws.deviceID = req.session.deviceId;
            ws.isAlive = true;
            wss.emit("connection", ws, req);
        });
    });
});

// Register ws handlers for messages
attachWss(wss);

// Heartbeat to detect dead connections
const HEARTBEAT_INTERVAL = 30_000; // 30s
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        try {
            ws.ping();
        } catch (e) {
            // ignore ping errors
        }
    });
}, HEARTBEAT_INTERVAL);

export default wss;

app.get("/", (req, res) => {
    res.json({
        status: "ok",
        timestamp: Date.now(),
    });
});

server.listen(process.env.PORT || FALLBACK_PORT, () => {
    console.log(
        `Server is running on port ${process.env.PORT || FALLBACK_PORT}`
    );
});
