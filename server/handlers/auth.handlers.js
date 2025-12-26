import { Router } from "express";

import * as auth from "../routes/auth.routes.js";

const router = Router();

router.get("/csrf-token", auth.generateCSRFToken);
router.post("/google", auth.auth);
router.post("/verify", auth.verifyPassword);
router.post("/upload-prekeys", auth.uploadPreKeys);
router.post("/upload-privkeys", auth.uploadPrivKeys);
router.post("/register-device", auth.registerNewDevice);

export default router;