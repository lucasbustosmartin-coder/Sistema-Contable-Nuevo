import React, { useState } from 'react';
import { supabase } from '../services/supabase';

// Iconos únicos, sobrios, solo con trazo (stroke), sin relleno
const icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12h19.5m-19.5 0a2.25 2.25 0 0 1-2.25-2.25V6.75a2.25 2.25 0 0 1 2.25-2.25h19.5a2.25 2.25 0 0 1 2.25 2.25v3.089a2.25 2.25 0 0 1-.58 1.492l-3.342 3.341a2.25 2.25 0 0 1-1.492.58h-3.089m3.089-4.5h.008v.008h-.008v-.008Zm0 3.75h.008v.008h-.008v-.008Zm0 3.75h.008v.008h-.008v-.008Zm0 3.75h.008v.008h-.008v-.008Z" />
    </svg>
  ),
  financialStatements: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.305 4.305a1.125 1.125 0 0 0 1.995 0L19.5 7.5l-2.694-2.694a1.125 1.125 0 0 0-1.995 0L8.75 11.25l-4.305-4.305a1.125 1.125 0 0 0-1.995 0L2.25 18Z" />
    </svg>
  ),
  tipoCambio: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <circle cx="12" cy="12" r="8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
    </svg>
  ),
  rubrosManager: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  conceptsManager: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
    </svg>
  ),
  entradasContables: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  ),
  newDay: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  excelExport: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  signOut: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM9.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    </svg>
  ),
  collapse: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  ),
  expand: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  ),
};

export default function Sidebar({ currentView, setCurrentView, user }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err) {
      console.error('Error al cerrar sesión:', err.message);
    }
  };

  const navItems = [
    { name: 'Dashboard', view: 'dashboard', icon: icons.dashboard },
    { name: 'Estados Financieros', view: 'estados-financieros', icon: icons.financialStatements },
    { name: 'Tipo de Cambio', view: 'tipo-cambio', icon: icons.tipoCambio },
    { name: 'Gestionar Rubros', view: 'rubros', icon: icons.rubrosManager },
    { name: 'Gestionar Conceptos', view: 'conceptos', icon: icons.conceptsManager },
    { name: 'Editar Registro Diario', view: 'entradas-contables', icon: icons.entradasContables },
    { name: 'Registrar Nuevo Día', view: 'crear-nuevo-dia', icon: icons.newDay },
    { name: 'Exportar a Excel', view: 'exportar-excel', icon: icons.excelExport },
  ];

  return (
    <div className={`transition-width duration-300 ease-in-out bg-white shadow-lg flex flex-col border-r border-gray-200 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-4 border-b border-gray-200 flex items-center justify-between ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
        >
          {isCollapsed ? icons.expand : icons.collapse}
        </button>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-2">
        {navItems.map((item) => (
          <div 
            key={item.view}
            className={`
              px-3 py-2 rounded-md transition-colors duration-150 ease-in-out cursor-pointer hover:bg-gray-100
              flex items-center space-x-3
              ${currentView === item.view ? 'text-gray-700 font-semibold bg-gray-100' : 'text-gray-600'}
            `}
            onClick={() => setCurrentView && setCurrentView(item.view)}
          >
            <div className="text-gray-500">{item.icon}</div>
            {!isCollapsed && <span className="text-sm">{item.name}</span>}
          </div>
        ))}
      </nav>

      <div className={`p-4 border-t border-gray-200 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-base font-medium flex-shrink-0">
            {user.email?.[0]?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-800 truncate">{user.email}</p>
              <button 
                onClick={handleSignOut}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors duration-150 ease-in-out"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
