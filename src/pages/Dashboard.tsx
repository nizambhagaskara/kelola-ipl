// IMPORTS
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TransactionForm } from '../components/TransactionForm';
import { DueForm, type EditableDue } from '../components/Dueform';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { Modal } from '../components/Modal';
import formatRupiah from '../helpers/formatRupiah';
import formatPeriod from '../helpers/formatPeriod';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from '@boxicons/react';

// TYPES
type Due = {
  id: string;
  unit_id: string;
  period: string;
  amount_due: number;
  amount_paid: number;
  status: 'normal' | 'kosong' | 'lainnya';
  note: string | null;
  units: {code: string} | null;
}

export default function Dashboard() {
  // STATES
  const [dues, setDues] = useState<Due[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [editingDue, setEditingDue] = useState<EditableDue | null>(null);
  
  const {widths, startResize} = useResizableColumns([40, 70, 130, 120, 120, 150, 100, 80]);
  
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [dueModalOpen, setDueModalOpen] = useState(false);
  
  const [filterUnit, setFilterUnit] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // HELPER VARIABLES
  const availableUnits = (
    Array.from(new Set(dues.map(d => d.units?.code).filter(Boolean))) as string[]
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  
  const availableYears = Array.from(
    new Set(dues.map(d => d.period.slice(0, 4)))
  ).sort();
  
  const filteredDues = dues.filter(due => {
    if (filterUnit && due.units?.code !== filterUnit) return false;
    if (filterYear && due.period.slice(0, 4) !== filterYear) return false;
    if (filterMonth && due.period.slice(5, 7) !== filterMonth) return false;
    if (filterStatus === 'belum_lunas' && due.amount_due - due.amount_paid <= 0) return false;
    if (filterStatus === 'lunas' && due.amount_due - due.amount_paid > 0) return false;
    return true;
  });

  const sortedDues = [...filteredDues].sort((a, b) => {
    const codeCompare = (a.units?.code ?? '').localeCompare(b.units?.code ?? '', undefined, { numeric: true });
    if (codeCompare !== 0) return codeCompare;
    return a.period.localeCompare(b.period);
  });

  const paginatedDues = sortedDues.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // EFFECTS
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ipl_dues')
        .select('id, unit_id, period, amount_due, amount_paid, status, note, units(code)')
        .is('deleted_at', null)
        .order('period')
        .order('code', { referencedTable: 'units' })

      if (error) {
        setFetchError(error.message);
      } else {
        setDues((data as unknown as Due[]) ?? []);
      }
    }

    load();
  }, [refreshKey]);

  // HELPER FUNCTIONS
  function startEdit(dueId: string) {
    const due = dues.find(d => d.id === dueId);
    if (!due) return;
    
    setEditingDue({
      id: due.id,
      unit_id: due.unit_id,
      period: due.period,
      amount_due: due.amount_due,
      status: due.status,
      note: due.note,
    });
    setDueModalOpen(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    })
  }

  function toggleSelectAll(pageRows: Due[], checked: boolean) {
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
    const confirmed = window.confirm(`Hapus ${selectedIds.size} tagihan terpilih?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('ipl_dues')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', Array.from(selectedIds));

    if (error) {
      alert(`Gagal hapus: ${error.message}`);
      return;
    }

    setSelectedIds(new Set());
    setRefreshKey(k => k + 1);
  }

  return (<>
    <Modal open={transactionModalOpen} onClose={() => setTransactionModalOpen(false)}>
      <TransactionForm onSuccess={() => {
        setTransactionModalOpen(false);
        setRefreshKey(k => k + 1);
      }} />
    </Modal>

    <Modal open={dueModalOpen} onClose={() => setDueModalOpen(false)}>
      <DueForm key={editingDue?.id ?? 'new'} editingDue={editingDue} onSuccess={() => {
          setDueModalOpen(false);
          setEditingDue(null);
          setRefreshKey(k => k + 1);
        }} onCancelEdit={() => {
          setDueModalOpen(false);
          setEditingDue(null);
        }} />
    </Modal>

    <div className='w-full mt-6'>
      <h2 className="font-semibold mb-2 text-center text-xl py-4">Daftar Tagihan IPL</h2>
      {fetchError && <p className="text-red-600 text-center">Gagal fetch: {fetchError}</p>}

      <div className="flex gap-2 mb-3 justify-center flex-wrap">
        <select name="filterUnit" id="filterUnit" value={filterUnit} onChange={e => {
          setFilterUnit(e.target.value);
          setPage(1);
        }} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua unit</option>
          {availableUnits.map(code => (
            <option value={code} key={code}>{code}</option>
          ))}
        </select>

        <select name="filterMonth" id="filterMonth" value={filterMonth} onChange={e => {
          setFilterMonth(e.target.value);
          setPage(1);
        }} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua bulan</option>
          {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
            <option value={m} key={m}>
              {new Date(2000, Number(m) - 1).toLocaleString('id-ID', {month: 'long'})}
            </option>
          ))}
        </select>

        <select name="filterYear" id="filterYear" value={filterYear} onChange={e => {
          setFilterYear(e.target.value);
          setPage(1);
        }} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua tahun</option>
          {availableYears.map(year => (
            <option value={year} key={year}>{year}</option>
          ))}
        </select>

        <select name="filterStatus" id="filterStatus" value={filterStatus} onChange={e => {
          setFilterStatus(e.target.value);
          setPage(1);
        }} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua status</option>
          <option value="belum_lunas">Belum Lunas</option>
          <option value="lunas">Lunas</option>
        </select>
      </div>

      <div className='w-full pl-6 lg:pl-0'>
        <div className={`w-full flex justify-center items-center transition-opacity duration-200 ease-in-out`}>
          <div className='flex justify-between items-end w-full max-w-4xl pt-6 pb-2'>
            <span className={`${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0'}`}>{selectedIds.size} tagihan dipilih</span>

            <div className='flex gap-2 px-6'>
              {selectedIds.size === 1 && (
                <button onClick={() => startEdit(Array.from(selectedIds)[0])} className='bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default'>Edit</button>
              )}

              <button onClick={handleBulkDelete} className={`bg-red-600 text-white hover:bg-red-700 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default ${selectedIds.size > 0 ? 'block' : 'hidden'}`} disabled={selectedIds.size === 0}>Hapus</button>

              <button onClick={() => setSelectedIds(new Set())} className={`bg-gray-500 text-white hover:bg-gray-600 px-3 py-2 rounded font-semibold disabled:pointer-events-none disabled:cursor-default ${selectedIds.size > 0 ? 'block' : 'hidden'}`} disabled={selectedIds.size === 0}>Batal</button>

              <button onClick={() => {
                setEditingDue(null);
                setDueModalOpen(true);
              }} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 flex justify-center items-center gap-1'>
                <Plus className='scale-75' size='sm' />
                <span>Tagihan</span>
              </button>
              
              <button onClick={() => setTransactionModalOpen(true)} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 flex justify-center items-center gap-1'>
                <Plus className='scale-75' size='sm' />
                <span>Transaksi</span>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-24 pt-8">
          <table className="border-collapse text-sm mx-auto table-fixed" style={{width: widths.reduce((a, b) => a + b, 0)}}>
            <thead>
              <tr className="text-left">
                <th className='p-2 border-l border-gray-400 text-center w-12'>
                  <input type="checkbox" name="selectAllRow" id="selectAllRow" checked={paginatedDues.length > 0 && paginatedDues.every(d => selectedIds.has(d.id))} onChange={e => toggleSelectAll(paginatedDues, e.target.checked)} />
                </th>
                {['Blok', 'Periode', 'Proyeksi', 'Realisasi', 'Outstanding', 'Status', 'Catatan'].map((label, i) => (
                  <th key={label || i} style={{ width: widths[i + 1], position: 'relative' }} className="p-2 overflow-hidden border-l border-gray-400">
                    {label}
                    <div onMouseDown={(e) => {
                        e.preventDefault();
                        startResize(i + 1, e.clientX);
                      }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-400" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedDues.map(due => {
                  const outstanding = due.amount_due - due.amount_paid;
                  const isSelected = selectedIds.has(due.id);

                  return (
                    <tr key={due.id} className={`border-b border-gray-400 transition-colors duration-150 ${isSelected ? 'bg-blue-200 hover:bg-blue-100' : 'hover:bg-gray-100'}`}>
                      <td className='p-2 border-l border-gray-400 text-center' style={{width: widths[0]}}>
                        <input type="checkbox" name="selectRow" id="selectRow" checked={selectedIds.has(due.id)} onChange={() => toggleSelect(due.id)} />
                      </td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[1] }}>{due.units?.code}</td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[2] }}>{formatPeriod(due.period, false)}</td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[3] }}>{formatRupiah(due.amount_due)}</td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[4] }}>{formatRupiah(due.amount_paid)}</td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[5] }}>
                        {formatRupiah(outstanding)}
                        {outstanding > 0 && (
                          <span className="text-red-500 text-xs ml-1">(kurang bayar)</span>
                        )}
                        {outstanding < 0 && (
                          <span className="text-green-600 text-xs ml-1">(lebih bayar)</span>
                        )}
                      </td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[6] }}>{due.status.charAt(0).toUpperCase() + due.status.slice(1)}</td>
                      <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[7] }}>{due.note}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>

          {/* Pagination controls */}
          {(() => {
            const totalPages = Math.max(1, Math.ceil(filteredDues.length / PAGE_SIZE));

            return (<>
              <div className="flex items-center justify-center gap-3 mt-4 text-sm">
                <button onClick={() => setPage(1)} disabled={page === 1} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:hover:bg-white hover:bg-gray-200 transition duration-150 ease-in-out'><ChevronsLeft /></button>

                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:hover:bg-white hover:bg-gray-200 transition duration-150 ease-in-out'><ChevronLeft /></button>

                <span>Halaman {page} dari {totalPages}</span>

                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:hover:bg-white hover:bg-gray-200 transition duration-150 ease-in-out'><ChevronRight /></button>

                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className='px-3 py-1 border border-gray-300 rounded disabled:opacity-40 disabled:hover:bg-white hover:bg-gray-200 transition duration-150 ease-in-out'><ChevronsRight /></button>
              </div>
         </>);
          })()}
        </div>
      </div>
    </div>
  </>);
}