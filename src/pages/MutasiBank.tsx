import { useEffect, useState, type SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useResizableColumns } from "../hooks/useResizableColumns";
import { Modal } from "../components/Modal";
import { EditTransactionForm, type EditableTransaction } from "../components/EditTransactionForm";

import formatPeriod from "../helpers/formatPeriod";
import formatRupiah from "../helpers/formatRupiah";

type LedgerRow = {
  id: string;
  transaction_date: string;
  category: string;
  direction: 'masuk' | 'keluar';
  unit_code: string | null;
  amount: number;
  description: string | null;
  running_balance: number;
  unallocated: number | null;
}

type UnidentifiedTx = {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
}

type Unit = {
  id: string;
  code: string;
}

export default function MutasiBank() {
  const { session } = useAuth();

  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [unidentifiedTx, setUnidentifiedTx] = useState<UnidentifiedTx[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [identifyingTx, setIdentifyingTx] = useState<UnidentifiedTx | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<EditableTransaction | null>(null);

  // resizable table columns width config
  const {widths, startResize} = useResizableColumns([180, 160, 80, 120, 120, 120, 140, 100]);

  // effects
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

  useEffect(() => {
    supabase
      .from('units')
      .select('id, code')
      .order('code')
      .then(({data}) => setUnits(data ?? []));
  }, []);

  useEffect(() => {
    async function loadUnidentified() {
      const { data: categoryData } = await supabase
        .from('account_categories')
        .select('id')
        .eq('name', 'Revenue IPL - Belum Teridentifikasi')
        .single();

      if (!categoryData) return;

      const { data } = await supabase
        .from('bank_transactions')
        .select('id, transaction_date, amount, description')
        .eq('category_id', categoryData.id)
        .is('deleted_at', null)
        .order('transaction_date', {ascending: false});

      setUnidentifiedTx(data ?? []);
    }

    loadUnidentified();
  }, [refreshKey]);

  // local helper functions
  async function handleDelete(row: LedgerRow) {
    const confirmed = window.confirm(
      `Hapus transaksi "${row.category}" tanggal ${formatPeriod(row.transaction_date), true} sebesar ${formatRupiah(row.amount)}? (Bisa direstore dari halaman Sampah)`
    );
    if (!confirmed) return;

    const {error} = await supabase
      .from('bank_transactions')
      .update({deleted_at: new Date().toISOString()})
      .eq('id', row.id);

    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }

    setRefreshKey(k => k + 1);
  }

  function startIdentify(tx: UnidentifiedTx) {
    setIdentifyingTx(tx);
    setSelectedUnitId('');
    setIdentifyError(null);
  }

  async function handleIdentifySubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!identifyingTx) return;

    if (!selectedUnitId) {
      setIdentifyError('Pilih unit dulu');
      return;
    }

    const { data, error } = await supabase.rpc('identify_transaction', {
      p_transaction_id: identifyingTx.id,
      p_unit_id: selectedUnitId,
    });

    console.log('rpc result:', { data, error });

    if (error) {
      setIdentifyError(error.message);
      return;
    }

    setIdentifyingTx(null);
    setRefreshKey(k => k + 1);
  }

  async function startEditTx(id: string) {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, transaction_date, category_id, unit_id, amount, description, auto_allocate')
      .eq('id', id)
      .single();

      if (error || !data) {
        alert('Gagal ambil data transaksi.');
        return;
      }

      setEditingTx(data as EditableTransaction);
  }

  return (
    <div className="max-w-5xl mx-auto mt-4 sm:mt-10 font-sans">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-10 px-4">
        <p>Login sebagai: {session?.user.email}</p>
        <Link to="/" className="text-blue-600 hover:underline">
          Kembali ke Dashboard
        </Link>
      </div>

      {unidentifiedTx.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 mb-6">
          <h3 className="font-semibold mb-2 text-sm">Transaksi Belum Teridentifikasi</h3>
          {unidentifiedTx.map((tx) => (
            <div key={tx.id} className="flex justify-between items-center text-sm py-1">
              <span>{formatPeriod(tx.transaction_date, true)} — {formatRupiah(tx.amount)}</span>

              {tx.description && (
                <p className="text-xs text-gray-500 mt-0.5">{tx.description}</p>
              )}
              <button onClick={() => startIdentify(tx)} className="text-blue-600 hover:underline text-xs ml-4 shrink-0">
                Identifikasi
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={identifyingTx !== null} onClose={() => setIdentifyingTx(null)}>
        <form onSubmit={handleIdentifySubmit} className="p-4">
          <h3 className="font-semibold mb-3">
            Identifikasi Transaksi {identifyingTx && formatRupiah(identifyingTx.amount)}
          </h3>
          <select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 w-full mb-2"
          >
            <option value="">Pilih unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code}
              </option>
            ))}
          </select>
          {identifyError && <p className="text-red-600 text-sm mb-2">{identifyError}</p>}
          <button
            type="submit"
            className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 w-full"
          >
            Konfirmasi
          </button>
        </form>
      </Modal>

      <Modal open={editingTx !== null} onClose={() => setEditingTx(null)}>
        {editingTx && (
          <EditTransactionForm tx={editingTx} onSuccess={() => {
            setEditingTx(null);
            setRefreshKey(k => k + 1);
          }} onCancel={() => setEditingTx(null)} />
        )}
      </Modal>

      <h2 className="font-semibold mb-2 px-4">Mutasi Bank</h2>
      {fetchError && <p className="text-red-600">Gagal fetch: {fetchError}</p>}

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm mx-auto table-fixed" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
          <thead>
            <tr className="text-left">
              {['Tanggal', 'Kategori', 'Unit', 'Nominal', 'Saldo', 'Catatan', 'Belum Teralokasi (lebihan bayar)'].map((label, i) => (
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
                  {formatPeriod(row.transaction_date, true)}
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
                <td className="p-2 truncate border-l border-gray-300" style={{ width: widths[5] }}>
                  {row.description}
                </td>
                <td className="p-2 truncate border-l border-gray-300" style={{width: widths[6]}}>
                  {row.unallocated === null ? (
                    '-'
                  ) : row.unallocated > 0 ? (
                    <span className="text-amber-600">+ {formatRupiah(row.unallocated)}</span>
                  ) : (
                    formatRupiah(row.unallocated)
                  )}
                </td>
                <td className="p-2" style={{width: widths[7]}}>
                  <button onClick={() => handleDelete(row)} className="text-red-600 hover:underline text-xs">Hapus</button>
                  <button onClick={() => startEditTx(row.id)} className="text-blue-600 hover:underline text-xs ml-2">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}