import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { TransactionForm } from '../components/TransactionForm';
import { Link } from 'react-router-dom';
import { DueForm, type EditableDue } from '../components/Dueform';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { Modal } from '../components/Modal';

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

  function formatRupiah(value: number) {
    return Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  }

  function formatPeriod(period: string) {
    const [year, month] = period.split('-');
    const monthName = new Date(2000, Number(month) - 1).toLocaleString('id-ID', { month: "long" });
    return `${monthName}, ${year}`;
  }

  async function handleDelete(due: Due) {
    const confirmed = window.confirm(
      due.amount_paid > 0 
        ? `Tagihan ${due.units?.code} periode ${formatPeriod(due.period)} sudah ada pembayaran (${formatRupiah(due.amount_paid)}). Hapus tetap akan melepas alokasi pembayaran itu (uangnya tidak hilang, tapi jadi belum teralokasi lagi). Lanjut hapus?`
        : `Hapus tagihan ${due.units?.code} periode ${formatPeriod(due.period)}?`
    );
    if (!confirmed) return;

    const {error} = await supabase.from('ipl_dues').delete().eq('id', due.id);
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
    <div className="max-w-5xl mx-auto mt-10 font-sans pb-16">
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
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
          <button onClick={() => setTransactionModalOpen(true)} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700'>+ Transaksi</button>
          <button onClick={() => {
            setEditingDue(null);
            setDueModalOpen(true);
          }} className='bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700'>+ Tagihan</button>
          <Link to="/rekap" className="text-blue-600 hover:text-blue-700 underline">Rekap Tahunan</Link>
          <Link to="/mutasi" className="text-blue-600 hover:text-blue-700 underline">Lihat Mutasi Bank</Link>
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

      <div className="flex gap-2 mb-3 justify-center">
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
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[1] }}>{formatPeriod(due.period)}</td>
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
                  <td className="border-l border-gray-400 p-2 truncate" style={{ width: widths[5] }}>{due.status}</td>
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