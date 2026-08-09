import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import { assets, liabilities, wealthStatements, income, expenses } from '../../database/schema';
import { CreateAssetDto, UpdateAssetDto, CreateLiabilityDto, UpdateLiabilityDto, UpdateWealthStatementDto } from './dto/wealth.dto';

@Injectable()
export class WealthService {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  // Assets
  async getAssets(userId: string, taxYear: string) {
    return this.db.select().from(assets).where(and(eq(assets.userId, userId), eq(assets.taxYear, taxYear)));
  }

  async createAsset(userId: string, dto: CreateAssetDto) {
    const [asset] = await this.db.insert(assets).values({ ...dto, userId }).returning();
    return asset;
  }

  async updateAsset(userId: string, id: string, dto: UpdateAssetDto) {
    const [asset] = await this.db
      .update(assets)
      .set(dto)
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
  async getLiabilities(userId: string, taxYear: string) {
    return this.db.select().from(liabilities).where(and(eq(liabilities.userId, userId), eq(liabilities.taxYear, taxYear)));
  }

  async createLiability(userId: string, dto: CreateLiabilityDto) {
    const [liability] = await this.db.insert(liabilities).values({ ...dto, userId }).returning();
    return liability;
  }

  async updateLiability(userId: string, id: string, dto: UpdateLiabilityDto) {
    const [liability] = await this.db
      .update(liabilities)
      .set(dto)
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
  async getWealthStatement(userId: string, taxYear: string) {
    let [statement] = await this.db
      .select()
      .from(wealthStatements)
      .where(and(eq(wealthStatements.userId, userId), eq(wealthStatements.taxYear, taxYear)))
      .limit(1);

    if (!statement) {
      [statement] = await this.db.insert(wealthStatements).values({
        userId,
        taxYear,
        openingWealthPKR: '0',
        otherAdjustmentsPKR: '0'
      }).returning();
    }
    return statement;
  }

  async updateWealthStatement(userId: string, taxYear: string, dto: UpdateWealthStatementDto) {
    const current = await this.getWealthStatement(userId, taxYear);
    
    // Using explicit strings for numeric types for Drizzle update
    const updateData: any = {};
    if (dto.openingWealthPKR !== undefined) updateData.openingWealthPKR = dto.openingWealthPKR.toString();
    if (dto.otherAdjustmentsPKR !== undefined) updateData.otherAdjustmentsPKR = dto.otherAdjustmentsPKR.toString();

    const [updated] = await this.db
      .update(wealthStatements)
      .set(updateData)
      .where(eq(wealthStatements.id, current.id))
      .returning();
    
    return updated;
  }

  async getReconciliation(userId: string, taxYear: string) {
    const statement = await this.getWealthStatement(userId, taxYear);
    const userAssets = await this.getAssets(userId, taxYear);
    const userLiabilities = await this.getLiabilities(userId, taxYear);
    
    // For income and expenses, we ideally filter by year, but standard FreelancerHissab currently has simple date ranges.
    // For reconciliation simplicity, let's grab all or filter by year prefix. (MVP logic)
    const userIncome = await this.db.select().from(income).where(eq(income.userId, userId));
    const userExpenses = await this.db.select().from(expenses).where(eq(expenses.userId, userId));

    const totalIncomePKR = userIncome.reduce((sum: number, inc: any) => sum + Number(inc.amountPKR || 0), 0);
    const totalExpensesPKR = userExpenses.reduce((sum: number, exp: any) => sum + Number(exp.amount || 0), 0);

    const openingWealthPKR = Number(statement.openingWealthPKR || 0);
    const otherAdjustmentsPKR = Number(statement.otherAdjustmentsPKR || 0);

    const expectedClosingWealthPKR = openingWealthPKR + totalIncomePKR - totalExpensesPKR + otherAdjustmentsPKR;

    const declaredAssetsPKR = userAssets.reduce((sum: number, a: any) => sum + Number(a.valuePKR || 0), 0);
    const declaredLiabilitiesPKR = userLiabilities.reduce((sum: number, l: any) => sum + Number(l.amountPKR || 0), 0);
    const netDeclaredWealthPKR = declaredAssetsPKR - declaredLiabilitiesPKR;

    const differencePKR = netDeclaredWealthPKR - expectedClosingWealthPKR;
    const toleranceThresholdPKR = 50000;
    
    const reconciled = Math.abs(differencePKR) <= toleranceThresholdPKR;

    return {
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
      toleranceThresholdPKR
    };
  }
}
