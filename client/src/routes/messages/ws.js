const openSocket = (receiveMessage) => {
    const socket = new WebSocket(`ws://${window.location.hostname}:8080/ws/messages`, "json");
    
    socket.onopen = () => {
        console.log("WebSocket connection established");
    };

    socket.onmessage = (event) => {
        try {
            const data =
                typeof event.data === "string"
                    ? JSON.parse(event.data)
                    : event.data;
            console.log("Received WS message:", data);
            if (data.type === "new_message") {
                console.log("=== WS MESSAGE PARSING ===");
                console.log("sender_id raw:", data.sender_id);
                console.log("sender_id split:", data.sender_id.split(":"));
                console.log("Parsed userId:", parseInt(data.sender_id.split(":")[0]));
                console.log("Parsed deviceId:", parseInt(data.sender_id.split(":")[1]));
                console.log("Ciphertext:", data.ciphertext);
                receiveMessage(data.ciphertext, data.chat_id, parseInt(data.sender_id.split(":")[0]), parseInt(data.sender_id.split(":")[1]));
            }
        } catch (err) {
            console.warn("Failed to parse WS message", err);
        }
    };
};

export default openSocket;
