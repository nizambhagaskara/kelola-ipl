import { useEffect, useState, type SyntheticEvent } from "react";
import { supabase } from "../lib/supabase";
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
  created_at: string;
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

type OutstandingDueForAlloc = {
  id: string;
  period: string;
  outstanding: number;
}

export default function MutasiBank() {

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
  const {widths, startResize} = useResizableColumns([20, 180, 160, 80, 120, 120, 160, 160]);

  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [allocatingRow, setAllocatingRow] = useState<LedgerRow | null>(null);
  const [allocDues, setAllocDues] = useState<OutstandingDueForAlloc[]>([]);
  const [allocError, setAllocError] = useState<string | null>(null);

  const [filterUnit, setFilterUnit] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState(''); 

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // effects
  useEffect(() => {
    async function load() {
      const {data, error} = await supabase
        .from('v_bank_ledger')
        .select('*')
        .order('transaction_date', {ascending: true})
        .order('created_at', {ascending: true});

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

  async function startAllocate(row: LedgerRow) {
    setAllocatingRow(row);
    setAllocations({});
    setAllocError(null);
    
    const { data: txData } = await supabase
      .from('bank_transactions')
      .select('unit_id')
      .eq('id', row.id)
      .single();

    if (!txData?.unit_id) return;

    const { data } = await supabase
      .from('ipl_dues')
      .select('id, period, amount_due, amount_paid')
      .eq('unit_id', txData.unit_id)
      .order('period');

    const outstanding = (data ?? [])
      .map(d => ({ id: d.id, period: d.period, outstanding: d.amount_due - d.amount_paid }))
      .filter(d => d.outstanding > 0);

    setAllocDues(outstanding);
  }

  async function handleAllocateSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!allocatingRow) return;

    const entries = Object.entries(allocations).filter(([, v]) => Number(v) > 0);

    if (entries.length === 0) {
      setAllocError('Pilih minimal 1 bulan.');
      return;
    }

    if (totalAllocated > (allocatingRow?.unallocated ?? 0)) {
      setAllocError('Total alokasi melebihi sisa yang tersedia');
      return;
    }

    for (const [dueId, amount] of entries) {
      const { error } = await supabase.rpc('allocate_leftover', {
        p_transaction_id: allocatingRow?.id,
        p_ipl_due_id: dueId,
        p_amount: Number(amount),
      });

      if (error) {
        setAllocError(`Gagal alokasi ke salah satu bulan: ${error.message}`);
        return;
      }
    }

    setAllocatingRow(null);
    setRefreshKey(k => k + 1);
  }

  function toggleAllocDue(due: OutstandingDueForAlloc, checked: boolean) {
    setAllocations(prev => {
      const next = { ...prev };

      if (checked) {
        const remaining = (allocatingRow?.unallocated ?? 0) - totalAllocating(next);
        next[due.id] = String(Math.min(due.outstanding, Math.max(remaining, 0)));
      } else {
        delete next[due.id];
      }
      return next;
    })
  }

  function totalAllocating(allocs: Record<string, string>) {
    return Object.values(allocs).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    })
  }

  function toggleSelectAll(pageRows: LedgerRow[], checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleBulkDelete() {
    const confirmed = window.confirm(`Hapus ${selectedIds.size} transaksi terpilih? (Bisa direstore dari halaman Sampah)`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('bank_transactions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', Array.from(selectedIds));

    if (error) {
      alert(`Gagal hapus: ${error.message}`);
      return;
    }

    setSelectedIds(new Set());
    setRefreshKey(k => k + 1);
  }

  const totalAllocated = totalAllocating(allocations);

  const availableUnits = (
    Array.from(new Set(rows.map(r => r.unit_code).filter(Boolean))) as string[]
  ).sort((a, b) => a.localeCompare(b, undefined, {numeric: true}));

  const availableYears = Array.from(
    new Set(rows.map(r => r.transaction_date.slice(0, 4)))
  ).sort();

  const availableCategories = Array.from(new Set(rows.map(r => r.category))).sort();

  const filteredRows = rows.filter(r => {
    if (filterUnit && r.unit_code !== filterUnit) return false;
    if (filterYear && r.transaction_date.slice(0, 4) !== filterYear) return false;
    if (filterMonth && r.transaction_date.slice(5, 7) !== filterMonth) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    return true;
  });

  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto mt-4 sm:mt-10 font-sans pl-6 lg:pl-0">
      <div className="pr-6">
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
      </div>

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
            {units.map(u => (
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

      <Modal open={allocatingRow !== null} onClose={() => setAllocatingRow(null)}>
        <form action="" onSubmit={handleAllocateSubmit} className="p-4">
          <h3 className="font-semibold">
            Alokasikan Sisa {allocatingRow && formatRupiah(allocatingRow.unallocated ?? 0)}
          </h3>

          {allocDues.length === 0 && (
            <p className="text-sm text-gray-500 mb-2">Tidak ada tagihan outstanding untuk unit ini.</p>
          )}

          <div className="flex flex-col py-4 gap-1">
            {allocDues.map(due => {
              const checked = due.id in allocations;

              return (
                <div key={due.id} className="flex items-center gap-2 mb-1">
                  <input type="checkbox" name="selectAllocDue" id="selectAllocDue" checked={checked} onChange={e => toggleAllocDue(due, e.target.checked)} />

                  <span className="text-sm flex-1">
                    {formatPeriod(due.period)} (outstanding: Rp{due.outstanding.toLocaleString('id-ID')})
                  </span>
                  
                  {checked && (
                    <input type="number" name="setAlloc" id="setAlloc" value={allocations[due.id]} onChange={e => setAllocations(prev => ({...prev, [due.id]: e.target.value}))} max={due.outstanding} className="border border-gray-300 rounded px-2 py-1 w-28 text-sm" />
                  )}
                </div>
              );
            })}
          </div>
          
          {Object.keys(allocations).length > 0 && (
            <p className="text-sm mt-2 mb-2">
              Total dialokasikan: Rp{totalAllocated.toLocaleString('id-ID')} dari Rp{(allocatingRow?.unallocated ?? 0).toLocaleString('id-ID')} tersedia
            </p>
          )}

          {allocError && <p className="text-red-600 text-sm mb-2">{allocError}</p>}

          <button type="submit" className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 w-full"> Konfirmasi</button>
        </form>
      </Modal>

      <h2 className="font-semibold mb-2">Mutasi Bank</h2>
      {fetchError && <p className="text-red-600">Gagal fetch: {fetchError}</p>}

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={filterUnit}
          onChange={(e) => {
            setFilterUnit(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Semua unit</option>
          {availableUnits.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>

        <select
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Semua kategori</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select
          value={filterYear}
          onChange={(e) => {
            setFilterYear(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Semua tahun</option>
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={filterMonth}
          onChange={(e) => {
            setFilterMonth(e.target.value);
            setPage(1);
          }}
          className="border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Semua bulan</option>
          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
            <option key={m} value={m}>
              {new Date(2000, Number(m) - 1).toLocaleString('id-ID', { month: 'long' })}
            </option>
          ))}
        </select>
      </div>

      <div className="w-full">
        <div className={`w-full flex justify-center items-center transition-opacity duration-200 ease-in-out ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className='flex justify-between items-end w-full max-w-5xl'>
            <span>{selectedIds.size} tagihan dipilih</span>

            <div className='flex gap-2 px-6'>
              {selectedIds.size === 1 && (
                <button onClick={() => startEditTx(Array.from(selectedIds)[0])} className='bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default'>Edit</button>
              )}
              <button onClick={handleBulkDelete} className='bg-red-600 text-white hover:bg-red-700 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default' disabled={selectedIds.size === 0}>Hapus</button>
              <button onClick={() => setSelectedIds(new Set())} className='bg-gray-500 text-white hover:bg-gray-600 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default' disabled={selectedIds.size === 0}>Batal</button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-24 pt-8">
          <table className="border-collapse text-sm mx-auto table-fixed" style={{ width: widths.reduce((a, b) => a + b, 0) }}>
            <thead>
              <tr className="text-left">
                <th className='p-2 border-l border-gray-400 text-center w-12'>
                  <input type="checkbox" name="selectAllRow" id="selectAllRow" checked={paginatedRows.length > 0 && paginatedRows.every(d => selectedIds.has(d.id))} onChange={e => toggleSelectAll(paginatedRows, e.target.checked)} />
                </th>
                {['Tanggal', 'Kategori', 'Unit', 'Nominal', 'Saldo', 'Catatan', 'Belum Teralokasi (lebihan bayar)'].map((label, i) => (
                  <th key={label} style={{ width: widths[i + 1], position: 'relative' }} className="p-2 overflow-hidden border-l border-gray-400">
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
              {(() => {
                return paginatedRows.map(row => (
                  <tr key={row.id} className="border-b border-gray-200">
                    <td className='p-2 border-l border-gray-300 text-center' style={{width: widths[0]}}>
                      <input type="checkbox" name="selectRow" id="selectRow" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                    </td>
                    <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[1] }}>
                      {formatPeriod(row.transaction_date, true)}
                    </td>
                    <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[2] }}>
                      {row.category}
                    </td>
                    <td className="border-l border-gray-300 p-2 truncate" style={{ width: widths[3] }}>
                      {row.unit_code ?? '-'}
                    </td>
                    <td className={`border-l border-gray-300 p-2 truncate ${row.direction === 'masuk' ? 'text-green-600' : 'text-red-600'}`} style={{ width: widths[3] }}>
                      {row.direction === 'masuk' ? '+' : '-'} {formatRupiah(row.amount)}
                    </td>
                    <td className="p-2 truncate border-l border-gray-300" style={{ width: widths[4] }}>
                      {formatRupiah(row.running_balance)}
                    </td>
                    <td className="p-2 truncate border-l border-gray-300" style={{ width: widths[5] }} title={row.description ? row.description : ''}>
                      {row.description}
                    </td>
                    <td className="p-2 truncate border-l border-gray-300" style={{width: widths[6]}}>
                      {row.unallocated === null ? (
                        '-'
                      ) : row.unallocated > 0 ? (
                        <div className="flex gap-2">
                          <span className="text-amber-600">{formatRupiah(row.unallocated)}</span>
                          <button onClick={() => startAllocate(row)} className="text-blue-600 hover:underline text-xs">Alokasikan</button>
                        </div>
                      ) : (
                        formatRupiah(row.unallocated)
                      )}
                    </td>
                  </tr>
                ))
              })()}
            </tbody>
          </table>

          {/* Pagination controls */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

            return (
              <div className="flex items-center justify-center gap-3 mt-4 text-sm">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40'>{'<'}</button>
                <span>Halaman {page} dari {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40'>{'>'}</button>
              </div>
            );
          })()}
        </div>
      </div>

    </div>
  );
}