import React, { useState, useEffect } from 'react';
import { 
  Server, Globe, RefreshCw, Users, KanbanSquare, 
  DollarSign, TrendingUp, Plus, X, ExternalLink, 
  CheckCircle2, XCircle, ShieldCheck, Activity,
  Trash2, LogOut, CalendarDays, ArrowRight, FileText,
  BarChart3, Settings, CreditCard, Edit3
} from 'lucide-react';

// --- FUNÇÕES AUXILIARES DE SEGURANÇA E FORMATAÇÃO ---
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const safeObject = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

// Resolve o bug do JavaScript de voltar 1 dia para trás por causa do fuso horário do Brasil
const formatSafeDate = (dateStr) => {
  if (!dateStr) return 'S/ Data';
  const safeStr = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
  return new Date(safeStr).toLocaleDateString('pt-BR');
};

// --- HOOK DE PERSISTÊNCIA NA VPS (Com fallback local Blindado) ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (!item || item === 'null' || item === 'undefined') return initialValue;
      const parsed = JSON.parse(item);
      
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue;
      if (typeof initialValue === 'object' && !Array.isArray(initialValue) && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) return initialValue;
      
      return parsed;
    } catch (error) {
      return initialValue;
    }
  });

  useEffect(() => {
    fetch(`/api/data/${key}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        if (data && data.data !== undefined && data.data !== null) {
          const finalData = data.data;
          
          setState(prev => {
            let newState;
            if (typeof initialValue === 'object' && !Array.isArray(initialValue)) {
               newState = { ...initialValue, ...safeObject(prev), ...safeObject(finalData) };
            } else if (Array.isArray(initialValue)) {
               newState = safeArray(finalData);
            } else {
               newState = finalData;
            }
            localStorage.setItem(key, JSON.stringify(newState));
            return newState;
          });
        }
      })
      .catch(() => {});
  }, [key]);

  const setValue = (value) => {
    setState((prevState) => {
      try {
        const valueToStore = value instanceof Function ? value(prevState) : value;
        localStorage.setItem(key, JSON.stringify(valueToStore));
        fetch(`/api/data/${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: valueToStore })
        }).catch(() => {});
        return valueToStore;
      } catch (error) {
        return prevState;
      }
    });
  };

  return [state, setValue];
}

// --- DADOS MOCK PARA PREVIEW ---
const mockClientData = {
  kanban: [
    { id: '1', title: 'Carrossel de Dicas', desc: 'Dicas de marketing...', col: 'Aprovados', date: '' },
    { id: '2', title: 'Vídeo Institucional', desc: 'Reels para o feed.', col: 'Aprovados', date: '' }
  ],
  finances: [
    { id: 1, desc: 'Gestão de Tráfego', due: '2026-05-05', status: 'Pendente', pix: '123456789' }
  ],
  reports: [
    { id: 1, date: '2026-04-10', leads: 120, cost: '4.50', contracts: 8, custom: [] }
  ],
  docs: [
    { id: 1, title: 'Contrato Social', date: '2026-01-10', link: '#' }
  ],
  config: { lookerStudioUrl: 'https://lookerstudio.google.com/reporting/10b2cbf5-4b1f-4f87-a96a-855d8067c523/page/4E6KF' }
};

// --- COMPONENTES DE UI ---
const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce border border-gray-700">
      <span className="text-sm font-bold">{msg}</span>
      <button onClick={onClose} className="hover:text-gray-300"><X size={16} /></button>
    </div>
  );
};

