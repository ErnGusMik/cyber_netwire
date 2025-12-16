// Track active connections keyed by `${userId}:${deviceId}`
const activeConnections = new Map();

// Attach a WebSocketServer instance to register handlers. This avoids importing
// the server module at module-eval time and prevents circular imports.
function attachWss(wss) {
    if (!wss || typeof wss.on !== 'function') throw new Error('attachWss requires a WebSocketServer');

    wss.on('connection', (ws, req) => {
        const userId = req.session?.userId;
        const deviceId = req.session?.deviceId;
        if (!userId || !deviceId) {
            ws.close(1008, 'Unauthorized');
            return;
        }

        const key = `${userId}:${deviceId}`;
        // store key on ws so other parts (or cleanup routines) can find it
        ws.connectionKey = key;
        activeConnections.set(key, ws);

        ws.isAlive = true;
        ws.on('pong', () => (ws.isAlive = true));

        console.log(`WebSocket connection established for messages: ${key}`);

        ws.on('message', (message) => {
            // Basic safety checks
            if (typeof message === 'string' && message.length > 10000) {
                ws.close(1009, 'Message too large');
                return;
            }

            try {
                const data = typeof message === 'string' ? JSON.parse(message) : message;
                // TODO: validate and handle incoming data (type, sender, etc.)
                console.log('Received message:', data);
            } catch (err) {
                console.warn('Failed to parse ws message', err);
            }
        });

        ws.on('close', () => {
            activeConnections.delete(key);
            console.log(`WebSocket connection closed for messages: ${key}`);
        });

        ws.on('error', (err) => {
            console.error('WebSocket error for', key, err);
            ws.terminate();
        });
    });
}

// Send a payload to a specific device belonging to a user
function sendToDevice(userId, deviceId, payload) {
    const key = `${userId}:${deviceId}`;
    const conn = activeConnections.get(key);
    if (!conn) return false;
    if (conn.readyState !== 1) {
        // not OPEN
        return false;
    }
    try {
        const data =
            typeof payload === "string" ? payload : JSON.stringify(payload);
        conn.send(data);
        return true;
    } catch (e) {
        console.error("sendToDevice failed", key, e);
        return false;
    }
}

// Broadcast a payload to all connected devices on this server instance
function broadcastToServer(payload) {
    const data =
        typeof payload === "string" ? payload : JSON.stringify(payload);
    let sent = 0;
    for (const [key, conn] of activeConnections.entries()) {
        try {
            if (conn && conn.readyState === 1) {
                conn.send(data);
                sent++;
            }
        } catch (e) {
            console.warn("broadcastToServer error for", key, e);
        }
    }
    return sent;
}

export { sendToDevice, broadcastToServer, activeConnections, attachWss };
