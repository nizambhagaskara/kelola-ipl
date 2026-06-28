import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useResizableColumns } from "../hooks/useResizableColumns";

type LedgerRow = {
  id: string;
  transaction_date: string;
  category: string;
  direction: 'masuk' | 'keluar';
  unit_code: string | null;
  amount: number;
  description: string | null;
  running_balance: number;
}

export default function MutasiBank() {
  const { session } = useAuth();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const {widths, startResize} = useResizableColumns([180, 160, 80, 120, 120, 100]);

  useEffect(() => {
    async function load() {
      const {data, error} = await supabase
        .from('v_bank_ledger')
        .select('*')
        .order('transaction_date', {ascending: true});

      if (error) {
        setFetchError(error.message);
      } else {
        setRows((data as LedgerRow[]) ?? []);
      }
    }

    load();
  }, [refreshKey]);

  function formatDate(dateStr: string) {
    // dateStr format: "YYYY-MM-DD"
    const [year, month, date] = dateStr.split('-');
    const monthName = new Date(2000, Number(month) - 1).toLocaleString('id-ID', { month: "long" });
    return `${date} ${monthName}, ${year}`;
  }

  async function handleDelete(row: LedgerRow) {
    const confirmed = window.confirm(
      `Hapus transaksi "${row.category}" tanggal ${formatDate(row.transaction_date)} sebesar ${formatRupiah(row.amount)}?`
    );
    if (!confirmed) return;

    const {error} = await supabase.from('bank_transactions').delete().eq('id', row.id);
    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }

    setRefreshKey(k => k + 1);
  }

  function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  }

  return (
    <div className="max-w-5xl mx-auto mt-4 sm:mt-10 font-sans">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-10 px-4">
        <p>Login sebagai: {session?.user.email}</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Kembali ke Dashboard
        </Link>
      </div>

      <h2 className="font-semibold mb-2 px-4">Mutasi Bank</h2>
      {fetchError && <p className="text-red-600">Gagal fetch: {fetchError}</p>}

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm mx-auto table-fixed" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
          <thead>
            <tr className="text-left">
              {['Tanggal', 'Kategori', 'Unit', 'Nominal', 'Saldo', '  '].map((label, i) => (
                <th key={label} style={{ width: widths[i], position: 'relative' }} className="p-2 overflow-hidden border-l border-gray-400">
                  {label}
                  <div onMouseDown={(e) => {
                      e.preventDefault();
                      startResize(i, e.clientX);
                    }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-400" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id} className="border-b border-gray-200">
                <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[0] }}>
                  {formatDate(row.transaction_date)}
                </td>
                <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[1] }}>
                  {row.category}
                </td>
                <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[2] }}>
                  {row.unit_code ?? '-'}
                </td>
                <td className={`border-l border-gray-300 p-2 truncate ${row.direction === 'masuk' ? 'text-green-600' : 'text-red-600'}`} style={{ width: widths[3] }}>
                  {row.direction === 'masuk' ? '+' : '-'} {formatRupiah(row.amount)}
                </td>
                <td className="p-2 truncate border-l border-gray-300" style={{ width: widths[4] }}>
                  {formatRupiah(row.running_balance)}
                </td>
                <td className="p-2 border-l border-gray-300" style={{width: widths[5]}}>
                  <button onClick={() => handleDelete(row)} className="text-red-600 hover:underline text-xs">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}