import { Router } from "express";

import * as auth from "../routes/auth.routes.js";

const router = Router();

router.get("/csrf-token", auth.generateCSRFToken);
router.post("/google", auth.auth);
router.post("/verify", auth.verifyPassword);

export default router;