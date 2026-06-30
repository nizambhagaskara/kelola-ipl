import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TransactionForm } from '../components/TransactionForm';
import { Link } from 'react-router-dom';
import { DueForm, type EditableDue } from '../components/Dueform';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { Modal } from '../components/Modal';
import formatRupiah from '../helpers/formatRupiah';
import formatPeriod from '../helpers/formatPeriod';

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

type CronLog = {
  status: 'success' |  'error';
  message: string | null;
  run_at: string;
}

export default function Dashboard() {
  const { session } = useAuth();
  const [dues, setDues] = useState<Due[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const [editingDue, setEditingDue] = useState<EditableDue | null>(null);
  
  const {widths, startResize} = useResizableColumns([70, 110, 120, 120, 170, 100, 80, 80]);
  
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [dueModalOpen, setDueModalOpen] = useState(false);
  
  const [filterUnit, setFilterUnit] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  
  const [cronLog, setCronLog] = useState<CronLog | null>(null);

  const availableUnits = Array.from(
    new Set(dues.map(d => d.units?.code).filter(Boolean))
  ).sort() as string[];
  
  const availableYears = Array.from(
    new Set(dues.map(d => d.period.slice(0, 4)))
  ).sort();
  
  const filteredDues = dues.filter(due => {
    if (filterUnit && due.units?.code !== filterUnit) return false;
    if (filterYear && due.period.slice(0, 4) !== filterYear) return false;
    if (filterMonth && due.period.slice(5, 7) !== filterMonth) return false;
    return true;
  })

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('ipl_dues')
        .select('id, unit_id, period, amount_due, amount_paid, status, note, units(code)')
        .is('deleted_at', null)
        .order('period');

      if (error) {
        setFetchError(error.message);
      } else {
        setDues((data as unknown as Due[]) ?? []);
      }
    }

    load();
  }, [refreshKey]);

  useEffect(() => {
    supabase
      .from('cron_job_logs')
      .select('status, message, run_at')
      .eq('job_name', 'generate_monthly_dues')
      .order('run_at', { ascending: false })
      .limit(1)
      .then(({data}) => {
        if (data && data.length > 0) setCronLog(data[0] as CronLog);
      });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleDelete(due: Due) {
    const confirmed = window.confirm(
      `Hapus tagihan ${due.units?.code} periode ${formatPeriod(due.period)}? (Bisa direstore dari halaman Sampah)`
    );
    if (!confirmed) return;

    const {error} = await supabase
      .from('ipl_dues')
      .update({deleted_at: new Date().toISOString()})
      .eq('id', due.id);

    if (error) {
      alert('Gagal hapus: ' + error.message);
      return;
    }
    setRefreshKey(k => k + 1);
  }

  function startEdit(due: Due) {
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

  return (<>
    <div className="max-w-6xl mx-auto mt-4 sm:mt-10 font-sans pb-16">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-2 mb-4 px-4">
        <div className='block'>
          <p>Login sebagai: {session?.user.email}</p>
          {cronLog && (
            <p className='text-xs mb-3'>
              Auto-generate tagihan:{' '}
              <span className={cronLog.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                {cronLog.status === 'success' ? 'OK' : 'Error'}
              </span>
              {' '}— terakhir jalan {new Date(cronLog.run_at).toLocaleString('id-ID')}
              {cronLog.status === 'error' && `: ${cronLog.message}`}
            </p>
          )}
        </div>
        <div className="flex flex-col text-sm md:text-base min-[700px]:flex-row gap-4 min-[700px]:items-center">
          <button onClick={() => setTransactionModalOpen(true)} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700'>+ Transaksi</button>
          <button onClick={() => {
            setEditingDue(null);
            setDueModalOpen(true);
          }} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700'>+ Tagihan</button>
          <div className='flex flex-col min-[700px]:flex-row text-white gap-4 font-semibold text-center'>
            <Link to="/rekap" className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-2">Rekap Tahunan</Link>
            <Link to="/mutasi" className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-2">Lihat Mutasi Bank</Link>
            <Link to="/sampah" className="bg-blue-600 hover:bg-blue-700 rounded px-3 py-2">Sampah</Link>
          </div>
          <button onClick={handleLogout} className="bg-gray-200 rounded px-3 py-2 hover:bg-gray-300">Logout</button>
        </div>
      </div>

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
    </div>

    <div className='w-full'>
      <h2 className="font-semibold mb-2 text-center">Daftar Tagihan IPL</h2>
      {fetchError && <p className="text-red-600 text-center">Gagal fetch: {fetchError}</p>}

      <div className="flex gap-2 mb-3 justify-center flex-wrap">
        <select name="filterUnit" id="filterUnit" value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua unit</option>
          {availableUnits.map(code => (
            <option value={code} key={code}>{code}</option>
          ))}
        </select>

        <select name="filterMonth" id="filterMonth" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua bulan</option>
          {Array.from({length: 12}, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
            <option value={m} key={m}>
              {new Date(2000, Number(m) - 1).toLocaleString('id-ID', {month: 'long'})}
            </option>
          ))}
        </select>

        <select name="filterYear" id="Year" value={filterYear} onChange={e => setFilterYear(e.target.value)} className='border border-gray-300 rounded px-3 py-2 text-sm'>
          <option value="">Semua tahun</option>
          {availableYears.map(year => (
            <option value={year} key={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto pb-24">
        <table className="border-collapse text-sm mx-auto mt-8 table-fixed" style={{width: widths.reduce((a, b) => a + b, 0)}}>
          <thead>
            <tr className="text-left">
              {['Blok', 'Periode', 'Proyeksi', 'Realisasi', 'Outstanding', 'Status', 'Catatan', ''].map((label, i) => (
                <th key={label || i} style={{ width: widths[i], position: 'relative' }} className="p-2 overflow-hidden border-l border-gray-400">
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
            {filteredDues.map(due => {
              const outstanding = due.amount_due - due.amount_paid;

              return (
                <tr key={due.id} className="border-b border-gray-400">
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[0] }}>{due.units?.code}</td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[1] }}>{formatPeriod(due.period, false)}</td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[2] }}>{formatRupiah(due.amount_due)}</td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[3] }}>{formatRupiah(due.amount_paid)}</td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[4] }}>
                    {formatRupiah(outstanding)}
                    {outstanding > 0 && (
                      <span className="text-red-500 text-xs ml-1">(kurang bayar)</span>
                    )}
                    {outstanding < 0 && (
                      <span className="text-green-600 text-xs ml-1">(lebih bayar)</span>
                    )}
                  </td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[5] }}>{due.status.charAt(0).toUpperCase() + due.status.slice(1)}</td>
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[6] }}>{due.note}</td>
                  <td className="border-l border-gray-400 p-2" style={{ width: widths[7] }}>
                    <button onClick={() => startEdit(due)} className="text-blue-600 hover:underline text-xs">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(due)} className='text-red-600 hover:underline text-xs ml-2'>
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  </>);
}