import React, { useState } from 'react';
import { supabase } from '../services/supabase';

// Iconos únicos y uniformes con un grosor de trazo de 1.5
const icons = {
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 0a2.25 2.25 0 0 0 2.25 2.25h12.75a2.25 2.25 0 0 0 2.25-2.25M3.75 12a2.25 2.25 0 0 1 2.25-2.25h12.75a2.25 2.25 0 0 1 2.25 2.25m-16.5 0v2.25a2.25 2.25 0 0 0 2.25 2.25h12.75a2.25 2.25 0 0 0 2.25-2.25V12" />
    </svg>
  ),
  financialStatements: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125a7.5 7.5 0 0 1 15 0m-12.75-3.75h1.5a2.25 2.25 0 0 0 0-4.5h-.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 12.75v6.75a3 3 0 0 1-3 3h-.75a3 3 0 0 1-3-3v-6.75h-.75a3.75 3.75 0 0 0-3.75 3.75v1.5c0 2.07 1.68 3.75 3.75 3.75h.75a3.75 3.75 0 0 0 3.75-3.75v-1.5c0-2.07-1.68-3.75-3.75-3.75h-.75a.75.75 0 0 0-.75.75v1.5h.75" />
    </svg>
  ),
  tipoCambio: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 9.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 15.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
    </svg>
  ),
  rubrosManager: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5l6-6 6 6m6 0h-6V3.75A2.25 2.25 0 0 0 16.5 1.5h-.75a.75.75 0 0 0-.75.75v1.5m-6 3.75L3 18.75m0 0l6-6-6 6h18v-6h-6m-12 0v-2.25a2.25 2.25 0 0 0-2.25-2.25h-.75a.75.75 0 0 0-.75.75v1.5m12 3.75L21 9.75M9.75 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM15.75 1.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  ),
  conceptsManager: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  entradasContables: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.28-8.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.28-8.28Zm-3.75-2.25a.75.75 0 0 0-.75-.75h-.75a.75.75 0 0 0-.75.75v.75a.75.75 0 0 0 .75.75h.75a.75.75 0 0 0 .75-.75v-.75Z" />
    </svg>
  ),
  newDay: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  excelExport: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  activos: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  signOut: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM9.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
    </svg>
  ),
  collapse: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </svg>
  ),
  expand: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  ),
};

export default function Sidebar({ currentView, setCurrentView, user }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.reload(); 
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
    { name: 'Mis Activos', view: 'activos', icon: icons.activos },
  ];

  return (
    <div className={`transition-all duration-300 ease-in-out bg-white shadow-lg flex flex-col h-full border-r border-gray-200 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors duration-150"
        >
          {isCollapsed ? icons.expand : icons.collapse}
        </button>
      </div>
      
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <div 
            key={item.view}
            className={`
              px-3 py-2 rounded-md transition-colors duration-150 ease-in-out cursor-pointer
              flex items-center space-x-3
              ${currentView === item.view ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700'}
            `}
            onClick={() => setCurrentView && setCurrentView(item.view)}
          >
            <div className={`flex-shrink-0 ${currentView === item.view ? 'text-indigo-600' : 'text-gray-500'}`}>{item.icon}</div>
            {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
          </div>
        ))}
      </nav>

      <div className={`p-4 border-t border-gray-200 ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-base font-medium flex-shrink-0">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          {!isCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.email}</p>
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