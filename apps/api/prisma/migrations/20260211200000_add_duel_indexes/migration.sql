-- CreateIndex
CREATE INDEX "duels_challenger_id_status_idx" ON "duels"("challenger_id", "status");

-- CreateIndex
CREATE INDEX "duels_opponent_id_status_idx" ON "duels"("opponent_id", "status");
