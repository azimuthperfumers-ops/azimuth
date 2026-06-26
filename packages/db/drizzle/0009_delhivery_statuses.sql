ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'picked_up';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'delivery_attempted';
