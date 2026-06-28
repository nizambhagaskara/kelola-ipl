import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useResizableColumns } from "../hooks/useResizableColumns";

type SummaryRow = {
  unit_code: string;
  year: number;
  total_proyeksi: number;
  total_realisasi: number;
  outstanding: number;
}

export default function RekapTahunan() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState('');

  const {widths, startResize} = useResizableColumns([100, 80, 130, 130, 130]);

  useEffect(() => {
    async function load() {
      const {data, error} = await supabase
        .from('v_ipl_summary')
        .select('*')
        .order('year')
        .order('unit_code');

      if (error) setFetchError(error.message);
      else setRows((data as SummaryRow[]) ?? []);
    }

    load();
  }, []);

  function formatRupiah(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  }

  const availableYears = Array.from(new Set(rows.map(r => r.year))).sort();

  const filteredRows = rows.filter(r => filterYear ? String(r.year) === filterYear : true);

  const totals = filteredRows.reduce(
    (acc, r) => ({
      proyeksi: acc.proyeksi + r.total_proyeksi,
      realisasi: acc.realisasi + r.total_realisasi,
      outstanding: acc.outstanding + r.outstanding,
    }),
    {
      proyeksi: 0,
      realisasi: 0,
      outstanding: 0
    }
  );

  return (
    <div className="max-w-4xl mx-auto mt-10 font-sans pb-16">
      <div className="flex justify-between items-center mb-4">
        <h1 className="font-semibold text-lg">Rekap Tahunan</h1>
        <Link to="/" className="text-blue-600 hover:text-blue-700 underline">Kembali ke Dashboard</Link>
      </div>

      {fetchError && <p className="text-red-600">Gagal fetch: {fetchError}</p>}

      <select name="filterYear" id="filterYear" value={filterYear} onChange={e => setFilterYear(e.target.value)} className="border border-gray-300 rounded px-3 py-2 text-sm mb-3">
        <option value="">Semua tahun</option>
        {availableYears.map(y => (
          <option value={y} key={y}>
            {y}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto">
        <table className='border-collapse text-sm mx-auto table-fixed' style={{width: widths.reduce((a, b) => a + b, 0)}}>
          <thead>
            <tr className="text-left">
              {['Blok', 'Tahun', 'Total Proyeksi', 'Total Realisasi', 'Outstanding'].map(
                (label, i) => (
                  <th key={label} className="relative p-2 overflow-hidden border-r border-gray-400" style={{width: widths[i]}}>
                    {label}
                    <div onMouseDown={e => {
                      e.preventDefault();
                      startResize(i, e.clientX);
                    }} className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-gray-400" />
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(r => (
              <tr key={`${r.unit_code}-${r.year}`} className="border-b border-gray-200">
                <td className="border-r border-gray-300 p-2 truncate" style={{width: widths[0]}}>{r.unit_code}</td>
                <td className="border-r border-gray-300 p-2 truncate" style={{width: widths[1]}}>{r.year}</td>
                <td className="border-r border-gray-300 p-2 truncate" style={{width: widths[2]}}>
                  {formatRupiah(r.total_proyeksi)}
                </td>
                <td className="border-r border-gray-300 p-2 truncate" style={{width: widths[3]}}>
                  {formatRupiah(r.total_realisasi)}
                </td>
                <td className="p-2 truncate" style={{width: widths[4]}}>
                  {formatRupiah(r.outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-500 font-semibold">
              <td className="border-r border-gray-300 p-2" style={{width: widths[0]}}></td>
              <td className="border-r border-gray-300 p-2 truncate" style={{width: widths[1]}}>Total</td>
              <td className="border-r border-gray-300 p-2" style={{width: widths[2]}}>
                {formatRupiah(totals.proyeksi)}
              </td>
              <td className="border-r border-gray-300 p-2" style={{width: widths[3]}}>
                {formatRupiah(totals.realisasi)}
              </td>
              <td className="p-2" style={{width: widths[4]}}>
                {formatRupiah(totals.outstanding)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}