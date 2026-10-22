-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_ONBOARDING';

-- AlterTable
ALTER TABLE "company_profiles" DROP DEFAULT FOR "name";

-- AlterTable
ALTER TABLE "company_profiles" DROP DEFAULT FOR "email";

-- AlterTable
ALTER TABLE "company_profiles" DROP DEFAULT FOR "phone";

-- AlterTable
ALTER TABLE "company_profiles" DROP DEFAULT FOR "paymentMethods";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
