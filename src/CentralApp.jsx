import React, { useState, useEffect } from 'react';
import { 
  Server, Globe, RefreshCw, Users, KanbanSquare, 
  DollarSign, TrendingUp, Plus, X, ExternalLink, 
  CheckCircle2, XCircle, ShieldCheck, Activity,
  Trash2, LogOut, CalendarDays, ArrowRight, FileText,
  BarChart3, Settings, CreditCard, Edit3, Bot
} from 'lucide-react';

// --- FUNÇÕES DE SEGURANÇA MÁXIMA PARA EVITAR TELA BRANCA (CRASH) ---
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const safeObject = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

const formatSafeDate = (dateStr) => {
  if (!dateStr) return 'S/ Data';
  const safeStr = dateStr.length === 10 ? `${dateStr}T12:00:00` : dateStr;
  return new Date(safeStr).toLocaleDateString('pt-BR');
};

const formatDriveLink = (url) => {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
};

// --- MOTOR DA IA DO MASTER (COM RETRY E FALLBACK) ---
const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro detalhado da API do Gemini:", errorText);
        throw new Error(`Erro na API: ${response.status} - ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

const callGeminiWithFallback = async (userPrompt, systemPrompt, userApiKey) => {
  if (!userApiKey) throw new Error("Chave da API do Google Gemini não está configurada nas configurações do Master.");
  const cleanKey = userApiKey.trim();
  
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  let modelName = "";

  try {
    const listData = await fetchWithRetry(listUrl, { method: 'GET' });
    const validModels = (listData.models || []).filter(m => 
      m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini')
    );

    if (validModels.length === 0) throw new Error("A sua chave é válida, mas sem permissão para usar modelos Gemini.");

    const preferredModel = 
      validModels.find(m => m.name.includes('1.5-flash')) ||
      validModels.find(m => m.name.includes('1.5-pro')) ||
      validModels.find(m => m.name.includes('2.5-flash')) ||
      validModels.find(m => m.name.includes('1.0-pro') || m.name === 'models/gemini-pro') ||
      validModels[0];

    modelName = preferredModel.name; 
  } catch (err) {
    throw new Error(`Falha ao validar a chave API: ${err.message}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${cleanKey}`;
  let payload = {};
  
  if (modelName === 'models/gemini-pro' || modelName === 'models/gemini-1.0-pro') {
      payload = { contents: [{ parts: [{ text: `[INSTRUÇÕES DO SISTEMA]:\n${systemPrompt}\n\n[PEDIDO DO USUÁRIO]:\n${userPrompt}` }] }] };
  } else {
      payload = { contents: [{ parts: [{ text: userPrompt }] }], systemInstruction: { parts: [{ text: systemPrompt }] } };
  }

  const data = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro: Resposta vazia da IA.";
};

// --- HOOK DE PERSISTÊNCIA NA VPS DO MASTER ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      if (!item || item === 'null' || item === 'undefined') return initialValue;
      const parsed = JSON.parse(item);
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue;
      if (typeof initialValue === 'object' && !Array.isArray(initialValue) && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) return initialValue;
      return parsed;
    } catch (error) { return initialValue; }
  });

  useEffect(() => {
    fetch(`/api/data/${key}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        if (data && data.data !== undefined && data.data !== null) {
          setState(prev => {
            let newState;
            if (typeof initialValue === 'object' && !Array.isArray(initialValue)) { newState = { ...initialValue, ...safeObject(prev), ...safeObject(data.data) }; } 
            else if (Array.isArray(initialValue)) { newState = safeArray(data.data); } 
            else { newState = data.data; }
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
        fetch(`/api/data/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: valueToStore }) }).catch(() => {});
        return valueToStore;
      } catch (error) { return prevState; }
    });
  };
  return [state, setValue];
}

// --- DADOS MOCK (SIMULAÇÃO) ---
const mockClientData = {
  kanban: [
    { id: '1', title: 'Carrossel de Dicas', desc: 'Dicas de marketing...', col: 'Aprovados', date: '', isCarousel: false, carousel: [], caption: '', comments: [] },
  ],
  finances: [ { id: 1, desc: 'Gestão de Tráfego', due: '2026-05-05', status: 'Pendente', pix: '123456789' } ],
  reports: [ { id: 1, date: '2026-04-10', leads: 120, cost: '4.50', contracts: 8, custom: [] } ],
  docs: [ { id: 1, title: 'Contrato Social', date: '2026-01-10', link: '#' } ],
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
    companyName: 'Azione Master', logo: '', primaryColor: '#2563EB', secondaryColor: '#0891B2', bgColor: '#0B1120', cardBgColor: '#111827', geminiKey: ''
  });
  
  const [mainView, setMainView] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [syncingId, setSyncingId] = useState(null);
  
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null); // Estado para editar cliente
  
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClientTab, setActiveClientTab] = useState('geral');
  const [editingFin, setEditingFin] = useState(null);
  const [editingCard, setEditingCard] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 4000); };
  
  const safeClients = safeArray(clients);
  const safeConfig = { 
    companyName: masterConfig?.companyName || 'Azione Master', 
    logo: masterConfig?.logo || '', 
    primaryColor: masterConfig?.primaryColor || '#2563EB', 
    secondaryColor: masterConfig?.secondaryColor || '#0891B2',
    bgColor: masterConfig?.bgColor || '#0B1120',
    cardBgColor: masterConfig?.cardBgColor || '#111827',
    geminiKey: masterConfig?.geminiKey || ''
  };
  const activeClient = safeClients.find(c => c.id === activeClientId);

  const gradientStyle = { background: `linear-gradient(to right, ${safeConfig.primaryColor}, ${safeConfig.secondaryColor})` };
  const primaryBg = { backgroundColor: safeConfig.primaryColor };

  const getEmbedUrl = (url) => {
    if(typeof url !== 'string' || !url) return '';
    if(url.includes('/embed/')) return url;
    return url.replace('/u/0/reporting/', '/embed/reporting/').replace('/reporting/', '/embed/reporting/');
  };

  const syncClient = async (client) => {
    setSyncingId(client.id);
    try {
      let kanbanData, financesData, reportsData, configData, docsData;

      if (client.url.includes('demo') || client.url.includes('localhost')) {
        await new Promise(r => setTimeout(r, 1000));
        if (client.login === 'admin' || client.login === 'master') {
           kanbanData = mockClientData.kanban; financesData = mockClientData.finances;
           reportsData = mockClientData.reports; docsData = mockClientData.docs; configData = mockClientData.config;
        } else throw new Error("Credenciais recusadas pelo cliente.");
      } else {
        const urlBase = client.url.replace(/\/$/, '');
        const resUsers = await fetch(`${urlBase}/api/data/users`);
        if (!resUsers.ok) throw new Error("VPS Inacessível (Erro 404/500)");
        
        const dataUsers = await resUsers.json();
        let usersArray = dataUsers?.data && Array.isArray(dataUsers.data) ? dataUsers.data : (Array.isArray(dataUsers) ? dataUsers : []);
        
        if (usersArray.length === 0) usersArray = [{ login: 'master', pass: 'master123', role: 'master' }, { login: 'gestor', pass: 'gestor123', role: 'administrador' }];

        const isValid = usersArray.find(u => u.login === client.login && u.pass === client.pass && ['master', 'gestor', 'administrador'].includes(u.role));
        if (!isValid) throw new Error("Acesso Negado: Senha incorreta ou permissão insuficiente.");

        const [resK, resF, resR, resC, resD] = await Promise.all([
          fetch(`${urlBase}/api/data/kanban`), fetch(`${urlBase}/api/data/finances`), fetch(`${urlBase}/api/data/reports`), fetch(`${urlBase}/api/data/config`), fetch(`${urlBase}/api/data/docs`)
        ]);

        const jsonK = await resK.json(); const jsonF = await resF.json(); 
        const jsonR = await resR.json(); const jsonC = await resC.json(); const jsonD = await resD.json();

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

  const saveClientData = async (client, endpoint, newData) => {
    setClients(prev => safeArray(prev).map(c => c.id === client.id ? { ...c, data: { ...safeObject(c.data), [endpoint]: newData } } : c));
    if (client.url.includes('demo') || client.url.includes('localhost')) return showToast("Ação realizada com sucesso! (Modo Demo)");
    try {
      const urlBase = client.url.replace(/\/$/, '');
      const res = await fetch(`${urlBase}/api/data/${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: newData })
      });
      if(!res.ok) throw new Error("Falha ao salvar na VPS.");
      showToast("Dados salvos no cliente com sucesso!");
    } catch(err) {
      showToast(`Erro de conexão ao salvar: ${err.message}`);
      syncClient(client); 
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

  const handleSaveCard = (client) => {
    let kanbanArray = safeArray(client.data?.kanban);
    if (editingCard.id === 'new') {
      kanbanArray = [...kanbanArray, { ...editingCard, id: Date.now().toString() }];
    } else {
      kanbanArray = kanbanArray.map(c => c.id === editingCard.id ? editingCard : c);
    }
    saveClientData(client, 'kanban', kanbanArray);
    setEditingCard(null);
  };

  const kanbanColumns = ['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'];
  
  const onDragStart = (e, id) => {
    e.dataTransfer.setData('cardId', id);
    setTimeout(() => { if(e.target) e.target.style.opacity = '0.5'; }, 0);
  };
  const onDragEnd = (e) => { if(e.target) e.target.style.opacity = '1'; };
  const onDragOver = (e) => e.preventDefault();
  
  const onDropKanban = (e, col, client) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;

    let kanbanArray = [...safeArray(client.data?.kanban)];
    const draggedIdx = kanbanArray.findIndex(c => c.id === cardId);
    if (draggedIdx === -1) return;

    const draggedCard = { ...kanbanArray[draggedIdx], col };
    kanbanArray.splice(draggedIdx, 1);

    const targetCardEl = e.target.closest('.kanban-card');
    if (targetCardEl) {
      const targetId = targetCardEl.getAttribute('data-id');
      const targetIdx = kanbanArray.findIndex(c => c.id === targetId);
      if (targetIdx !== -1) {
        const rect = targetCardEl.getBoundingClientRect();
        const isBottom = (e.clientY - rect.top) > (rect.height / 2);
        kanbanArray.splice(isBottom ? targetIdx + 1 : targetIdx, 0, draggedCard);
      } else { kanbanArray.push(draggedCard); }
    } else { kanbanArray.push(draggedCard); }
    
    saveClientData(client, 'kanban', kanbanArray);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans text-gray-200" style={{ backgroundColor: safeConfig.bgColor }}>
        <div className="p-10 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md relative overflow-hidden" style={{ backgroundColor: safeConfig.cardBgColor }}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
              <Server className="text-blue-400" size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2">Painel Master</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Azione Marketing - Central de Operações</p>
          
          <form onSubmit={(e) => { e.preventDefault(); if(e.target.pass.value === 'master2026') setCurrentUser({ role: 'super', name: 'Super Administrador' }); else showToast("Senha de diretoria incorreta!"); }} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Chave de Acesso Global</label>
              <input name="pass" type="password" placeholder="••••••••" required className="w-full p-4 bg-black/40 border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white font-mono tracking-widest" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-cyan-500/25 transition-all">Conectar à Central</button>
          </form>
          <p className="text-center text-xs text-gray-600 mt-4">Dica para o Canvas: digite <span className="text-gray-400">master2026</span></p>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  const isMaster = currentUser.role === 'master' || currentUser.role === 'super';
  const isSuper = currentUser.role === 'super';
  
  let globalPendencies = 0; let globalLeads = 0; let globalAprovados = 0;
  safeClients.forEach(c => {
    if (c.data?.finances) globalPendencies += c.data.finances.filter(f => f.status !== 'Pago').length;
    if (c.data?.reports?.length > 0) globalLeads += Number(c.data.reports[0].leads || 0); 
    if (c.data?.kanban) globalAprovados += c.data.kanban.filter(k => k.col === 'Aprovados' || k.col === 'Programados').length;
  });

  const onlineClients = safeClients.filter(c => c.status === 'online').length;
  const totalClients = safeClients.length;

  return (
    <div className="min-h-screen text-gray-300 font-sans flex flex-col transition-colors duration-500" style={{ backgroundColor: safeConfig.bgColor }}>
      <header className="border-b border-gray-800 p-4 sticky top-0 z-40 transition-colors duration-500" style={{ backgroundColor: safeConfig.cardBgColor }}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white p-2 rounded-xl">
              <Globe size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-white leading-none">Azione Master</h1>
              <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">Central de Controle SaaS</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={syncAll} className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <RefreshCw size={16} className={syncingId ? 'animate-spin text-cyan-400' : 'text-gray-400'} /> 
              <span className="hidden md:inline">Sincronizar Todos</span>
            </button>
            {isSuper && (
              <button onClick={() => setMainView(mainView === 'settings' ? 'dashboard' : 'settings')} className={`p-2 rounded-lg transition-colors ${mainView === 'settings' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-black/40 hover:bg-black/60 text-gray-400'}`}>
                <Settings size={20} />
              </button>
            )}
            <button onClick={() => setCurrentUser(null)} className="text-red-400 hover:text-red-300 p-2">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {mainView === 'settings' && isSuper ? (
          <section className="border border-gray-800 rounded-3xl p-8 max-w-3xl mx-auto shadow-2xl transition-colors duration-500" style={{ backgroundColor: safeConfig.cardBgColor }}>
            <h2 className="text-2xl font-black text-white mb-6 border-b border-gray-800 pb-4">Ajustes do Master (White-label)</h2>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Nome da Agência / Central</label>
                <input value={safeConfig.companyName} onChange={e => setMasterConfig({...safeConfig, companyName: e.target.value})} className="w-full p-3 bg-black/40 border border-gray-700 rounded-xl outline-none text-white focus:border-cyan-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">URL da Logo (Fundo Escuro Recomendado)</label>
                <input value={safeConfig.logo} onChange={e => setMasterConfig({...safeConfig, logo: e.target.value})} className="w-full p-3 bg-black/40 border border-gray-700 rounded-xl outline-none text-white focus:border-cyan-500 text-sm font-mono" placeholder="https://..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-black/40 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor Primária</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.primaryColor} onChange={e => setMasterConfig({...safeConfig, primaryColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.primaryColor}}></div>
                  </div>
                </div>
                <div className="bg-black/40 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cor Secundária</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.secondaryColor} onChange={e => setMasterConfig({...safeConfig, secondaryColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.secondaryColor}}></div>
                  </div>
                </div>
                <div className="bg-black/40 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fundo Global (Bg)</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.bgColor} onChange={e => setMasterConfig({...safeConfig, bgColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.bgColor}}></div>
                  </div>
                </div>
                <div className="bg-black/40 border border-gray-700 p-3 rounded-xl flex items-center justify-between">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fundo dos Cards/Header</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={safeConfig.cardBgColor} onChange={e => setMasterConfig({...safeConfig, cardBgColor: e.target.value})} className="bg-transparent w-20 outline-none font-mono text-white text-sm" />
                    <div className="w-6 h-6 rounded-md border border-gray-600" style={{backgroundColor: safeConfig.cardBgColor}}></div>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">Google AI Studio Key (Gemini API para a Esteira)</label>
                <input type="password" value={safeConfig.geminiKey} onChange={e => setMasterConfig({...safeConfig, geminiKey: e.target.value})} className="w-full p-3 bg-black/40 border border-gray-700 rounded-xl outline-none text-white focus:border-cyan-500 font-mono text-sm" placeholder="AIzaSy..." />
                <p className="text-[10px] font-bold text-blue-500 mt-1 uppercase tracking-wide">Usada para a IA da Esteira Kanban geradora de textos do Master.</p>
              </div>
              <div className="pt-4 border-t border-gray-800">
                <button onClick={() => { setMainView('dashboard'); showToast("Cores e Configurações Aplicadas!"); }} className="w-full text-white p-4 rounded-xl font-bold shadow-lg" style={gradientStyle}>Salvar e Voltar ao Dashboard</button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section>
              <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2" style={{ color: safeConfig.secondaryColor }}>
                <Activity size={20} className="text-cyan-500"/> Visão Global da Agência
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard cardBg={safeConfig.cardBgColor} title="Clientes Conectados" value={`${onlineClients} / ${totalClients}`} icon={<Server/>} color="text-emerald-400" bg="bg-emerald-400/10" border="border-emerald-500/20" />
                <StatCard cardBg={safeConfig.cardBgColor} title="Faturas Pendentes" value={globalPendencies} icon={<DollarSign/>} color="text-rose-400" bg="bg-rose-400/10" border="border-rose-500/20" />
                <StatCard cardBg={safeConfig.cardBgColor} title="Posts Prontos p/ Agendar" value={globalAprovados} icon={<KanbanSquare/>} color="text-amber-400" bg="bg-amber-400/10" border="border-amber-500/20" />
                <StatCard cardBg={safeConfig.cardBgColor} title="Leads Gerados (Últ. Relatório)" value={globalLeads} icon={<TrendingUp/>} color="text-blue-400" bg="bg-blue-400/10" border="border-blue-500/20" />
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2" style={{ color: safeConfig.primaryColor }}>
                  <Users size={20} className="text-blue-500"/> Instâncias (VPS Clientes)
                </h2>
                {isSuper && (
                  <button onClick={() => setAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors">
                    <Plus size={16} /> Nova Conexão VPS
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {clients.length === 0 && (
                  <div className="col-span-full text-center py-20 rounded-3xl border border-gray-800" style={{ backgroundColor: safeConfig.cardBgColor }}>
                    <Globe size={48} className="mx-auto text-gray-700 mb-4" />
                    <p className="text-gray-400 font-bold">Nenhum painel de cliente conectado.</p>
                    <p className="text-sm text-gray-600 mt-2">Clique em "Nova Conexão VPS" para adicionar o link de um cliente.</p>
                  </div>
                )}
                
                {clients.map(client => (
                  <div key={client.id} className="rounded-2xl border border-gray-800 overflow-hidden flex flex-col relative group hover:border-gray-600 transition-colors" style={{ backgroundColor: safeConfig.cardBgColor }}>
                    <div className="p-5 border-b border-gray-800 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-xl font-black text-white">{client.name}</h3>
                          {client.status === 'online' ? <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md uppercase border border-emerald-500/20"><CheckCircle2 size={12}/> Online</span> : 
                           client.status === 'offline' ? <span className="flex items-center gap-1 text-[10px] font-bold bg-rose-500/10 text-rose-400 px-2 py-1 rounded-md uppercase border border-rose-500/20"><XCircle size={12}/> Erro API</span> :
                           <span className="text-[10px] font-bold bg-gray-800 text-gray-400 px-2 py-1 rounded-md uppercase border border-gray-700">Não Sincronizado</span>}
                        </div>
                        <a href={client.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 font-mono">
                          {client.url} <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => syncClient(client)} className="p-2 bg-black/30 hover:bg-black/50 rounded-lg text-gray-300 transition-colors" title="Sincronizar Dados">
                          <RefreshCw size={16} className={syncingId === client.id ? 'animate-spin text-cyan-400' : ''} />
                        </button>
                        {isSuper && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setEditingClient(client); }} className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors" title="Editar Cliente">
                              <Edit3 size={16} />
                            </button>
                            <button onClick={() => { if(confirm('Remover conexão deste cliente?')) setClients(clients.filter(c => c.id !== client.id))}} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors" title="Remover Cliente">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-5 flex-1 bg-black/20">
                      {client.error ? (
                        <div className="text-rose-400 text-xs bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 font-mono break-words">
                          <strong>Falha de Conexão:</strong> {client.error}
                        </div>
                      ) : client.data ? (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Posts Aprovados</p>
                            <p className="text-xl font-black text-white">{safeArray(client.data.kanban).filter(k => k.col === 'Aprovados').length || 0}</p>
                          </div>
                          <div className="text-center border-x border-gray-800">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Faturas Abertas</p>
                            <p className={`text-xl font-black ${safeArray(client.data.finances).filter(f => f.status !== 'Pago').length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {safeArray(client.data.finances).filter(f => f.status !== 'Pago').length || 0}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Últimos Leads</p>
                            <p className="text-xl font-black text-cyan-400">{safeArray(client.data.reports)?.[0]?.leads || 0}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-xs text-gray-600 font-bold uppercase py-4">Aguardando Sincronização...</div>
                      )}
                    </div>
                    
                    <button onClick={() => { setActiveClientId(client.id); setActiveClientTab('geral'); }} className="w-full bg-black/40 p-3 text-center border-t border-gray-800 text-gray-400 font-bold text-xs uppercase flex items-center justify-center gap-2 hover:text-white hover:bg-black/60 transition-colors">
                      Abrir Painel do Cliente <ArrowRight size={14}/>
                    </button>
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
          <div className="rounded-3xl w-full max-w-5xl border border-gray-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] overflow-hidden" style={{ backgroundColor: safeConfig.cardBgColor }}>
            
            <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-black/30 flex-shrink-0">
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
                <button onClick={() => setActiveClientTab('geral')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeClientTab === 'geral' ? 'text-white shadow-lg' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`} style={activeClientTab === 'geral' ? primaryBg : {}}>Mídias</button>
                <button onClick={() => setActiveClientTab('kanban')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeClientTab === 'kanban' ? 'text-white shadow-lg' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`} style={activeClientTab === 'kanban' ? primaryBg : {}}>
                  <KanbanSquare size={16}/> Esteira Kanban
                </button>
                {isMaster && (
                  <button onClick={() => setActiveClientTab('finance')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeClientTab === 'finance' ? 'text-white shadow-lg' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`} style={activeClientTab === 'finance' ? primaryBg : {}}>
                    <CreditCard size={16}/> Financeiro & Docs
                  </button>
                )}
                {isMaster && activeClient.data?.config?.lookerStudioUrl && (
                  <button onClick={() => setActiveClientTab('looker')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeClientTab === 'looker' ? 'text-white shadow-lg' : 'bg-black/40 text-gray-400 hover:bg-black/60'}`} style={activeClientTab === 'looker' ? primaryBg : {}}>
                    <BarChart3 size={16}/> Data Studio
                  </button>
                )}
                <div className="w-px bg-gray-700 mx-1 hidden md:block"></div>
                <button onClick={() => setActiveClientId(null)} className="px-4 py-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors font-bold">Fechar</button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8 relative">
              
              {/* ABA GERAL */}
              {activeClientTab === 'geral' && (
                <section>
                  <div className="flex items-center gap-2 border-b border-gray-800 pb-3 mb-4">
                    <CalendarDays className="text-amber-400"/>
                    <h3 className="text-lg font-black text-white uppercase tracking-widest">Ações: Posts Aprovados (Aguardando Agendamento)</h3>
                  </div>
                  {(!activeClient.data?.kanban || safeArray(activeClient.data.kanban).filter(k => k.col === 'Aprovados').length === 0) ? (
                    <div className="text-center py-8 bg-black/20 rounded-2xl border border-gray-800 text-gray-500 font-bold">Nenhum post aguardando agendamento.</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {safeArray(activeClient.data.kanban).filter(k => k.col === 'Aprovados').map(card => {
                        let selectedDate = ''; 
                        return (
                          <div key={card.id} className="bg-black/40 p-5 rounded-2xl border border-gray-700 flex flex-col justify-between shadow-lg">
                            <div className="mb-4">
                              <h4 className="font-bold text-lg text-white leading-tight mb-2">{card.title}</h4>
                              <p className="text-sm text-gray-400 line-clamp-2">{card.desc || card.caption || 'Sem descrição.'}</p>
                            </div>
                            <div className="bg-[#111827] p-3 rounded-xl border border-gray-800">
                              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block mb-2">Definir Data de Postagem</label>
                              <div className="flex gap-2">
                                <input type="date" onChange={e => selectedDate = e.target.value} className="flex-1 bg-black/50 border border-gray-700 text-white rounded-lg p-2 text-sm outline-none" />
                                <button onClick={() => schedulePost(activeClient, card.id, selectedDate)} className="text-white font-bold px-4 py-2 rounded-lg text-sm shadow-lg" style={primaryBg}>Programar</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* ABA: ESTEIRA KANBAN MIRROR */}
              {activeClientTab === 'kanban' && (
                <div className="h-[65vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-3">
                     <h3 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2"><KanbanSquare className="text-blue-400"/> Gestão de Cards</h3>
                     <button onClick={() => setEditingCard({ id: 'new', title: 'Novo Card', desc: '', link: '', col: 'Ideias', date: '', isCarousel: false, carousel: [], caption: '', comments: [] })} className="text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-transform hover:scale-105" style={primaryBg}>
                        <Plus size={14}/> Novo Card
                     </button>
                  </div>
                  <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-stretch snap-x custom-scrollbar">
                    {kanbanColumns.map(col => (
                      <div key={col} 
                           className="bg-black/20 border border-gray-700/50 min-w-[280px] w-[280px] rounded-2xl p-4 flex flex-col h-full snap-start"
                           onDragOver={onDragOver}
                           onDrop={(e) => onDropKanban(e, col, activeClient)}>
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
                          <h3 className="font-bold text-white text-sm">{col}</h3>
                          <span className="text-xs font-bold px-2 py-1 rounded-full bg-gray-800 text-gray-400 border border-gray-600 shadow-inner">
                            {safeArray(activeClient.data?.kanban).filter(c => c.col === col).length}
                          </span>
                        </div>
                        <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar flex-1 h-full">
                          {safeArray(activeClient.data?.kanban).filter(c => c.col === col).map(card => (
                            <div key={card.id} 
                                 draggable 
                                 onDragStart={(e) => onDragStart(e, card.id)} 
                                 onDragEnd={onDragEnd}
                                 onClick={() => setEditingCard(card)}
                                 className="kanban-card bg-[#111827] p-4 rounded-xl border border-gray-700 cursor-pointer hover:border-blue-500 transition-colors shadow-md relative"
                                 data-id={card.id}>
                              <h4 className="font-bold text-white text-sm mb-2">{card.title}</h4>
                              <p className="text-xs text-gray-400 line-clamp-2 mb-3">{card.desc || card.caption || 'Sem descrição/legenda.'}</p>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
                                 <span className="text-[10px] text-gray-500 font-bold uppercase">{card.col}</span>
                                 {card.date ? <span className="text-[10px] text-amber-400 font-bold bg-amber-400/10 px-2 py-1 rounded border border-amber-500/20">📅 {formatSafeDate(card.date)}</span> : <span className="text-[10px] text-gray-600">Sem data</span>}
                              </div>
                            </div>
                          ))}
                          {safeArray(activeClient.data?.kanban).filter(c => c.col === col).length === 0 && (
                            <div className="text-center py-6 border-2 border-dashed border-gray-700 rounded-xl opacity-50 flex-1 flex items-center justify-center pointer-events-none">
                              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Soltar Aqui</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <div className="bg-black/40 border border-gray-700 rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-800/50 text-xs uppercase tracking-widest text-gray-500 border-b border-gray-700">
                            <th className="p-4">Descrição</th><th className="p-4">Status</th><th className="p-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {safeArray(activeClient.data?.finances).map((fin) => (
                            <tr key={fin.id} className="border-b border-gray-800 last:border-0 hover:bg-black/60 transition-colors">
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
                        <div key={doc.id} className="bg-black/40 border border-gray-700 p-4 rounded-xl flex items-center justify-between">
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
                      {(!activeClient.data?.docs || safeArray(activeClient.data.docs).length === 0) && <div className="col-span-full py-6 text-center text-gray-500 text-sm font-bold bg-black/40 rounded-xl border border-gray-700">Sem documentos cadastrados.</div>}
                    </div>
                  </section>
                </div>
              )}

              {/* ABA: LOOKER STUDIO */}
              {activeClientTab === 'looker' && isMaster && (
                <div className="flex flex-col h-[75vh] bg-white rounded-2xl overflow-hidden relative border border-gray-700">
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

            {/* OVERLAY PARA EDIÇÃO DE CARD KANBAN */}
            {editingCard && (
              <div className="absolute inset-0 bg-[#0d131f]/95 backdrop-blur-md z-20 flex items-center justify-center p-4 md:p-6">
                 <div className="bg-[#111827] rounded-3xl p-6 md:p-8 w-full max-w-4xl border border-gray-700 shadow-2xl flex flex-col max-h-full">
                    <h3 className="text-xl font-black text-white mb-4 border-b border-gray-800 pb-3 flex justify-between items-center flex-shrink-0">
                      Detalhes do Card <button onClick={()=>setEditingCard(null)} className="text-gray-500 hover:text-white"><X size={20}/></button>
                    </h3>
                    
                    <div className="overflow-y-auto flex-1 custom-scrollbar space-y-5 pr-2">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Título do Card</label>
                        <input value={editingCard.title} onChange={e => setEditingCard({...editingCard, title: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm font-bold focus:border-blue-500 transition-colors" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Data Programada</label>
                          <input type="date" value={editingCard.date || ''} onChange={e => setEditingCard({...editingCard, date: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm focus:border-blue-500 transition-colors" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Status (Coluna)</label>
                          <select value={editingCard.col} onChange={e => setEditingCard({...editingCard, col: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm font-bold focus:border-blue-500 transition-colors">
                            {kanbanColumns.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Descrição / Roteiro</label>
                        <textarea rows={3} value={editingCard.desc || ''} onChange={e => setEditingCard({...editingCard, desc: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm resize-none focus:border-blue-500 transition-colors" placeholder="Detalhes do conteúdo..." />
                      </div>
                      
                      <div className="bg-[#1F2937] border border-gray-700 p-4 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Link da Mídia (Drive)</label>
                          <label className="flex items-center gap-2 text-xs font-bold text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={editingCard.isCarousel || false} onChange={e => setEditingCard({...editingCard, isCarousel: e.target.checked})} className="accent-blue-600" />
                            Modo Carrossel
                          </label>
                        </div>
                        {!editingCard.isCarousel ? (
                          <input value={editingCard.link || ''} placeholder="Cole o link do Google Drive" onChange={e => setEditingCard({...editingCard, link: e.target.value})} className="w-full p-3 bg-[#111827] border border-gray-800 rounded-xl outline-none text-white text-sm focus:border-blue-500 transition-colors" />
                        ) : (
                          <div className="space-y-2">
                            {(editingCard.carousel || []).map((link, i) => (
                              <input key={i} value={link} placeholder={`Link ${i+1}`} onChange={e => {
                                const newC = [...(editingCard.carousel || [])]; newC[i] = e.target.value; setEditingCard({...editingCard, carousel: newC});
                              }} className="w-full p-3 bg-[#111827] border border-gray-800 rounded-xl outline-none text-white text-sm focus:border-blue-500 transition-colors" />
                            ))}
                            <button onClick={() => setEditingCard({...editingCard, carousel: [...(editingCard.carousel || []), '']})} className="text-xs font-bold text-blue-400 flex items-center gap-1 w-full justify-center p-2 hover:bg-blue-500/10 rounded-lg transition-colors"><Plus size={14}/> Adicionar Slide</button>
                          </div>
                        )}
                        
                        {/* --- PREVIEWS DO GOOGLE DRIVE --- */}
                        <div className="mt-4 flex flex-col gap-4">
                          {!editingCard.isCarousel && editingCard.link && editingCard.link.includes('drive.google.com') && (
                            <iframe src={formatDriveLink(editingCard.link)} className="w-full h-72 border border-gray-600 rounded-xl bg-[#111827] shadow-sm" title="Preview"></iframe>
                          )}
                          {editingCard.isCarousel && editingCard.carousel.map((link, idx) => link && link.includes('drive.google.com') && (
                            <div key={idx} className="flex flex-col gap-1">
                              <span className="text-xs font-bold text-gray-500 uppercase">Preview {idx + 1}</span>
                              <iframe src={formatDriveLink(link)} className="w-full h-72 border border-gray-600 rounded-xl bg-[#111827] shadow-sm" title={`Preview ${idx + 1}`}></iframe>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">Legenda (Copy)</label>
                        <textarea rows={4} value={editingCard.caption || ''} onChange={e => setEditingCard({...editingCard, caption: e.target.value})} className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none text-white text-sm resize-none focus:border-blue-500 transition-colors" placeholder="Escreva a legenda..." />
                      </div>
                    </div>
                    
                    <div className="pt-4 mt-4 border-t border-gray-800 flex justify-between gap-3 flex-shrink-0">
                      <button onClick={() => {
                        if (window.confirm('Apagar este card da esteira?')) {
                          const idToDel = editingCard.id;
                          setEditingCard(null);
                          const updated = safeArray(activeClient.data?.kanban).filter(c => c.id !== idToDel);
                          saveClientData(activeClient, 'kanban', updated);
                        }
                      }} className="px-5 py-3 rounded-xl font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-2">
                        <Trash2 size={16}/> Apagar Card
                      </button>
                      <div className="flex gap-3">
                        <button onClick={()=>setEditingCard(null)} className="px-5 py-3 rounded-xl font-bold bg-gray-800 text-gray-400 hover:text-white transition-colors">Cancelar</button>
                        <button onClick={()=>handleSaveCard(activeClient)} className="px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-[1.02]" style={primaryBg}>Salvar Alterações</button>
                      </div>
                    </div>
                 </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAIS (ADICIONAR E EDITAR CLIENTE) */}
      {(addModalOpen || editingClient) && isSuper && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <Globe style={{ color: safeConfig.primaryColor }}/> {editingClient ? 'Editar Cliente' : 'Conectar Nova VPS'}
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (editingClient) {
                const updatedClient = {
                  ...editingClient,
                  name: e.target.nome.value,
                  url: e.target.url.value,
                  login: e.target.login.value,
                  pass: e.target.pass.value
                };
                setClients(prev => safeArray(prev).map(c => c.id === updatedClient.id ? updatedClient : c));
                setEditingClient(null);
                syncClient(updatedClient);
              } else {
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
              }
            }} className="space-y-4">
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nome do Cliente / Empresa</label>
                <input name="nome" required defaultValue={editingClient?.name || ''} placeholder="Ex: Agmaq Agro" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-cyan-500 text-white" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">URL do Painel do Cliente</label>
                <input name="url" required defaultValue={editingClient?.url || ''} placeholder="https://painel-cliente.com" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-cyan-500 text-white font-mono text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800 mt-4">
                <div className="col-span-full">
                  <p className="text-xs font-bold text-amber-500 flex items-center gap-1"><ShieldCheck size={14}/> Credenciais Admin da VPS</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Usuário Admin</label>
                  <input name="login" required defaultValue={editingClient?.login || 'master'} placeholder="master" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-cyan-500 text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Senha Admin</label>
                  <input name="pass" type="password" required defaultValue={editingClient?.pass || 'master123'} placeholder="***" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-cyan-500 text-white" />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => { setAddModalOpen(false); setEditingClient(null); }} className="flex-1 p-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 p-3 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105" style={primaryBg}>{editingClient ? 'Salvar Edição' : 'Conectar API'}</button>
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
function StatCard({ title, value, icon, color, bg, border, cardBg }) {
  return (
    <div className={`p-5 rounded-2xl border ${border} flex flex-col justify-between transition-colors`} style={{ backgroundColor: cardBg }}>
      <div className="flex justify-between items-start mb-2">
        <span className={`p-2 rounded-lg border ${border} ${color} ${bg}`}>{icon}</span>
      </div>
      <div>
        <h3 className="text-3xl font-black text-white mb-1">{value}</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      </div>
    </div>
  );
}
