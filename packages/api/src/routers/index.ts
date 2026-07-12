import { router } from "../trpc";
import { adminAuthRouter } from "./admin-auth.router";
import { cartRouter } from "./cart.router";
import { orderRouter } from "./order.router";
import { paymentRouter } from "./payment.router";
import { catalogRouter } from "./catalog.router";
import { couponRouter } from "./coupon.router";
import { discountRouter } from "./discount.router";
import { healthRouter } from "./health.router";
import { inventoryRouter } from "./inventory.router";
import { storageRouter } from "./storage.router";
import { userDataRouter } from "./user-data.router";
import { userRouter } from "./user.router";
import { ticketRouter } from "./ticket.router";
import { adminUserRouter } from "./admin-user.router";
import { analyticsRouter } from "./analytics.router";
import { settingsRouter } from "./settings.router";
import { contentRouter } from "./content.router";
import { jobRouter } from "./job.router";
import { ratingRouter } from "./rating.router";

export const appRouter = router({
  analytics: analyticsRouter,
  health: healthRouter,
  user: userRouter,
  adminAuth: adminAuthRouter,
  adminUser: adminUserRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  order: orderRouter,
  payment: paymentRouter,
  inventory: inventoryRouter,
  storage: storageRouter,
  discount: discountRouter,
  coupon: couponRouter,
  userData: userDataRouter,
  ticket: ticketRouter,
  settings: settingsRouter,
  content: contentRouter,
  job: jobRouter,
  rating: ratingRouter,
});

export type AppRouter = typeof appRouter;
