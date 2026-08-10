import { useState } from 'react';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { apiClient } from '@/lib/api-client';
import { apiErrorMessage } from '@/lib/utils';

const MARGIN = 14;
const LINE = 6;
const PAGE_BOTTOM = 280;

type Column = { header: string; width: number; align?: 'left' | 'right' };

function unwrap(res: any) {
  return res.data?.data ?? res.data;
}

function money(value: any): string {
  const n = Number(value || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function csvCell(value: any): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Shared header so every document in the package is identifiable on its own. */
function startDoc(title: string, taxYearLabel: string, businessName: string) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FreelancerHisab', MARGIN, 20);

  doc.setFontSize(13);
  doc.text(title, MARGIN, 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(businessName, MARGIN, 36);
  doc.text(`Tax year ${taxYearLabel}`, MARGIN, 41);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, 196, 41, { align: 'right' });
  doc.setTextColor(0);
  doc.setDrawColor(210);
  doc.line(MARGIN, 45, 196, 45);

  return doc;
}

/** Minimal fixed-width table renderer — avoids pulling in an autotable plugin. */
function drawTable(doc: jsPDF, startY: number, columns: Column[], rows: string[][]): number {
  let y = startY;

  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    let x = MARGIN;
    columns.forEach((col) => {
      doc.text(col.header, col.align === 'right' ? x + col.width : x, y, {
        align: col.align === 'right' ? 'right' : 'left',
      });
      x += col.width;
    });
    y += 2;
    doc.setDrawColor(210);
    doc.line(MARGIN, y, 196, y);
    y += LINE - 1;
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();

  rows.forEach((row) => {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = 20;
      drawHeader();
    }
    let x = MARGIN;
    row.forEach((cell, i) => {
      const col = columns[i];
      const maxChars = Math.floor(col.width / 1.7);
      const text = cell.length > maxChars ? `${cell.slice(0, maxChars - 1)}…` : cell;
      doc.text(text, col.align === 'right' ? x + col.width : x, y, {
        align: col.align === 'right' ? 'right' : 'left',
      });
      x += col.width;
    });
    y += LINE - 1;
  });

  return y;
}

