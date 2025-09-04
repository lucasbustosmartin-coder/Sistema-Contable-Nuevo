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

  useEffect(() => {
    async function getSession() {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setLoading(false);
    }
    getSession();

    // ✅ MODIFICADO: Agregar un listener de eventos de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    // ✅ MODIFICADO: Limpiar el listener al desmontar el componente
    return () => {
      authListener.subscription.unsubscribe();
    };

  }, []);

  const handleActualizarPrecios = async () => {
    setUpdateMessage({ type: 'info', text: 'Actualizando precios...' });
    try {
      if (!user) {
        throw new Error('Usuario no autenticado.');
      }
      const { data, error: invokeError } = await supabase.functions.invoke('actualizar-precios-docta', {
        body: { user_id: user.id },
      });
      if (invokeError) throw invokeError;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUpdateMessage({ type: 'success', text: data?.message || 'Precios actualizados correctamente.' });
    } catch (err) {
      console.error('Error al actualizar precios:', err);
      setUpdateMessage({ type: 'error', text: err.message || 'Error al actualizar precios.' });
    } finally {
      setTimeout(() => setUpdateMessage(null), 5000);
    }
  };

  const handleLogin = (newUser) => {
    setUser(newUser);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg flex items-center shadow-md">
          <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-500 border-t-transparent mr-3"></div>
          Cargando...
        </div>
      </div>
    );
  }

  if (!user) {
    // ✅ MODIFICADO: Pasar handleLogin a Login
    return <Login onLogin={handleLogin} />;
  }
  
  const handleViewChange = (viewType, portfolioId = null, selectedCurrency = 'USD') => {
    const newView = { type: viewType, portfolioId, selectedCurrency };
    setCurrentView(newView);

    if (viewType === 'portfolios') {
      handleActualizarPrecios();
    }
  };
  
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
    case 'conceptos':
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
      currentComponent = <Portfolios user={user} setCurrentView={handleViewChange} updateMessage={updateMessage} setUpdateMessage={setUpdateMessage} />;
      break;
    case 'portfolio-detail':
      currentComponent = <PortfolioDetail user={user} setCurrentView={handleViewChange} portfolioId={currentView.portfolioId} selectedCurrency={currentView.selectedCurrency} />;
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