// --- APP CENTRAL (MASTER) ---
export default function CentralApp() {
  const [currentUser, setCurrentUser] = usePersistentState('azione_master_user', null);
  const [clients, setClients] = usePersistentState('azione_master_clients', []);
  const [masterConfig, setMasterConfig] = usePersistentState('azione_master_config', {
    companyName: 'Azione Master', logo: '', primaryColor: '#2563EB', secondaryColor: '#0891B2', bgColor: '#0B1120'
  });
  
  const [mainView, setMainView] = useState('dashboard'); // dashboard | settings
  const [toast, setToast] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('geral'); // geral | looker | financeiro
  const [editingFin, setEditingFin] = useState(null);

  const showToast = (msg) => setToast(msg);
  
  // VARIÁVEIS BLINDADAS CONTRA TELA BRANCA
  const safeClients = safeArray(clients);
  const safeConfig = { 
    companyName: masterConfig?.companyName || 'Azione Master', 
    logo: masterConfig?.logo || '', 
    primaryColor: masterConfig?.primaryColor || '#2563EB', 
    secondaryColor: masterConfig?.secondaryColor || '#0891B2',
    bgColor: masterConfig?.bgColor || '#0B1120'
  };
  const activeClient = safeClients.find(c => c.id === activeClientId);

  const gradientStyle = { background: `linear-gradient(to right, ${safeConfig.primaryColor}, ${safeConfig.secondaryColor})` };
  const primaryBg = { backgroundColor: safeConfig.primaryColor };

  const getEmbedUrl = (url) => {
    if(typeof url !== 'string' || !url) return '';
    if(url.includes('/embed/')) return url;
    return url.replace('/u/0/reporting/', '/embed/reporting/').replace('/reporting/', '/embed/reporting/');
  };

  // --- LÓGICA DE SINCRONIZAÇÃO DA VPS ---
  const syncClient = async (client) => {
    setSyncingId(client.id);
    try {
      let kanbanData, financesData, reportsData, configData, docsData;

      if (client.url.includes('demo') || client.url.includes('localhost')) {
        await new Promise(r => setTimeout(r, 1000));
        if (client.login === 'admin' || client.login === 'gestor') {
           kanbanData = mockClientData.kanban;
           financesData = mockClientData.finances;
           reportsData = mockClientData.reports;
           docsData = mockClientData.docs;
           configData = mockClientData.config;
        } else throw new Error("Credenciais recusadas pelo cliente.");
      } else {
        const urlBase = client.url.replace(/\/$/, '');
        const resUsers = await fetch(`${urlBase}/api/data/users`);
        if (!resUsers.ok) throw new Error("VPS Inacessível (Erro 404/500)");
        
        const dataUsers = await resUsers.json();
        let usersArray = dataUsers?.data && Array.isArray(dataUsers.data) ? dataUsers.data : (Array.isArray(dataUsers) ? dataUsers : []);
        if (usersArray.length === 0) usersArray = [{ login: 'gestor', pass: 'gestor123', role: 'administrador' }];

        const isValid = usersArray.find(u => u.login === client.login && u.pass === client.pass && ['gestor', 'administrador'].includes(u.role));
        if (!isValid) throw new Error("Acesso Negado: Senha incorreta ou permissão insuficiente.");

        const [resK, resF, resR, resC, resD] = await Promise.all([
          fetch(`${urlBase}/api/data/kanban`),
          fetch(`${urlBase}/api/data/finances`),
          fetch(`${urlBase}/api/data/reports`),
          fetch(`${urlBase}/api/data/config`),
          fetch(`${urlBase}/api/data/docs`)
        ]);

        const jsonK = await resK.json(); const jsonF = await resF.json(); 
        const jsonR = await resR.json(); const jsonC = await resC.json(); const jsonD = await resD.json();

        // Extração de dados blindada
        kanbanData = Array.isArray(jsonK?.data) ? jsonK.data : (Array.isArray(jsonK) ? jsonK : []);
        financesData = Array.isArray(jsonF?.data) ? jsonF.data : (Array.isArray(jsonF) ? jsonF : []);
        reportsData = Array.isArray(jsonR?.data) ? jsonR.data : (Array.isArray(jsonR) ? jsonR : []);
        docsData = Array.isArray(jsonD?.data) ? jsonD.data : (Array.isArray(jsonD) ? jsonD : []);
        configData = safeObject(jsonC?.data);
      }

      setClients(prev => safeArray(prev).map(c => c.id === client.id ? {
        ...c, status: 'online', lastSync: new Date().toISOString(), error: null,
        data: { kanban: kanbanData, finances: financesData, reports: reportsData, docs: docsData, config: configData }
      } : c));
      showToast(`Sincronizado: ${client.name}`);
    } catch (err) {
      setClients(prev => safeArray(prev).map(c => c.id === client.id ? { ...c, status: 'offline', error: err.message } : c));
      showToast(`Erro em ${client.name}: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = () => safeClients.forEach(c => syncClient(c));

  // --- LÓGICA DE SALVAR DADOS DIRETAMENTE NA VPS DO CLIENTE (Otimista) ---
  const saveClientData = async (client, endpoint, newData) => {
    // 1. ATUALIZAÇÃO OTIMISTA: Altera na tela imediatamente para não haver delay
    setClients(prev => safeArray(prev).map(c => c.id === client.id ? { 
      ...c, data: { ...safeObject(c.data), [endpoint]: newData } 
    } : c));

    if (client.url.includes('demo') || client.url.includes('localhost')) {
      showToast("Ação realizada com sucesso! (Modo Demo)");
      return;
    }
    
    // 2. ATUALIZAÇÃO REAL NA VPS EM BACKGROUND
    try {
      const urlBase = client.url.replace(/\/$/, '');
      const res = await fetch(`${urlBase}/api/data/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: newData })
      });
      if(!res.ok) throw new Error("Falha ao salvar na VPS.");
      showToast("Dados salvos no cliente com sucesso!");
    } catch(err) {
      showToast(`Erro de conexão ao salvar: ${err.message}`);
      syncClient(client); // Se der erro, ressincroniza para reverter a tela otimista
    }
  };

  const schedulePost = (client, cardId, dateStr) => {
    if(!dateStr) return showToast("Selecione uma data!");
    let kanbanArray = safeArray(client.data?.kanban);
    let found = false;
    kanbanArray = kanbanArray.map(c => {
      if(c.id === cardId) { found = true; return { ...c, date: dateStr, col: 'Programados' }; }
      return c;
    });
    if(!found) return showToast("Erro: Card não encontrado.");
    saveClientData(client, 'kanban', kanbanArray);
  };

  const handleSaveFin = (client) => {
    let fins = safeArray(client.data?.finances);
    if (editingFin.id === 'new') fins = [...fins, { ...editingFin, id: Date.now() }];
    else fins = fins.map(f => f.id === editingFin.id ? editingFin : f);
    saveClientData(client, 'finances', fins);
    setEditingFin(null);
  };

  // --- LOGIN ---
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans text-gray-200" style={{ backgroundColor: safeConfig.bgColor }}>
        <div className="bg-[#111827] p-10 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1" style={gradientStyle}></div>
          <div className="flex justify-center mb-6">
            {safeConfig.logo ? (
              <img src={safeConfig.logo} alt="Logo" className="h-16 object-contain" />
            ) : (
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700">
                <Server className="text-gray-400" size={32} />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2">{safeConfig.companyName}</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Central de Operações da Agência</p>
          
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            const user = e.target.user.value; const pass = e.target.pass.value;
            if (user === 'Super' && pass === '9328') setCurrentUser({ role: 'super', name: 'Super Administrador' });
            else if (user === 'master' && pass === 'master123') setCurrentUser({ role: 'master', name: 'Administrador Master' });
            else if (user === 'social' && pass === 'social123') setCurrentUser({ role: 'social', name: 'Social Media' });
            else showToast("Credenciais incorretas!"); 
          }} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Usuário Central</label>
              <input name="user" type="text" placeholder="master ou social" required className="w-full p-4 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white font-mono focus:border-gray-500" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Senha Global</label>
              <input name="pass" type="password" placeholder="••••••••" required className="w-full p-4 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white font-mono tracking-widest focus:border-gray-500" />
            </div>
            <button type="submit" className="w-full text-white p-4 rounded-xl font-bold text-lg shadow-lg transition-transform hover:scale-[1.02] mt-2" style={gradientStyle}>Acessar Central</button>
          </form>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  const isMaster = currentUser.role === 'master' || currentUser.role === 'super';
  const isSuper = currentUser.role === 'super';
  
  let globalPendencies = 0; let globalLeads = 0; let globalAprovados = 0;
  safeClients.forEach(c => {
    const cFins = safeArray(c.data?.finances);
    const cReps = safeArray(c.data?.reports);
    const cKanban = safeArray(c.data?.kanban);
    
    if (cFins.length > 0) globalPendencies += cFins.filter(f => f.status !== 'Pago').length;
    if (cReps.length > 0) globalLeads += Number(cReps[0].leads || 0);
    if (cKanban.length > 0) globalAprovados += cKanban.filter(k => k.col === 'Aprovados').length;
  });

  const onlineClients = safeClients.filter(c => c.status === 'online').length;
  const totalClients = safeClients.length;

  return (
    <div className="min-h-screen text-gray-300 font-sans flex flex-col relative transition-colors duration-500" style={{ backgroundColor: safeConfig.bgColor }}>
      <header className="bg-[#111827] border-b border-gray-800 p-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setMainView('dashboard')}>
            {safeConfig.logo ? (
              <img src={safeConfig.logo} alt="Logo" className="h-10 object-contain bg-white/5 p-1 rounded-xl" />
            ) : (
              <div className="text-white p-2 rounded-xl" style={gradientStyle}><Globe size={24} /></div>
            )}
            <div>
              <h1 className="text-xl font-black text-white leading-none">{safeConfig.companyName}</h1>
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: safeConfig.secondaryColor }}>Perfil: {currentUser.name}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={syncAll} className="flex items-center gap-2 bg-[#1F2937] hover:bg-[#374151] border border-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors hidden md:flex">
              <RefreshCw size={16} className={syncingId ? 'animate-spin text-white' : 'text-gray-400'} /> Sincronizar Todos
            </button>
            {isSuper && (
              <button onClick={() => setMainView(mainView === 'settings' ? 'dashboard' : 'settings')} className={`p-2 rounded-lg transition-colors ${mainView === 'settings' ? 'bg-gray-700 text-white' : 'bg-[#1F2937] hover:bg-[#374151] text-gray-400'}`}>
                <Settings size={20} />
              </button>
            )}
            <button onClick={() => setCurrentUser(null)} className="text-red-400 hover:text-red-300 p-2 bg-[#1F2937] rounded-lg">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* --- SETTINGS VIEW (SUPER APENAS) --- */}
        {mainView === 'settings' && isSuper ? (
          <section className="bg-[#111827] border border-gray-800 rounded-3xl p-8 max-w-3xl mx-auto shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6 border-b border-gray-800 pb-4">Ajustes do Master (White-label)</h2>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Nome da Agência / Central</label>
                <input value={safeConfig.companyName} onChange={e => setMasterConfig({...safeConfig, companyName: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white focus:border-gray-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">URL da Logo (Fundo Escuro Recomendado)</label>
                <input value={safeConfig.logo} onChange={e => setMasterConfig({...safeConfig, logo: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white focus:border-gray-500 text-sm font-mono" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1F2937] border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor Primária</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.primaryColor} onChange={e => setMasterConfig({...safeConfig, primaryColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.primaryColor}}></div>
                  </div>
                </div>
                <div className="bg-[#1F2937] border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor Secundária</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.secondaryColor} onChange={e => setMasterConfig({...safeConfig, secondaryColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.secondaryColor}}></div>
                  </div>
                </div>
                <div className="bg-[#1F2937] border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fundo (Bg)</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.bgColor} onChange={e => setMasterConfig({...safeConfig, bgColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.bgColor}}></div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <button onClick={() => { setMainView('dashboard'); showToast("Cores e Configurações Aplicadas!"); }} className="w-full text-white p-4 rounded-xl font-bold shadow-lg" style={gradientStyle}>Salvar e Voltar ao Dashboard</button>
              </div>
            </div>
          </section>
        ) : (
          /* --- DASHBOARD VIEW --- */
          <>
            <section>
              <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2" style={{ color: safeConfig.secondaryColor }}>
                <Activity size={20} /> Visão Global da Agência
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {isMaster && <StatCard title="Clientes Conectados" value={`${onlineClients}/${totalClients}`} icon={<Server/>} borderColor="border-gray-800" />}
                {isMaster && <StatCard title="Faturas Pendentes" value={globalPendencies} icon={<DollarSign/>} borderColor={globalPendencies > 0 ? 'border-rose-500/50' : 'border-gray-800'} textColor={globalPendencies > 0 ? 'text-rose-400' : 'text-white'} />}
                <StatCard title="Aprovados p/ Agendar" value={globalAprovados} icon={<KanbanSquare/>} borderColor="border-gray-800" />
                {isMaster && <StatCard title="Leads (Últ. Relatório)" value={globalLeads} icon={<TrendingUp/>} borderColor="border-gray-800" />}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2" style={{ color: safeConfig.primaryColor }}>
                  <Users size={20} /> Instâncias (VPS Clientes)
                </h2>
                {isSuper && (
                  <button onClick={() => setAddModalOpen(true)} className="text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-transform hover:scale-105" style={primaryBg}>
                    <Plus size={16} /> <span className="hidden sm:inline">Novo Cliente</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {safeClients.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-[#111827] rounded-3xl border border-gray-800">
                    <Globe size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-400 font-bold text-lg">Nenhum painel de cliente conectado.</p>
                  </div>
                )}
                
                {safeClients.map(client => (
                  <div key={client.id} onClick={() => { setActiveClientId(client.id); setActiveClientTab('geral'); }} className="bg-[#111827] rounded-2xl border border-gray-800 overflow-hidden flex flex-col relative group hover:border-gray-600 transition-all cursor-pointer shadow-lg">
                    <div className="p-5 border-b border-gray-800 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-black text-white transition-colors" style={{ color: safeConfig.primaryColor }}>{client.name}</h3>
                          {client.status === 'online' ? <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md uppercase border border-emerald-500/20"><CheckCircle2 size={12}/> Online</span> : 
                           client.status === 'offline' ? <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-1 rounded-md uppercase border border-rose-500/20"><XCircle size={12}/> Erro API</span> :
                           <span className="text-[10px] font-bold bg-gray-800 text-gray-400 px-2 py-1 rounded-md uppercase border border-gray-700">Não Sincronizado</span>}
                        </div>
                        <a href={client.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mt-1 font-mono">
                          {client.url} <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); syncClient(client); }} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors" title="Sincronizar Dados">
                          <RefreshCw size={16} className={syncingId === client.id ? 'animate-spin text-white' : ''} />
                        </button>
                        {isSuper && (
                          <button onClick={(e) => { e.stopPropagation(); if(window.confirm('Remover conexão?')) setClients(prev => safeArray(prev).filter(c => c.id !== client.id)); }} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors" title="Remover Cliente">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex-1 bg-[#0d131f]">
                      {client.error ? (
                        <div className="text-rose-400 text-xs bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 font-mono break-words">
                          <strong>Falha de Conexão:</strong> {client.error}
                        </div>
                      ) : client.data ? (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Aprovados</p>
                            <p className="text-xl font-black text-amber-400">{safeArray(client.data?.kanban).filter(k => k.col === 'Aprovados').length || 0}</p>
                          </div>
                          {isMaster && (
                            <div className="text-center border-x border-gray-800">
                              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Faturas Abertas</p>
                              <p className={`text-xl font-black ${safeArray(client.data?.finances).filter(f => f.status !== 'Pago').length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                {safeArray(client.data?.finances).filter(f => f.status !== 'Pago').length || 0}
                              </p>
                            </div>
                          )}
                          {isMaster && (
                            <div className="text-center">
                              <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Últimos Leads</p>
                              <p className="text-xl font-black" style={{ color: safeConfig.secondaryColor }}>{safeArray(client.data?.reports)?.[0]?.leads || 0}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-600 font-bold uppercase py-4">Aguardando Sincronização...</div>
                      )}
                    </div>
                    
                    <div className="bg-[#111827] p-3 text-center border-t border-gray-800 text-gray-400 font-bold text-xs uppercase flex items-center justify-center gap-2 group-hover:text-white transition-colors">
                      Ver Detalhes da Conta <ArrowRight size={14}/>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* --- MODAL DE DETALHES DO CLIENTE --- */}
      {activeClient && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#111827] rounded-3xl w-full max-w-5xl border border-gray-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-[#0d131f] flex-shrink-0">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  {activeClient.name}
                  {activeClient.status === 'online' && <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md uppercase border border-emerald-500/20">Online</span>}
                </h2>
                <a href={activeClient.url} target="_blank" rel="noreferrer" className="text-sm text-gray-500 hover:text-gray-300 mt-1 inline-flex items-center gap-1 font-mono">
                  {activeClient.url} <ExternalLink size={12}/>
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setActiveClientTab('geral')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeClientTab === 'geral' ? 'text-white' : 'bg-[#1F2937] text-gray-400 hover:bg-gray-700'}`} style={activeClientTab === 'geral' ? primaryBg : {}}>Mídias e Relatórios</button>
                {isMaster && (
                  <button onClick={() => setActiveClientTab('finance')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeClientTab === 'finance' ? 'text-white' : 'bg-[#1F2937] text-gray-400 hover:bg-gray-700'}`} style={activeClientTab === 'finance' ? primaryBg : {}}>
                    <CreditCard size={16}/> Financeiro & Docs
                  </button>
                )}
                {isMaster && activeClient.data?.config?.lookerStudioUrl && (
                  <button onClick={() => setActiveClientTab('looker')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeClientTab === 'looker' ? 'text-white' : 'bg-[#1F2937] text-gray-400 hover:bg-gray-700'}`} style={activeClientTab === 'looker' ? primaryBg : {}}>
                    <BarChart3 size={16}/> Looker Studio
                  </button>
                )}
                <div className="w-px bg-gray-700 mx-1 hidden md:block"></div>
                <button onClick={() => setActiveClientId(null)} className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors font-bold">Fechar</button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8 relative">
              
              {/* ABA GERAL: APROVADOS E TRÁFEGO */}
              {activeClientTab === 'geral' && (
                <>
                  <section>
                    <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-4">
                      <CalendarDays className="text-amber-400"/>
                      <h3 className="text-lg font-black text-white uppercase tracking-widest">Ações: Posts Aprovados (Aguardando)</h3>
                    </div>
                    {(!activeClient.data?.kanban || safeArray(activeClient.data.kanban).filter(k => k.col === 'Aprovados').length === 0) ? (
                      <div className="text-center py-8 bg-[#0d131f] rounded-2xl border border-gray-800 text-gray-500 font-bold">Nenhum post aguardando agendamento.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {safeArray(activeClient.data.kanban).filter(k => k.col === 'Aprovados').map(card => {
                          let selectedDate = ''; 
                          return (
                            <div key={card.id} className="bg-[#1F2937] p-5 rounded-2xl border border-gray-700 flex flex-col justify-between shadow-lg">
                              <div className="mb-4">
                                <h4 className="font-bold text-lg text-white leading-tight mb-2">{card.title}</h4>
                                <p className="text-sm text-gray-400 line-clamp-2">{card.desc || card.caption || 'Sem descrição.'}</p>
                              </div>
                              <div className="bg-[#111827] p-3 rounded-xl border border-gray-800">
                                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Definir Data de Postagem</label>
                                <div className="flex gap-2">
                                  <input type="date" onChange={e => selectedDate = e.target.value} className="flex-1 bg-[#1F2937] border border-gray-700 text-white rounded-lg p-2 text-sm outline-none" />
                                  <button onClick={() => schedulePost(activeClient, card.id, selectedDate)} className="text-white font-bold px-4 py-2 rounded-lg text-sm shadow-lg" style={primaryBg}>Programar</button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {isMaster && (
                    <section>
                      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-4 mt-8">
                        <TrendingUp style={{ color: safeConfig.secondaryColor }}/>
                        <h3 className="text-lg font-black text-white uppercase tracking-widest">Últimos Relatórios de Tráfego</h3>
                      </div>
                      {(!activeClient.data?.reports || safeArray(activeClient.data.reports).length === 0) ? (
                        <div className="text-center py-8 bg-[#0d131f] rounded-2xl border border-gray-800 text-gray-500 font-bold">Nenhum relatório na VPS deste cliente.</div>
                      ) : (
                        <div className="space-y-4">
                          {safeArray(activeClient.data.reports).slice(0, 3).map(rep => (
                            <div key={rep.id} className="bg-[#1F2937] p-5 rounded-2xl border border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Referência: {formatSafeDate(rep.date)}</p>
                                <div className="flex gap-6 mt-2">
                                  <div><span className="text-xs text-gray-400 block">Leads</span><span className="font-black text-lg" style={{ color: safeConfig.secondaryColor }}>{rep.leads}</span></div>
                                  <div><span className="text-xs text-gray-400 block">Custo/Lead</span><span className="font-black text-white text-lg">R$ {rep.cost}</span></div>
                                  <div><span className="text-xs text-gray-400 block">Contratos</span><span className="font-black text-emerald-400 text-lg">{rep.contracts}</span></div>
                                </div>
                              </div>
                              {rep.attachment && (
                                <a href={rep.attachment} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors">
                                  <FileText size={16}/> Ver PDF Completo
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                </>
              )}

              {/* ABA: FINANCEIRO E DOCS */}
              {activeClientTab === 'finance' && isMaster && (
                <div className="space-y-8">
                  {/* Gestão de Faturas */}
                  <section>
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                      <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2"><DollarSign className="text-emerald-400"/> Faturas e Cobranças</h3>
                      <button onClick={() => setEditingFin({ id: 'new', desc: 'Nova Fatura', due: '', pix: '', boleto: '', nf: '', status: 'Pendente' })} className="text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2" style={primaryBg}>
                        <Plus size={14}/> Adicionar Fatura
                      </button>
                    </div>
                    <div className="bg-[#1F2937] border border-gray-700 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-800/50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-700">
                            <th className="p-4">Descrição</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safeArray(activeClient.data?.finances).map((fin) => (
                            <tr key={fin.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/20">
                              <td className="p-4 font-bold text-white text-sm">{fin.desc} <span className="block text-gray-500 text-xs font-normal mt-0.5">Venc: {formatSafeDate(fin.due)}</span></td>
                              <td className="p-4">
                                <button onClick={() => {
                                  const newStatus = fin.status === 'Pago' ? 'Pendente' : 'Pago';
                                  const updatedFins = safeArray(activeClient.data.finances).map(f => f.id === fin.id ? {...f, status: newStatus} : f);
                                  saveClientData(activeClient, 'finances', updatedFins);
                                }} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${fin.status === 'Pago' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}>
                                  {fin.status || 'Pendente'} (Trocar)
                                </button>
                              </td>
                              <td className="p-4 flex gap-2 justify-end">
                                <button onClick={() => setEditingFin(fin)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"><Edit3 size={14}/></button>
                                <button onClick={() => {
                                  if(window.confirm('Apagar fatura no cliente?')) saveClientData(activeClient, 'finances', safeArray(activeClient.data.finances).filter(f => f.id !== fin.id));
                                }} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={14}/></button>
                              </td>
                            </tr>
                          ))}
                          {(!activeClient.data?.finances || safeArray(activeClient.data.finances).length === 0) && <tr><td colSpan="3" className="p-8 text-center text-gray-500 text-sm font-bold">Nenhuma fatura cadastrada para este cliente.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Gestão de Documentos */}
                  <section>
                    <div className="flex items-center justify-between border-b border-gray-800 pb-3 mb-4">
                      <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2"><FileText className="text-gray-400"/> Documentos Legais</h3>
                      <button onClick={() => {
                        const title = prompt("Título do Documento:");
                        const link = prompt("Link do PDF (Drive):");
                        if(title && link) saveClientData(activeClient, 'docs', [...safeArray(activeClient.data?.docs), {id: Date.now(), title, link, date: new Date().toISOString()}]);
                      }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                        <Plus size={14}/> Novo Doc
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {safeArray(activeClient.data?.docs).map(doc => (
                        <div key={doc.id} className="bg-[#1F2937] border border-gray-700 p-4 rounded-xl flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-white text-sm">{doc.title}</h4>
                            <p className="text-[10px] text-gray-500 uppercase mt-1">Add: {formatSafeDate(doc.date)}</p>
                          </div>
                          <div className="flex gap-2">
                            <a href={doc.link} target="_blank" rel="noreferrer" className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"><ExternalLink size={14}/></a>
                            <button onClick={() => {
                              if(window.confirm('Apagar documento?')) saveClientData(activeClient, 'docs', safeArray(activeClient.data.docs).filter(d => d.id !== doc.id));
                            }} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))}
                      {(!activeClient.data?.docs || safeArray(activeClient.data.docs).length === 0) && <div className="col-span-full py-6 text-center text-gray-500 text-sm font-bold bg-[#1F2937] rounded-xl border border-gray-700">Sem documentos cadastrados.</div>}
                    </div>
                  </section>
                </div>
              )}

              {/* ABA: LOOKER STUDIO */}
              {activeClientTab === 'looker' && isMaster && (
                <div className="flex flex-col h-[75vh] bg-white rounded-2xl overflow-hidden relative border border-gray-700">
                   <div className="bg-yellow-50 p-2 text-center text-[10px] font-bold text-yellow-700 border-b border-yellow-200">
                    ⚠️ Lembrete: O cliente precisa ter ativado a incorporação no Looker Studio.
                  </div>
                  <iframe src={getEmbedUrl(activeClient.data?.config?.lookerStudioUrl)} frameBorder="0" style={{ border: 0 }} allowFullScreen className="w-full h-full flex-1"></iframe>
                </div>
              )}

            </div>

            {/* OVERLAY PARA EDIÇÃO DE FATURA */}
            {editingFin && (
              <div className="absolute inset-0 bg-[#0d131f]/95 backdrop-blur-md z-10 flex items-center justify-center p-6">
                 <div className="bg-[#111827] rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
                    <h3 className="text-xl font-black text-white mb-6 border-b border-gray-800 pb-3 flex justify-between items-center">
                      Detalhes da Fatura <button onClick={()=>setEditingFin(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Descrição</label>
                        <input value={editingFin.desc} onChange={e => setEditingFin({...editingFin, desc: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Vencimento</label>
                          <input type="date" value={editingFin.due} onChange={e => setEditingFin({...editingFin, due: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Status</label>
                          <select value={editingFin.status || 'Pendente'} onChange={e => setEditingFin({...editingFin, status: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm font-bold">
                            <option value="Pendente">Pendente</option><option value="Pago">Pago</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Chave PIX</label>
                        <input value={editingFin.pix} onChange={e => setEditingFin({...editingFin, pix: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Link do Boleto (Drive/PDF)</label>
                        <input value={editingFin.boleto} onChange={e => setEditingFin({...editingFin, boleto: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Link da Nota Fiscal (Drive/PDF)</label>
                        <input value={editingFin.nf} onChange={e => setEditingFin({...editingFin, nf: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm" />
                      </div>
                      <div className="pt-4 flex gap-3">
                        <button onClick={()=>setEditingFin(null)} className="flex-1 p-3 rounded-xl font-bold bg-gray-800 text-gray-400 hover:text-white">Cancelar</button>
                        <button onClick={()=>handleSaveFin(activeClient)} className="flex-1 p-3 rounded-xl font-bold text-white shadow-lg" style={primaryBg}>Salvar Fatura</button>
                      </div>
                    </div>
                 </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR CLIENTE (Somente Super) */}
      {addModalOpen && isSuper && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <Globe style={{ color: safeConfig.primaryColor }}/> Conectar Novo Cliente
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const newClient = {
                id: Date.now().toString(),
                name: e.target.nome.value,
                url: e.target.url.value,
                login: e.target.login.value,
                pass: e.target.pass.value,
                status: 'pending',
                data: null
              };
              setClients(prevClients => [...safeArray(prevClients), newClient]);
              setAddModalOpen(false);
              syncClient(newClient); 
            }} className="space-y-4">
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nome do Cliente</label>
                <input name="nome" required placeholder="Ex: Agmaq Agro" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white focus:border-gray-500" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">URL do Painel (VPS)</label>
                <input name="url" required placeholder="https://painel-cliente.com" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white font-mono text-sm focus:border-gray-500" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800 mt-4">
                <div className="col-span-full">
                  <p className="text-xs font-bold text-amber-500 flex items-center gap-1"><ShieldCheck size={14}/> Credenciais Admin da VPS</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Usuário</label>
                  <input name="login" required placeholder="admin" defaultValue="admin" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white focus:border-gray-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Senha</label>
                  <input name="pass" type="password" required placeholder="***" defaultValue="admin123" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white focus:border-gray-500" />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 p-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 p-3 rounded-xl font-bold text-white shadow-lg shadow-blue-900/20" style={primaryBg}>Conectar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}

// Subcomponente de Estatística
function StatCard({ title, value, icon, color="text-white", borderColor, textColor="text-white" }) {
  return (
    <div className={`p-5 rounded-2xl border ${borderColor} bg-[#111827] flex flex-col justify-between shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <span className={`p-2.5 rounded-xl bg-[#1F2937] border ${borderColor} ${color}`}>{icon}</span>
      </div>
      <div>
        <h3 className={`text-3xl font-black mb-1 ${textColor}`}>{value}</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{title}</p>
      </div>
    </div>
  );
}
