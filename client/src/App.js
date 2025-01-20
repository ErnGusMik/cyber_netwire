import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./App.css";

import Auth from "./routes/auth/auth";
import Messages from "./routes/messages/messages";

function App() {
    const router = createBrowserRouter([
        {
            path: "/",
            element: <div>Hi!</div>,
        },
        {
            path: "/auth",
            element: <Auth />,
        },
        {
            path: "/app/msg/:chatID?",
            element: <Messages />
        }
    ]);

    return <RouterProvider router={router} />;
}

export default App;
