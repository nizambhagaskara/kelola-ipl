import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx';
import { supabase } from "../lib/supabase";

type Category = {
  id: string;
  name: string;
  direction: 'masuk' | 'keluar';
  requires_unit: boolean;
}

type Unit = {
  id: string;
  code: string;
}

type ParsedRow = {
  rowNumber: number;
  date: string | null;
  categoryName: string;
  blokRaw: string;
  amount: number | null;
  description: string;
  periodeRaw: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  resolvedCategoryId: string | null;
  resolvedUnitId: string | null;
  periods: string[];
}

export default function ImportTransaksi() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('account_categories')
      .select('id, name, direction, requires_unit')
      .then(({data}) => setCategories(data ?? []));
    
    supabase
      .from('units')
      .select('id, code')
      .then(({data}) => setUnits(data ?? []));
  }, []);

  function downloadTemplate() {
    const link = document.createElement('a');
    link.href = '/template_import_transaksi.xlsx';
    link.download = 'template_import_transaksi.xlsx';
    link.click();
  }

  function excelDateToISO(value: unknown): string | null {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      return date.toISOString().slice(0, 10);
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
      return value.trim();
    }
    
    return null;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {header: 1, raw: true});
      
      const requiredKeywords = ['tanggal', 'kategori', 'nominal',];
      let headerRowIndex = -1;
      
      for (let i = 0; i < raw.length; i++) {
        const cells = (raw[i] ?? []).map(c => String(c ?? '').toLowerCase());
        const matchCount = requiredKeywords.filter(kw => cells.some(c => c.includes(kw))).length;
        if (matchCount >= 3) {
          headerRowIndex = i;
          break;
        }
      }
      
      if (headerRowIndex === -1) {
        alert('Tidak ditemukan baris header (harus ada kolom Tanggal, Kategori, Nominal)');
      }
      
      const headerRow = (raw[headerRowIndex] ?? []).map(h => String(h ?? '').toLowerCase());

      function findCol(keyword: string) {
        return headerRow.findIndex(h => h.includes(keyword));
      }

      const colTanggal = findCol('tanggal');
      const colKategori = findCol('kategori');
      const colBlok = findCol('blok');
      const colNominal = findCol('nominal');
      const colKeterangan = findCol('keterangan');
      const colPeriode = findCol('periode');

      const dataRows = raw.slice(headerRowIndex + 1).filter(r => r.length > 0 && r.some(c => c !== undefined));

      const results: ParsedRow[] = dataRows.map((r, idx) => {
        const rowNumber = idx + 1;
        const dateRaw = colTanggal >= 0 ? r[colTanggal] : undefined;
        const categoryName = String(colKategori >= 0 ? r[colKategori] ?? '' : '').trim();
        const blokRaw = String(colBlok >= 0 ? r[colBlok] ?? '' : '').trim();
        const amountRaw = colNominal >= 0 ? r[colNominal] : undefined;
        const description = String(colKeterangan >= 0 ? r[colKeterangan] ?? '' : '').trim();
        const periodeRaw = String(colPeriode >= 0 ? r[colPeriode] ?? '' : ''.trim())

        const date = excelDateToISO(dateRaw);
        const amount = typeof amountRaw === 'number'
          ? amountRaw
          : Number(String(amountRaw ?? '').replace(/[^\d.-]/g, '')) || null;

        const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

        if (!date) {
          console.log(date);
          return {
            rowNumber, date, categoryName, blokRaw, amount, description, periodeRaw,
            status: 'error' as const,
            message: 'Tanggal tidak valid',
            resolvedCategoryId: null,
            resolvedUnitId: null,
            periods: [],
          };
        }

        if (!category) {
          return {
            rowNumber, date, categoryName, blokRaw, amount, description, periodeRaw,
            status: 'error' as const,
            message: `Kategori "${categoryName}" tidak dikenal`,
            resolvedCategoryId: null,
            resolvedUnitId: null,
            periods: [],
          };
        }

        if (!amount || amount <= 0) {
          return {
            rowNumber, date, categoryName, blokRaw, amount, description, periodeRaw,
            status: 'error' as const,
            message: 'Nominal tidak valid',
            resolvedCategoryId: category.id,
            resolvedUnitId: null,
            periods: [],
          };
        }

        const unit = units.find(u => u.code.toLowerCase() === blokRaw.toLowerCase());

        if (category.requires_unit && !unit) {
          const fallback = categories.find(c => c.name === 'Revenue IPL - Belum Teridentifikasi');
          return {
            rowNumber, date, categoryName, blokRaw, amount, description, periodeRaw,
            status: 'warning' as const,
            message: blokRaw
              ? `Blok ${blokRaw} tidak ditemukan, dialihkan ke Belum Teridentifikasi`
              : 'Blok kosong, dialihkan ke Belum Teridentifikasi',
            resolvedCategoryId: fallback?.id ?? category.id,
            resolvedUnitId: null,
            periods: [],
          };
        }

        const periods = periodeRaw
          ? periodeRaw
              .split(', ')
              .map(p => p.trim())
              .filter(Boolean)
              .map(p => `${p}-01`)
          : [];

        return {
          rowNumber, date, categoryName, blokRaw, amount, description, periodeRaw,
          status: 'ok' as const,
          message: 'Siap diimport',
          resolvedCategoryId: category.id,
          resolvedUnitId: unit?.id ?? null,
          periods
        };
      });

      setParsedRows(results);
      setImportResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const importable = parsedRows.filter(r => r.status !== 'error');
    if (importable.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed  = 0;

    for (const row of importable) {
      const category = categories.find(c => c.id === row.resolvedCategoryId);
      if (!category) {
        failed++;
        continue;
      }

      const isManual = row.periods.length > 0 && row.resolvedUnitId;

      const { data: inserted, error } = await supabase
        .from('bank_transactions')
        .insert({
          transaction_date: row.date,
          category_id: row.resolvedCategoryId,
          unit_id: category.requires_unit ? row.resolvedUnitId : null,
          direction: category.direction,
          amount: row.amount,
          description: row.description || null,
          auto_allocate: !isManual,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        failed++;
        continue;
      }

      if (isManual) {
        const { data: dues } = await supabase
          .from('ipl_dues')
          .select('id, period, amount_due, amount_paid')
          .eq('unit_id', row.resolvedUnitId)
          .in('period', row.periods);

        let remaining = row.amount ?? 0;
        const allocRows = [];

        for (const period of row.periods) {
          const due = dues?.find(d => d.period === period);
          if (!due) continue;

          const outstanding = due.amount_due - due.amount_paid;
          if (outstanding <= 0 || remaining <= 0) continue;

          const alloc = Math.min(remaining, outstanding);
          allocRows.push({
            transaction_id: inserted.id,
            ipl_due_id: due.id,
            amount: alloc,
          });
          remaining -= alloc;
        }
        if (allocRows.length > 0) {
          await supabase.from('payment_allocations').insert(allocRows);
        }
      }
      success++;
    }

    setImporting(false);
    setImportResult(`${success} transaksi berhasil diimport, ${failed} gagal`);
    setParsedRows([]);
  }

  const errorCount = parsedRows.filter(r => r.status === 'error').length;
  const warningCount = parsedRows.filter(r => r.status === 'warning').length;
  const okCount = parsedRows.filter(r => r.status === 'ok').length;
  
  return (
    <div className="max-w-6xl mx-auto mt-4 sm:mt-10 font-sans pb-16 px-2">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
        <h1 className="font-semibold text-lg">Import Transaksi</h1>
        <Link to='/' className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-2 text-white">Dashboard</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={downloadTemplate} className="bg-gray-200 rounded px-3 py-2 text-sm hover:bg-gray-300">Download Template</button>

        <label htmlFor="inputExcel" className="bg-gray-900 text-white rounded px-3 py-2 text-sm hover:bg-gray-700 cursor-pointer">
          Pilih file Excel
          <input type="file" name="inputExcel" id="inputExcel" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>
      </div>

      {importResult && <p className="text-sm mb-4">{importResult}</p>}

      {parsedRows.length > 0 && (
        <>
          <p className="text-sm mb-2">{okCount} siap, {warningCount} warning, {errorCount} error</p>

          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-left">
                  <th className="pr-2 py-2">#</th>
                  <th className="pr-2 py-2">Tanggal</th>
                  <th className="pr-2 py-2">Kategori</th>
                  <th className="pr-2 py-2">Blok</th>
                  <th className="pr-2 py-2">Nominal</th>
                  <th className="pr-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map(row => (
                  <tr key={row.rowNumber} className="border-b border-gray-100">
                    <td className="pr-2 py-2">{row.rowNumber}</td>
                    <td className="pr-2 py-2">{row.date ?? '-'}</td>
                    <td className="pr-2 py-2">{row.categoryName}</td>
                    <td className="pr-2 py-2">{row.blokRaw || '-'}</td>
                    <td className="pr-2 py-2">{row.amount ? row.amount.toLocaleString('id-ID') : '-'}</td>
                    <td className={`pr-2 py-2 ${
                      row.status === 'error'
                      ? 'text-red-600'
                      : row.status === 'warning'
                      ? 'text-amber-600'
                      : 'text-green-600'
                    }`}>{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={handleImport} disabled={importing || okCount + warningCount === 0} className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 disabled:opacity-50">{importing ? 'Mengimport...' : `Import ${okCount + warningCount} Transaksi`}</button>
        </>
      )}
    </div>
  );
}