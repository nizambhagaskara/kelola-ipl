import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { 
  ArrowOutRightSquareHalf,
  Dashboard,
  Receipt,
  CalendarAlt,
  PlusSquare,
  Trash
} from "@boxicons/react";


type CronLog = {
  status: 'success' |  'error';
  message: string | null;
  run_at: string;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();

  const [cronLog, setCronLog] = useState<CronLog | null>(null);

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

  const links = [
    { to: '/',        label: 'Dashboard',         icon: Dashboard, end: true },
    { to: '/mutasi',  label: 'Mutasi Bank',       icon: Receipt              },
    { to: '/rekap',   label: 'Rekap Tahunan',     icon: CalendarAlt          },
    { to: '/import',  label: 'Import Transaksi',  icon: PlusSquare           },
    { to: '/sampah',  label: 'Sampah',            icon: Trash                },
  ];

  return (
    <nav className="flex flex-col gap-1 p-4 h-full">
      <h1 className="font-bold text-lg mb-4 px-2">KelolaIPL</h1>

      <div className="flex flex-col gap-1 flex-1">
        {links.map(link => {
          const Icon = link.icon;

          return (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={onNavigate} className={({isActive}) => `px-3 py-2 rounded text-sm font-medium flex gap-1 ${isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`
            }>
              <Icon className="scale-90"/>
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </div>

      {cronLog && (
        <p className='text-xs'>
          Auto-generate tagihan:{' '}
          <span className={cronLog.status === 'success' ? 'text-green-600' : 'text-red-600'}>
            {cronLog.status === 'success' ? 'OK' : 'Error'}
          </span>
          {' '}— terakhir jalan {new Date(cronLog.run_at).toLocaleString('id-ID')}
          {cronLog.status === 'error' && `: ${cronLog.message}`}
        </p>
      )}
      
      <div className="border-t border-gray-200 pt-3 mt-3">
        <p className="text-xs text-gray-500 truncate px-2 mb-2">{session?.user.email}</p>

        <button onClick={handleLogout} className="flex text-left px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 gap-1">
          <ArrowOutRightSquareHalf className="scale-90" />
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </nav>
  )
}