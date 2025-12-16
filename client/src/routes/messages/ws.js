const openSocket = () => {
    const socket = new WebSocket(`ws://localhost:8080/ws/messages`, );

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
        } catch (err) {
            console.warn("Failed to parse WS message", err);
        }
    };
};

export default openSocket;
