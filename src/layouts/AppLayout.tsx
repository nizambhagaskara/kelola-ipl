import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <aside className="hidden lg:block fixed top-0 left-0 h-screen w-56 border-r border-gray-200 bg-white overflow-y-auto">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-white h-full border-r border-gray-200 overflow-y-auto">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
        <span className="font-bold">KelolaIPL</span>

        <button onClick={() => setMobileOpen(true)} className="px-3 py-1 border border-gray-300 rounded">Menu</button>
      </div>

      <main className="lg:ml-56 p-4">
        <Outlet />
      </main>
    </div>
  )
}