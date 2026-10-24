import { Router } from "express";
import {
  requestRefundController,
  requestMyRefundController,
  listMyRefundsController,
  approveRefundController,
  rejectRefundController,
  reconcileRefundController,
  refundCancelledEventController,
  listOrgRefundsController,
  listAllRefundsController,
} from "./Refund.controller";
import { adminAuth, adminOrOrganizerAuth, anyAuthenticatedUser } from "../../../middleware/bearAuth";
import { enforceOrgParam } from "../../../middleware/Orgaccess";

const refundRouter = Router();

// Mount in app.ts:  app.use("/api/refunds", refundRouter);

refundRouter.get("/", adminAuth, listAllRefundsController);
refundRouter.get("/org/:orgId", adminOrOrganizerAuth, enforceOrgParam, listOrgRefundsController);

// Customer: ask for a refund on their OWN payment (always created as Pending)
refundRouter.get("/mine", anyAuthenticatedUser, listMyRefundsController);
refundRouter.post("/mine", anyAuthenticatedUser, requestMyRefundController);

refundRouter.post("/", adminOrOrganizerAuth, requestRefundController);
refundRouter.post("/:refundId/approve", adminOrOrganizerAuth, approveRefundController);
refundRouter.post("/:refundId/reject", adminOrOrganizerAuth, rejectRefundController);
refundRouter.post("/:refundId/reconcile", adminAuth, reconcileRefundController);

refundRouter.post("/event/:eventId/refund-all", adminOrOrganizerAuth, refundCancelledEventController);

export default refundRouter;