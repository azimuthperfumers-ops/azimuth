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

export const appRouter = router({
  health: healthRouter,
  user: userRouter,
  adminAuth: adminAuthRouter,
  catalog: catalogRouter,
  cart: cartRouter,
  order: orderRouter,
  payment: paymentRouter,
  inventory: inventoryRouter,
  storage: storageRouter,
  discount: discountRouter,
  coupon: couponRouter,
  userData: userDataRouter,
});

export type AppRouter = typeof appRouter;
