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
                receiveMessage(data.ciphertext, data.chat_id, parseInt(data.sender_id.split(":")[0]), parseInt(data.sender_id.split(":")[1]));
            }
        } catch (err) {
            console.warn("Failed to parse WS message", err);
        }
    };
};

export default openSocket;