export function useGeneratePackage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  /**
   * Builds the filing package from live API data. Previously this rasterised a
   * screenshot of the page into a "tax summary"; these are real typeset reports.
   */
  const generatePackage = async (taxYear: string) => {
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const [estimateRes, incomeRes, expenseRes, profileRes, reconRes] = await Promise.all([
        apiClient.get(`/tax/estimate?year=${taxYear}`),
        apiClient.get('/income'),
        apiClient.get('/expenses'),
        apiClient.get('/users/profile'),
        apiClient.get(`/wealth/reconciliation?year=${taxYear}`),
      ]);

      const estimate = unwrap(estimateRes) || {};
      const profile = unwrap(profileRes) || {};
      const recon = unwrap(reconRes) || {};
      const allIncome: any[] = unwrap(incomeRes) || [];
      const allExpenses: any[] = unwrap(expenseRes) || [];

      const periodStart = estimate.periodStart ? new Date(estimate.periodStart) : null;
      const periodEnd = estimate.periodEnd ? new Date(estimate.periodEnd) : null;
      const inPeriod = (value: any) => {
        if (!periodStart || !periodEnd) return true;
        const d = new Date(value);
        return !Number.isNaN(d.getTime()) && d >= periodStart && d <= periodEnd;
      };

      const incomeList = allIncome.filter((i) => inPeriod(i.receivedAt || i.createdAt));
      const expenseList = allExpenses.filter((e) => inPeriod(e.expenseDate || e.createdAt));

      const label = estimate.taxYearLabel || taxYear;
      const businessName = profile.businessName || profile.name || 'FreelancerHisab user';

      // ---- 01 tax summary --------------------------------------------------
      const summary = startDoc('Tax Summary', label, businessName);
      let y = 56;

      const summaryRow = (labelText: string, value: string, bold = false) => {
        if (y > PAGE_BOTTOM) {
          summary.addPage();
          y = 20;
        }
        summary.setFont('helvetica', bold ? 'bold' : 'normal');
        summary.setFontSize(10);
        summary.text(labelText, MARGIN, y);
        summary.text(value, 196, y, { align: 'right' });
        y += LINE;
      };

      summaryRow('Filer name', profile.name || '—');
      summaryRow('Business name', profile.businessName || '—');
      summaryRow('PSEB registration', profile.psebId || 'Not registered');
      summaryRow('Bank / IBAN', profile.iban ? `${profile.bankName || ''} ${profile.iban}`.trim() : '—');
      summaryRow('Assessment period', `${estimate.periodStart || '—'} to ${estimate.periodEnd || '—'}`);
      y += 3;

      summaryRow('Export income (s.154A)', `PKR ${money(estimate.exportIncomePKR)}`);
      summaryRow('Local income', `PKR ${money(estimate.localIncomePKR)}`);
      summaryRow('Gross income', `PKR ${money(estimate.totalGrossIncomePKR)}`, true);
      summaryRow('Business expenses', `PKR ${money(estimate.totalExpensesPKR)}`);
      summaryRow('Net profit', `PKR ${money(estimate.netProfitPKR)}`, true);
      y += 3;

      summaryRow(`Export tax @ ${estimate.exportTaxRatePercentage ?? 0}%`, `PKR ${money(estimate.exportTaxLiabilityPKR)}`);
      summaryRow('Local tax (slab rates)', `PKR ${money(estimate.localTaxLiabilityPKR)}`);
      summaryRow('Total tax liability', `PKR ${money(estimate.totalTaxLiabilityPKR)}`, true);
      summaryRow('Effective tax rate', `${estimate.effectiveTaxRatePercentage ?? 0}%`);
      summaryRow('PSEB saving vs standard rate', `PKR ${money(estimate.psebSavingsPKR)}`);
      y += 3;

      summaryRow('Declared assets', `PKR ${money(recon.declaredAssetsPKR)}`);
      summaryRow('Declared liabilities', `PKR ${money(recon.declaredLiabilitiesPKR)}`);
      summaryRow('Net declared wealth', `PKR ${money(recon.netDeclaredWealthPKR)}`, true);
      summaryRow('Wealth reconciliation', recon.reconciled ? 'Reconciled' : `Gap of PKR ${money(recon.differencePKR)}`);
      y += 4;

      summary.setFont('helvetica', 'italic');
      summary.setFontSize(8);
      summary.setTextColor(110);
      summary.text(
        summary.splitTextToSize(estimate.disclaimer || 'Estimates only. Not certified tax advice.', 182),
        MARGIN,
        y,
      );

      // ---- 02 income report ------------------------------------------------
      const incomeDoc = startDoc('Income Report', label, businessName);
      const incomeEnd = drawTable(
        incomeDoc,
        56,
        [
          { header: 'Date', width: 22 },
          { header: 'Description', width: 58 },
          { header: 'Platform', width: 22 },
          { header: 'PRC ref', width: 26 },
          { header: 'SBP', width: 14 },
          { header: 'Amount', width: 20, align: 'right' },
          { header: 'PKR', width: 20, align: 'right' },
        ],
        incomeList.map((inc) => [
          String(inc.receivedAt || '').substring(0, 10),
          inc.description || '',
          inc.platform || '',
          inc.prcReferenceNumber || '—',
          inc.sbpPurposeCode || '—',
          `${inc.currency} ${money(inc.amount)}`,
          money(inc.amountPKR),
        ]),
      );
      incomeDoc.setFont('helvetica', 'bold');
      incomeDoc.setFontSize(9);
      incomeDoc.text(
        `Total: PKR ${money(incomeList.reduce((s, i) => s + Number(i.amountPKR || 0), 0))}  (${incomeList.length} entries)`,
        196,
        incomeEnd + 4,
        { align: 'right' },
      );

      // ---- 03 expense report -----------------------------------------------
      const expenseDoc = startDoc('Expense Report', label, businessName);
      const expenseEnd = drawTable(
        expenseDoc,
        56,
        [
          { header: 'Date', width: 24 },
          { header: 'Description', width: 70 },
          { header: 'Vendor', width: 40 },
          { header: 'Category', width: 26 },
          { header: 'PKR', width: 22, align: 'right' },
        ],
        expenseList.map((exp) => [
          String(exp.expenseDate || '').substring(0, 10),
          exp.description || '',
          exp.vendor || '—',
          exp.category || 'other',
          money(exp.amountPKR ?? exp.amount),
        ]),
      );
      expenseDoc.setFont('helvetica', 'bold');
      expenseDoc.setFontSize(9);
      expenseDoc.text(
        `Total: PKR ${money(expenseList.reduce((s, e) => s + Number(e.amountPKR ?? e.amount ?? 0), 0))}  (${expenseList.length} entries)`,
        196,
        expenseEnd + 4,
        { align: 'right' },
      );

      // ---- 04 transaction ledger ------------------------------------------
      const ledgerRows = [
        ...incomeList.map((inc) => ({
          date: String(inc.receivedAt || '').substring(0, 10),
          type: 'INCOME',
          description: inc.description || '',
          counterparty: inc.platform || '',
          category: inc.category || '',
          currency: inc.currency || '',
          amount: inc.amount,
          rate: inc.exchangeRate,
          amountPKR: inc.amountPKR,
          reference: inc.prcReferenceNumber || '',
          sbp: inc.sbpPurposeCode || '',
        })),
        ...expenseList.map((exp) => ({
          date: String(exp.expenseDate || '').substring(0, 10),
          type: 'EXPENSE',
          description: exp.description || '',
          counterparty: exp.vendor || '',
          category: exp.category || '',
          currency: exp.currency || 'PKR',
          amount: exp.amount,
          rate: exp.exchangeRate ?? 1,
          amountPKR: exp.amountPKR ?? exp.amount,
          reference: '',
          sbp: '',
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      const ledgerCsv = [
        ['Date', 'Type', 'Description', 'Counterparty', 'Category', 'Currency', 'Amount', 'Exchange Rate', 'Amount PKR', 'PRC Reference', 'SBP Code']
          .map(csvCell)
          .join(','),
        ...ledgerRows.map((r) =>
          [r.date, r.type, r.description, r.counterparty, r.category, r.currency, r.amount, r.rate, r.amountPKR, r.reference, r.sbp]
            .map(csvCell)
            .join(','),
        ),
      ].join('\r\n');

      const zip = new JSZip();
      zip.file(`01-tax-summary-${label}.pdf`, summary.output('blob'));
      zip.file(`02-income-report-${label}.pdf`, incomeDoc.output('blob'));
      zip.file(`03-expense-report-${label}.pdf`, expenseDoc.output('blob'));
      zip.file(`04-transaction-ledger-${label}.csv`, ledgerCsv);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `FreelancerHisab-Filing-Package-${label}.zip`);
    } catch (error) {
      setGenerateError(apiErrorMessage(error, 'Failed to generate the filing package.'));
    } finally {
      setIsGenerating(false);
    }
  };

  return { generatePackage, isGenerating, generateError };
}
