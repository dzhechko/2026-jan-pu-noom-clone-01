-- AlterTable: add subscription fields to users
ALTER TABLE "users" ADD COLUMN "has_used_trial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "subscription_cancelled_at" TIMESTAMPTZ;

-- CreateTable: subscription_logs
CREATE TABLE "subscription_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "amount" INTEGER,
    "currency" TEXT DEFAULT 'XTR',
    "telegram_payment_charge_id" TEXT,
    "provider_payment_charge_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique on telegram_payment_charge_id (replay protection)
CREATE UNIQUE INDEX "subscription_logs_telegram_payment_charge_id_key" ON "subscription_logs"("telegram_payment_charge_id");

-- CreateIndex: user + created_at
CREATE INDEX "subscription_logs_user_id_created_at_idx" ON "subscription_logs"("user_id", "created_at");

-- CreateIndex: event + created_at
CREATE INDEX "subscription_logs_event_created_at_idx" ON "subscription_logs"("event", "created_at");

-- AddForeignKey
ALTER TABLE "subscription_logs" ADD CONSTRAINT "subscription_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
