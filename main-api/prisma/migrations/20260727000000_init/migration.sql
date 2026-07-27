-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "contratacoes" (
    "id" TEXT NOT NULL,
    "nome_cliente" VARCHAR(120) NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "produto" VARCHAR(80) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratacoes_status_criado_em_idx" ON "contratacoes"("status", "criado_em");
