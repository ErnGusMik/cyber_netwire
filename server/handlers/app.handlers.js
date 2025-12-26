import { Router } from "express";

import * as app from "../routes/app.routes.js";

const router = Router();

// eg. router.get("/csrf-token", app.generateCSRFToken);

router.put("/status", app.changeStatus);
router.get("/status", app.getStatus);
router.post("/chat/new", app.newChat);
router.get("/chat/all", app.getUserChats);
router.get("/friends/all", app.getUserFriends);
router.get("/public-key", app.getUserPublicKeyHash);
router.get("/chat/:chat_id/messages/:limit", app.getChatMessages);
router.get("/chat/:chat_id/key/:version", app.getChatKey);
router.post("/chat/:chat_id/post", app.postMessage);
router.get("/chat/:chat_id/devices", app.getChatDevices);
router.get("/session/:userId/:deviceId", app.getSessionData);

export default router;