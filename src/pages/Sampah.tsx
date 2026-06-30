import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import formatPeriod from "../helpers/formatPeriod";
import formatRupiah from "../helpers/formatRupiah";
import { useResizableColumns } from "../hooks/useResizableColumns";

type DeletedDue = {
  id: string;
  period: string;
  amount_due: number;
  amount_paid: number;
  deleted_at: string;
  units: { code: string } | null;
}

type DeletedTransaction = {
  id: string;
  transaction_date: string;
  amount: number;
  direction: 'masuk' | 'keluar';
  deleted_at: string;
  account_categories: { name: string } | null;
  units: { code: string } | null;
}

export default function Sampah() {
  const [deletedDues, setDeletedDues] = useState<DeletedDue[]>([]);
  const [deletedTx, setDeletedTx] = useState<DeletedTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const duesWidth = useResizableColumns([80, 110, 120, 120, 80]);
  const txWidth = useResizableColumns([110, 140, 80, 130, 80]);

  useEffect(() => {
    async function load() {
      const duesResult = await supabase
        .from('ipl_dues')
        .select('id, period, amount_due, amount_paid, deleted_at, units(code)')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
 
      const txResult = await supabase
        .from('bank_transactions')
        .select(
          'id, transaction_date, amount, direction, deleted_at, account_categories(name), units(code)'
        )
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });
 
      if (duesResult.error) setError(duesResult.error.message);
      else setDeletedDues((duesResult.data as unknown as DeletedDue[]) ?? []);
 
      if (txResult.error) setError(txResult.error.message);
      else setDeletedTx((txResult.data as unknown as DeletedTransaction[]) ?? []);
    }
    load();
  }, [refreshKey, setError]);

  async function restoreDue(id: string) {
    const { error } = await supabase
      .from('ipl_dues')
      .update({deleted_at: null})
      .eq('id', id);

    if (error) {
      alert('Gagal restore: ' + error.message);
      return;
    }
    setRefreshKey(k => k + 1);
  }

  async function restoreTransaction(id: string) {
    const { error } = await supabase
      .from('bank_transactions')
      .update({deleted_at: null})
      .eq('id', id);
      
    if (error) {
      alert('Gagal restore: ' + error.message);
      return;
    }
    setRefreshKey(k => k + 1);
  }

  return (
    <div className="max-w-5xl mx-auto mt-10 font-sans pb-16 px-4">
      <div className="flex flex-wrap flex-row justify-between items-center gap-2 mb-8">
        <h1 className="font-semibold text-xl">Sampah</h1>
        <Link to="/" className="text-blue-600 underline hover:text-blue-700">Kembali ke Dashboard</Link>
      </div>

      {error && <p className="text-red-600">Gagal fetch: {error}</p>}

      <h2 className="font-semibold mb-2">Tagihan Terhapus</h2>
      
      {deletedDues.length === 0 && (
        <p className="text-sm text-gray-500 mb-10">Tidak ada tagihan yang terhapus.</p>
      )}

      {deletedDues.length > 0 && (
        <div className="overflow-x-auto mb-20 mt-4">
          <table className="w-full border-collapse text-sm table-fixed mx-auto" style={{width: duesWidth.widths.reduce((a, b) => a + b, 0)}}>
            <thead>
              <tr className="text-left">
                {['Blok', 'Periode', 'Proyeksi', 'Realisasi', ''].map((label, i) => (
                  <th key={label || i} style={{ width: duesWidth.widths[i] }} className="relative p-2 overflow-hidden border-l border-gray-400">
                    {label}
                    <div onMouseDown={e => {
                      e.preventDefault();
                      duesWidth.startResize(i, e.clientX);
                    }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deletedDues.map(due => (
                <tr key={due.id} className="border-b border-gray-300">
                  <td className="p-2 truncate border-l border-gray-300" style={{width: duesWidth.widths[0]}}>{due.units?.code}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: duesWidth.widths[1]}}>{formatPeriod(due.period)}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: duesWidth.widths[2]}}>{formatRupiah(due.amount_due)}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: duesWidth.widths[3]}}>{formatRupiah(due.amount_paid)}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: duesWidth.widths[4]}}>
                    <button onClick={() => restoreDue(due.id)} className="text-green-600 hover:underline text-xs">Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="font-semibold mb-2">Transaksi Terhapus</h2>
      
      {deletedTx.length === 0 && (
        <p className="text-sm text-gray-500 mb-6">Tidak ada transaksi yang terhapus.</p>
      )}

      {deletedTx.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm table-fixed mx-auto" style={{width: duesWidth.widths.reduce((a, b) => a + b, 0)}}>
            <thead>
              <tr className="text-left">
                {['Tanggal', 'Kategori', 'Unit', 'Nominal', ''].map((label, i) => (
                  <th key={label || i} style={{ width: txWidth.widths[i] }} className="relative p-2 overflow-hidden border-l border-gray-400">
                    {label}
                    <div onMouseDown={e => {
                      e.preventDefault();
                      txWidth.startResize(i, e.clientX);
                    }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deletedTx.map(tx => (
                <tr key={tx.id} className="border-b border-gray-300">
                  <td className="p-2 truncate border-l border-gray-300" style={{width: txWidth.widths[0]}}>{formatPeriod(tx.transaction_date, true)}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: txWidth.widths[1]}}>{tx.account_categories?.name}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: txWidth.widths[2]}}>{tx.units?.code ?? '-'}</td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: txWidth.widths[3]}}>
                    {tx.direction === 'masuk' ? '+' : '-'} {formatRupiah(tx.amount)}
                  </td>
                  <td className="p-2 truncate border-l border-gray-300" style={{width: txWidth.widths[4]}}>
                    <button onClick={() => restoreTransaction(tx.id)} className="text-green-600 hover:underline text-xs">Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}