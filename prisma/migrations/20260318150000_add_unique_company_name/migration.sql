-- AlterTable: customers.company_name に UNIQUE 制約を追加
CREATE UNIQUE INDEX "customers_company_name_key" ON "customers"("company_name");
