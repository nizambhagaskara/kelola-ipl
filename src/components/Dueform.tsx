import { useEffect, useState, type SyntheticEvent } from "react";
import { supabase } from "../lib/supabase";

type Unit = {
  id: string;
  code: string;
}

export type EditableDue = {
  id: string;
  unit_id: string;
  period: string;
  amount_due: number;
  status: 'normal' | 'kosong' | 'lainnya';
  note: string | null;
}

type Props = {
  editingDue: EditableDue | null;
  onSuccess: () => void;
  onCancelEdit: () => void;
}

export function DueForm({editingDue, onSuccess, onCancelEdit}: Props) {
  const [units, setUnits] = useState<Unit[]>([]);

  const [unitId, setUnitId] = useState(editingDue?.unit_id ?? '');
  const [month, setMonth] = useState(editingDue ? Number(editingDue.period.slice(5, 7)) : 1);
  const [year, setYear] = useState(editingDue ? Number(editingDue.period.slice(0, 4)) : new Date().getFullYear());
  const [amountDue, setAmountDue] = useState(
    editingDue ? String(editingDue.amount_due) : ''
  );
  const [status, setStatus] = useState<'normal' | 'kosong' | 'lainnya'>(editingDue?.status ?? 'normal');
  const [note, setNote] = useState(editingDue?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEditing = editingDue !== null;

  useEffect(() => {
    supabase
      .from('units')
      .select('id, code')
      .order('code')
      .then(({data}) => setUnits(data ?? []));
  }, []);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if(!unitId || !amountDue) {
      setError('Lengkapi semua field!');
      return;
    }
    
    const periodStr = `${year}-${String(month).padStart(2, '0')}-01`;

    setSubmitting(true);

    if(isEditing) {
      const {error} = await supabase
        .from('ipl_dues')
        .update({
          amount_due: Number(amountDue),
          status,
          note: note || null,
        })
        .eq('id', editingDue.id);

      setSubmitting(false);

      if(error) {
        setError(error.message);
        return;
      }
    } else {
      const {error} = await supabase.from('ipl_dues').insert({
        unit_id: unitId,
        period: periodStr,
        amount_due: Number(amountDue),
        status,
        note: note || null,
      });

      setSubmitting(false);

      if (error) {
        if (error.code === '23505') {
          setError('Tagihan untuk unit & periode ini sudah ada. Edit yang sudah ada saja.');
        } else {
          setError(error.message);
        }
        return;
      }
    }
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold mb-3">
        {isEditing ? 'Edit Tagihan' : 'Tambah Tagihan'}
      </h3>

      <div className="flex flex-col gap-2">
        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} disabled={isEditing} className="border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100" name="unitId">
          <option value="">Pilih unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            disabled={isEditing}
            className="border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 flex-1"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            disabled={isEditing}
            className="border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100 flex-1"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <input
          type="number"
          placeholder="Nominal tagihan"
          value={amountDue}
          onChange={(e) => setAmountDue(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />

        <select value={status} onChange={(e) => setStatus(e.target.value as 'normal' | 'kosong' | 'lainnya')} className="border border-gray-300 rounded px-3 py-2" name="status">
          <option value="normal">Normal</option>
          <option value="kosong">Rumah kosong</option>
          <option value="lainnya">Lainnya</option>
        </select>

        <input
          type="text"
          placeholder="Catatan (opsional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2"
        />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 disabled:opacity-50" >
            {submitting ? 'Menyimpan...' : isEditing ? 'Update' : 'Simpan'}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="bg-gray-200 rounded px-3 py-2 hover:bg-gray-300"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </form>
  );
}