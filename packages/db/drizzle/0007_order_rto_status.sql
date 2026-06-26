-- Add RTO statuses to order_status enum
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'rto_initiated';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'rto_delivered';
