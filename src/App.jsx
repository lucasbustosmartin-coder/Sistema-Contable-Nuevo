import { useState, useEffect } from 'react';
import { supabase } from './services/supabase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import EstadosFinancierosManager from './components/EstadosFinancierosManager';
import TipoCambioManager from './components/TipoCambioManager';
import RubrosManager from './components/RubrosManager';
import ConceptosContablesManager from './components/ConceptosContablesManager';
import EntradasContablesManager from './components/EntradasContablesManager';
import CreateNewDayManager from './components/CreateNewDayManager';
import ExcelExporterManager from './components/ExcelExporterManager';
import ActivosManager from './components/ActivosManager';
import Portfolios from './components/portfolios/Portfolios';
import PortfolioDetail from './components/portfolios/PortfolioDetail';
import Sidebar from './components/Sidebar';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState({ type: 'dashboard' });
  const [loading, setLoading] = useState(true);
  const [updateMessage, setUpdateMessage] = useState(null);
  // ✅ NUEVO: Estado para guardar la moneda seleccionada por cada portafolio
  const [portfolioCurrencies, setPortfolioCurrencies] = useState({});

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    }
    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, []);

  const handleViewChange = (viewType, portfolioId = null, selectedCurrency = null) => {
    setCurrentView({
      type: viewType,
      portfolioId,
      selectedCurrency
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700">Cargando...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  let currentComponent;
  switch (currentView.type) {
    case 'dashboard':
      currentComponent = <Dashboard user={user} setCurrentView={handleViewChange} />;
      break;
    case 'estados-financieros':
      currentComponent = <EstadosFinancierosManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'tipo-cambio':
      currentComponent = <TipoCambioManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'rubros':
      currentComponent = <RubrosManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'conceptos-contables':
      currentComponent = <ConceptosContablesManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'entradas-contables':
      currentComponent = <EntradasContablesManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'crear-nuevo-dia':
      currentComponent = <CreateNewDayManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'exportar-excel':
      currentComponent = <ExcelExporterManager user={user} setCurrentView={handleViewChange} />;
      break;
    case 'activos':
      currentComponent = <ActivosManager user={user} setCurrentView={handleViewChange} updateMessage={updateMessage} setUpdateMessage={setUpdateMessage} />;
      break;
    case 'portfolios':
      // ✅ MODIFICADO: Pasar el estado centralizado y la función para actualizarlo
      currentComponent = <Portfolios 
        user={user} 
        setCurrentView={handleViewChange} 
        updateMessage={updateMessage} 
        setUpdateMessage={setUpdateMessage}
        portfolioCurrencies={portfolioCurrencies}
        setPortfolioCurrencies={setPortfolioCurrencies}
      />;
      break;
    case 'portfolio-detail':
      currentComponent = <PortfolioDetail 
        user={user} 
        setCurrentView={handleViewChange} 
        portfolioId={currentView.portfolioId} 
        selectedCurrency={currentView.selectedCurrency} 
      />;
      break;
    default:
      currentComponent = <Dashboard user={user} setCurrentView={handleViewChange} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <Sidebar
        currentView={currentView.type}
        setCurrentView={handleViewChange}
        user={user}
      />
      <div className="flex-1 flex flex-col">
        {currentComponent}
      </div>
    </div>
  );
}