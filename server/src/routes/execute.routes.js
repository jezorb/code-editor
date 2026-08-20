import express from "express";

import { executeCode } from "../controllers/execute.controller.js";

const router = express.Router();

router.post("/execute", executeCode);

export default router;