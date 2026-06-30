import { useEffect, useState, type SyntheticEvent } from "react";
import { supabase } from "../lib/supabase";

type Category = {
  id: string;
  name: string;
  direction: 'masuk' | 'keluar';
  requires_unit: boolean;
};

type Unit = {
  id: string;
  code: string;
};

export type EditableTransaction = {
  id: string;
  transaction_date: string;
  category_id: string;
  unit_id: string | null;
  amount: number;
  description: string | null;
  auto_allocate: boolean;
}

type Props = {
  tx: EditableTransaction;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditTransactionForm({ tx, onSuccess, onCancel }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [categoryId, setCategoryId] = useState(tx.category_id);
  const [unitId, setUnitId] = useState(tx.unit_id ?? '');
  const [date, setDate] = useState(tx.transaction_date);
  const [amount, setAmount] = useState(String(tx.amount));
  const [description, setDescription] = useState(tx.description ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      .then(({data}) => setUnits(data ?? []))
  }, []);

  const selectedCategory = categories.find(c => c.id === categoryId);

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!categoryId || !date || !amount) {
      setError('Lengkapi semua field!');
      return;
    }

    if (selectedCategory?.requires_unit && !unitId) {
      setError('Kategori ini wajib pilih unit.');
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.rpc('update_transaction', {
      p_id: tx.id,
      p_transaction_date: date,
      p_category_id: categoryId,
      p_unit_id: selectedCategory?.requires_unit ? unitId : null,
      p_amount: Number(amount),
      p_description: description || null,
    });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    onSuccess();
  }

  return (
    <form action="" onSubmit={handleSubmit} className="p-4">
      <h3 className="font-semibold mb-3">Edit Transaksi</h3>

      {tx.auto_allocate === false && (
        <p className="text-amber-600 text-sm mb-2">
          Transaksi ini perlu alokasi manual. Edit akan menghapus alokasi lama, dan anda perlu alokasikan ulang manual lewat form transaksi.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <select name="select-category" id="select-category" value={categoryId} onChange={e => setCategoryId(e.target.value)} className="border border-gray-300 rounded px-3 py-2">
          {categories.map(c => (
            <option value={c.id} key={c.id}>{c.name} ({c.direction})</option>
          ))}
        </select>

        {selectedCategory?.requires_unit && (
          <select name="select-unit" id="select-unit" value={unitId} onChange={e => setUnitId(e.target.value)} className="border border-gray-300 rounded px-3 py-2">
            <option value="">Pilih unit</option>
            {units.map(u => (
              <option value={u.id} key={u.id}>
                {u.code}
              </option>
            ))}
          </select>
        )}

        <input type="date" name="select-date" id="select-date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />

        <input type="number" name="input-amount" id="input-amount" value={amount} placeholder="Nominal" onChange={e => setAmount(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />

        <input type="text" name="input-description" id="input-description" value={description} onChange={e => setDescription(e.target.value)} className="border border-gray-300 rounded px-3 py-2" />

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="bg-gray-900 text-white rounded px-3 py-2 hover:bg-gray-700 disabled:opacity-50">{submitting ? 'Menyimpan...' : 'Update'}</button>

          <button type="button" onClick={onCancel} className="bg-gray-200 rounded px-3 py-2 hover:bg-gray-300">Batal</button>
        </div>
      </div>
    </form>
  )
}