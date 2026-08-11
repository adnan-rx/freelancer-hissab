import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { assets, liabilities, wealthStatements, income, expenses } from '../../database/schema';
import { CreateAssetDto, UpdateAssetDto, CreateLiabilityDto, UpdateLiabilityDto, UpdateWealthStatementDto } from './dto/wealth.dto';
import { taxYearRange, incomeInTaxYear, expensesInTaxYear, parseTaxYear } from '../../common/tax-year';
import { round2 } from '../../common/money';

@Injectable()
export class WealthService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * `taxYear` arrives as free text from the client ("2026", "2025-26", or nothing)
   * but is matched with exact string equality in the database. Normalising every
   * read and write through `parseTaxYear` stops an asset saved as "2025-26" from
   * being invisible to a reconciliation querying "2026".
   */
  private year(input?: string | number | null): string {
    return String(parseTaxYear(input));
  }

  // Assets
  async getAssets(userId: string, taxYear?: string) {
    return this.db
      .select()
      .from(assets)
      .where(and(eq(assets.userId, userId), eq(assets.taxYear, this.year(taxYear))));
  }

  async createAsset(userId: string, dto: CreateAssetDto) {
    const [asset] = await this.db
      .insert(assets)
      .values({
        userId,
        taxYear: this.year(dto.taxYear),
        type: dto.type,
        name: dto.name,
        description: dto.description,
        currency: dto.currency,
        balance: round2(dto.balance ?? 0).toString(),
        valuePKR: round2(dto.valuePKR).toString(),
      })
      .returning();
    return asset;
  }

  async updateAsset(userId: string, id: string, dto: UpdateAssetDto) {
    const updateData: Record<string, any> = {};
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.currency !== undefined) updateData.currency = dto.currency;
    if (dto.balance !== undefined) updateData.balance = round2(dto.balance).toString();
    if (dto.valuePKR !== undefined) updateData.valuePKR = round2(dto.valuePKR).toString();

    // Drizzle throws "No values to set" on an empty object → used to be a 500.
    if (Object.keys(updateData).length === 0) {
      const [current] = await this.db
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), eq(assets.userId, userId)))
        .limit(1);
      if (!current) throw new NotFoundException('Asset not found');
      return current;
    }

    updateData.updatedAt = new Date();
    const [asset] = await this.db
      .update(assets)
      .set(updateData)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning();
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async deleteAsset(userId: string, id: string) {
    const [deleted] = await this.db
      .delete(assets)
      .where(and(eq(assets.id, id), eq(assets.userId, userId)))
      .returning();
    if (!deleted) throw new NotFoundException('Asset not found');
    return deleted;
  }

  // Liabilities
  async getLiabilities(userId: string, taxYear?: string) {
    return this.db
      .select()
      .from(liabilities)
      .where(and(eq(liabilities.userId, userId), eq(liabilities.taxYear, this.year(taxYear))));
  }

  async createLiability(userId: string, dto: CreateLiabilityDto) {
    const [liability] = await this.db
      .insert(liabilities)
      .values({
        userId,
        taxYear: this.year(dto.taxYear),
        description: dto.description,
        amountPKR: round2(dto.amountPKR).toString(),
      })
      .returning();
    return liability;
  }

  async updateLiability(userId: string, id: string, dto: UpdateLiabilityDto) {
    const updateData: Record<string, any> = {};
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.amountPKR !== undefined) updateData.amountPKR = round2(dto.amountPKR).toString();

    if (Object.keys(updateData).length === 0) {
      const [current] = await this.db
        .select()
        .from(liabilities)
        .where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)))
        .limit(1);
      if (!current) throw new NotFoundException('Liability not found');
      return current;
    }

    updateData.updatedAt = new Date();
    const [liability] = await this.db
      .update(liabilities)
      .set(updateData)
      .where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)))
      .returning();
    if (!liability) throw new NotFoundException('Liability not found');
    return liability;
  }

  async deleteLiability(userId: string, id: string) {
    const [deleted] = await this.db
      .delete(liabilities)
      .where(and(eq(liabilities.id, id), eq(liabilities.userId, userId)))
      .returning();
    if (!deleted) throw new NotFoundException('Liability not found');
    return deleted;
  }

  // Wealth Statement / Reconciliation

  /**
   * Read-only. This used to INSERT a row when none existed, which meant a plain
   * GET (including the one `/filing/readiness` makes internally) wrote to the
   * database and could race into duplicate rows.
   */
  async getWealthStatement(userId: string, taxYear?: string) {
    const year = this.year(taxYear);
    const [statement] = await this.db
      .select()
      .from(wealthStatements)
      .where(and(eq(wealthStatements.userId, userId), eq(wealthStatements.taxYear, year)))
      .limit(1);

    return (
      statement ?? {
        id: null,
        userId,
        taxYear: year,
        openingWealthPKR: '0',
        otherAdjustmentsPKR: '0',
      }
    );
  }

  async updateWealthStatement(userId: string, taxYear: string | undefined, dto: UpdateWealthStatementDto) {
    const year = this.year(taxYear);

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.openingWealthPKR !== undefined) updateData.openingWealthPKR = round2(dto.openingWealthPKR).toString();
    if (dto.otherAdjustmentsPKR !== undefined) updateData.otherAdjustmentsPKR = round2(dto.otherAdjustmentsPKR).toString();

    const [existing] = await this.db
      .select({ id: wealthStatements.id })
      .from(wealthStatements)
      .where(and(eq(wealthStatements.userId, userId), eq(wealthStatements.taxYear, year)))
      .limit(1);

    if (!existing) {
      const [created] = await this.db
        .insert(wealthStatements)
        .values({
          userId,
          taxYear: year,
          openingWealthPKR: updateData.openingWealthPKR ?? '0',
          otherAdjustmentsPKR: updateData.otherAdjustmentsPKR ?? '0',
        })
        .returning();
      return created;
    }

    const [updated] = await this.db
      .update(wealthStatements)
      .set(updateData)
      .where(eq(wealthStatements.id, existing.id))
      .returning();

    return updated;
  }

  async getReconciliation(userId: string, taxYear?: string) {
    const year = this.year(taxYear);
    const statement = await this.getWealthStatement(userId, year);
    const userAssets = await this.getAssets(userId, year);
    const userLiabilities = await this.getLiabilities(userId, year);

    // Income and expenses must be scoped to the same Pakistani tax year (1 Jul – 30 Jun)
    // as the declared assets, otherwise the reconciliation compares different periods.
    const range = taxYearRange(year);
    const allIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const allExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    const userIncome = incomeInTaxYear(allIncome, range);
    const userExpenses = expensesInTaxYear(allExpenses, range);

    const totalIncomePKR = round2(userIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0));
    const totalExpensesPKR = round2(userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amountPKR || 0), 0));

    const openingWealthPKR = Number(statement.openingWealthPKR || 0);
    const otherAdjustmentsPKR = Number(statement.otherAdjustmentsPKR || 0);

    const expectedClosingWealthPKR = round2(
      openingWealthPKR + totalIncomePKR - totalExpensesPKR + otherAdjustmentsPKR,
    );

    const declaredAssetsPKR = round2(userAssets.reduce((sum: number, a: any) => sum + Number(a.valuePKR || 0), 0));
    const declaredLiabilitiesPKR = round2(
      userLiabilities.reduce((sum: number, l: any) => sum + Number(l.amountPKR || 0), 0),
    );
    const netDeclaredWealthPKR = round2(declaredAssetsPKR - declaredLiabilitiesPKR);

    const differencePKR = round2(netDeclaredWealthPKR - expectedClosingWealthPKR);
    const toleranceThresholdPKR = Number(process.env.WEALTH_RECONCILE_TOLERANCE_PKR || 50000);

    const reconciled = Math.abs(differencePKR) <= toleranceThresholdPKR;

    return {
      taxYear: range.taxYear,
      taxYearLabel: range.label,
      periodStart: range.start.toISOString().split('T')[0],
      periodEnd: new Date(range.end.getTime() - 86400000).toISOString().split('T')[0],
      openingWealthPKR,
      totalIncomePKR,
      totalExpensesPKR,
      otherAdjustmentsPKR,
      expectedClosingWealthPKR,
      declaredAssetsPKR,
      declaredLiabilitiesPKR,
      netDeclaredWealthPKR,
      differencePKR,
      reconciled,
      toleranceThresholdPKR,
    };
  }
}
