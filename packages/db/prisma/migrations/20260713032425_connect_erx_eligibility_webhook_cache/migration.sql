-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "stripeConnectAccountId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "applicationFeeCents" INTEGER,
ADD COLUMN     "destinationAccountId" TEXT,
ADD COLUMN     "marketingFeeCents" INTEGER;

-- CreateTable
CREATE TABLE "ProviderSubscription" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL DEFAULT 'provider_saas_monthly',
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "vendor" TEXT NOT NULL,
    "vendorRxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "medicationName" TEXT NOT NULL,
    "directions" TEXT,
    "isControlled" BOOLEAN NOT NULL DEFAULT false,
    "pharmacyName" TEXT,
    "pharmacyNcpdpId" TEXT,
    "epcsVerifiedAt" TIMESTAMP(3),
    "routedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityCheck" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insurancePolicyId" TEXT,
    "vendor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payerName" TEXT,
    "copayCents" INTEGER,
    "coverage" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSubscription_providerId_key" ON "ProviderSubscription"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderSubscription_stripeSubscriptionId_key" ON "ProviderSubscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "ProviderSubscription_status_idx" ON "ProviderSubscription"("status");

-- CreateIndex
CREATE INDEX "Prescription_patientId_createdAt_idx" ON "Prescription"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_providerId_status_idx" ON "Prescription"("providerId", "status");

-- CreateIndex
CREATE INDEX "EligibilityCheck_patientId_checkedAt_idx" ON "EligibilityCheck"("patientId", "checkedAt");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_source_processedAt_idx" ON "ProcessedWebhookEvent"("source", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderProfile_stripeConnectAccountId_key" ON "ProviderProfile"("stripeConnectAccountId");

-- AddForeignKey
ALTER TABLE "ProviderSubscription" ADD CONSTRAINT "ProviderSubscription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

