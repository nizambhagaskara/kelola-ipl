import { useEffect, useState, type SyntheticEvent } from "react";
import { supabase } from "../lib/supabase";

type Category = {
  id: string;
  name: string;
  direction: "masuk" | "keluar";
  requires_unit: boolean;
}

type Unit = {
  id: string;
  code: string;
}

type OutstandingDue = {
  id: string;
  period: string;
  outstanding: number;
}

function formatPeriod(period: string) {
  const [year, month] = period.split('-');
  const monthName = new Date(2000, Number(month) - 1).toLocaleString('id-ID', { month: "long" });

  return `${monthName}, ${year}`;
}

export function TransactionForm({onSuccess}: {onSuccess: () => void}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [allocationMode, setAllocationMode] = useState<'auto' | 'manual'>('auto');
  const [outstandingDues, setOutstandingDues] = useState<OutstandingDue[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase
      .from('account_categories')
      .select('id, name, direction, requires_unit')
      .order('name')
      .then(({data}) => setCategories(data ?? []));

    supabase
      .from('units')
      .select('id, code')
      .order('code')
      .then(({data}) => setUnits(data ?? []));
  }, []);

  const selectedCategory = categories.find(c => c.id === categoryId);

  useEffect(() => {
    if(allocationMode !== 'manual' || !unitId) return;

    let canceled = false;

    supabase
      .from('ipl_dues')
      .select('id, period, amount_due, amount_paid')
      .eq('unit_id', unitId)
      .order('period')
      .then(({data}) => {
        if (canceled) return;

        const outstanding = (data ?? [])
          .map(d => ({
            id: d.id,
            period: d.period,
            outstanding: d.amount_due - d.amount_paid
          }))
          .filter(d => d.outstanding > 0);
        setOutstandingDues(outstanding);
      });
    
    return () => { canceled = true };
  }, [unitId, allocationMode]);

  function toggleDue(due: OutstandingDue, checked: boolean) {
    setAllocations(prev => {
      const next = {...prev};
      if (checked) {
        next[due.id] = String(due.outstanding);
      } else {
        delete next[due.id];
      }
      return next;
    });
  }

  function updateAllocationAmount(dueId: string, value: string) {
    setAllocations(prev => ({...prev, [dueId]: value}));
  }

  const totalAllocated = Object.values(allocations).reduce(
    (sum, v) => sum + (Number(v) || 0),
    0
  );

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!categoryId || !date || !amount) {
      setError('Lengkapi semua kolom!');
      return;
    }

    if (selectedCategory?.requires_unit && !unitId) {
      setError('Kategori ini wajib pilih unit!');
      return;
    }

    const isManual = selectedCategory?.requires_unit && allocationMode === 'manual';

    if (isManual) {
      if (Object.keys(allocations).length === 0) {
        setError('Pilih minimal 1 bulan untuk dialokasikan');
        return;
      }
      if(totalAllocated > Number(amount)) {
        setError('Total alokasi tidak boleh lebih besar dari nominal transfer');
        return;
      }
    }

    setSubmitting(true);

    const {data: insertedTx, error: txError} = await supabase.from('bank_transactions').insert({
      transaction_date: date,
      category_id: categoryId,
      unit_id: selectedCategory?.requires_unit ? unitId : null,
      direction: selectedCategory?.direction,
      amount: Number(amount),
      auto_allocate: !isManual,
    }).select('id').single();

    if(txError || !insertedTx) {
      setSubmitting(false);
      setError(txError?.message ?? 'Gagal menyimpan transaksi');
      return;
    }

    if (isManual) {
      const rows = Object.entries(allocations)
        .filter(([, value]) => Number(value) > 0)
        .map(([ipl_due_id, value]) => ({
          transaction_id: insertedTx.id,
          ipl_due_id,
          amount: Number(value),
        }));
      
      const {error: allocError} = await supabase
        .from('payment_allocations')
        .insert(rows);

      if (allocError) {
        setSubmitting(false);
        setError('Transaksi tersimpan, tapi alokasi gagal: ' + allocError.message);
        return;
      }
    }

    setSubmitting(false);

    // reset form
    setCategoryId('');
    setUnitId('');
    setDate('');
    setAmount('');
    setAllocationMode('auto');
    setAllocations({});
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold mb-3">Tambah Transaksi</h3>

      <div className="flex flex-col gap-2">
        <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="border border-gray-300 rounded px-3 py-2 cursor-pointer" name="categoryId">
          <option value="">Pilih Kategori</option>
          {categories.map(c => (
            <option value={c.id} key={c.id}>
              {`${c.name} (${c.direction})`}
            </option>
          ))}
        </select>

        {selectedCategory?.requires_unit && (
          <select value={unitId} onChange={e => {
            setUnitId(e.target.value);
            setAllocations({});
          }} className="border border-gray-300 rounded px-3 py-2 cursor-pointer" name="unitId">
            <option value="">Pilih Unit</option>
            {units.map(u => (
              <option value={u.id} key={u.id}>{u.code}</option>
            ))}
          </select>
        )}

        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2 cursor-pointer"/>
        
        <input type="number" placeholder="Nominal" value={amount} onChange={e => setAmount(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />

        {selectedCategory?.requires_unit && (
          <div className="flex flex-col gap-2 text-sm py-3">
            <label htmlFor="autoAllocationMode" className="flex items-center gap-1">
              <input type="radio" name="autoAllocationMode" id="autoAllocationMode" checked={allocationMode === 'auto'} onChange={() => {
                setAllocationMode('auto');
                setAllocations({});
              }} />
              Auto (melunasi tagihan dari bulan paling lama)
            </label>
            <label htmlFor="manualAllocationMode" className="flex items-center gap-1">
              <input type="radio" name="manualAllocationMode" id="manualAllocationMode" checked={allocationMode === 'manual'} onChange={() => {
                setAllocationMode('manual');
                setAllocations({});
              }} />
              Pilih bulan manual
            </label>
          </div>
        )}

        {selectedCategory?.requires_unit && allocationMode === 'manual' && (
          <div className="border border-gray-200 rounded p-3">
            {!unitId && (
              <p className="text-sm text-gray-500">Pilih unit dulu buat lihat tagihan outstanding.</p>
            )}

            {unitId && outstandingDues.length === 0 && (
              <p className="text-sm text-gray-500">Tidak ada tagihan outstanding buat unit ini.</p>
            )}

            {outstandingDues.map(due => {
              const checked = due.id in allocations;

              return (
                <div key={due.id} className="flex items-center gap-2 mb-1">
                  <input type="checkbox" name="toggleDue" id="toggleDue" checked={checked} onChange={e => toggleDue(due, e.target.checked)} className="cursor-pointer" />
                  <span className="text-sm flex-1">
                    {formatPeriod(due.period)} (outstanding: Rp{due.outstanding.toLocaleString('id-ID')})
                  </span>
                  {checked && (
                    <input type="number" name="updateAllocationAmount" id="updateAllocationAmount" value={allocations[due.id]} onChange={e => updateAllocationAmount(due.id, e.target.value)} max={due.outstanding} className="border border-gray-300 rounded px-2 py-1 w-28 text-sm" />
                  )}
                </div>
              )
            })}

            {Object.keys(allocations).length > 0 && (
              <p className="text-sm mt-2">
                Total dialokasikan: Rp{totalAllocated.toLocaleString('id-ID')} dari Rp{(Number(amount) || 0).toLocaleString('id-ID')} ditransfer {totalAllocated < Number(amount) && (
                  <span className="text-gray-500"> (sisanya nunggu tagihan baru)</span>
                )}
              </p>
            )}
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={submitting} className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 disabled:opacity-50">
          {submitting ? 'Menyimpan' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}