import { Router } from "express";
import { StreamAPIController } from "../controllers/stream-api.controller";

const router = Router();
const controller = new StreamAPIController();

router.get("/live", controller.streamLive);
router.post("/emit", controller.emitEvent);

export default router;
