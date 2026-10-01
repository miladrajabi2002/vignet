-- Optional service price (Toman) so the agent can quote it. Additive and
-- nullable: existing services stay unpriced and the agent keeps not quoting.
ALTER TABLE "Service" ADD COLUMN "price" DOUBLE PRECISION;
