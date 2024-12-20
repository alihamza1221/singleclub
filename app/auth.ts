import { Router } from "express";

import { issueToken } from "../auth/create-access-token.js";
const router = Router();

router.post("/issue-token", issueToken);

export default router;
