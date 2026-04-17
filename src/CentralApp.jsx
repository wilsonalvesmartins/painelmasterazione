import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, KanbanSquare, CalendarDays, TrendingUp, 
  DollarSign, FileText, Settings, LogOut, Plus, X, 
  MessageSquare, Calendar, Link as LinkIcon, Image, 
  Bot, Save, Edit3, Trash2, ChevronDown, ChevronUp, Copy, Download,
  BarChart3, FileSearch, Eye, EyeOff
} from 'lucide-react';

// --- FUNÇÕES DE SEGURANÇA MÁXIMA PARA EVITAR TELA BRANCA (CRASH) ---
const safeArray = (arr) => Array.isArray(arr) ? arr : [];
const safeObject = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

// Formata links do Google Drive para modo de visualização (Embed)
const formatDriveLink = (url) => {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
};

// --- FUNÇÃO AUXILIAR DE NOMENCLATURA DE CARGOS ---
const getDisplayRole = (role) => {
  if (role === 'empresa') return 'Cliente Completo';
  if (role === 'visualizador') return 'Cliente Visualizador';
  if (role === 'financeiro') return 'Financeiro';
  if (role === 'master') return 'Master';
  if (role === 'social media') return 'Social Media';
  if (role === 'gestor de tráfego') return 'Gestor de Tráfego';
  return role;
};

// --- MOTOR DA IA (COM RETRY E ESCOLHA INTELIGENTE DE MODELO) ---
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
  if (!userApiKey) throw new Error("Chave da API do Google Gemini não configurada.");
  const cleanKey = userApiKey.trim();
  
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
  let modelName = "";

  try {
    const listData = await fetchWithRetry(listUrl, { method: 'GET' });
    const validModels = (listData.models || []).filter(m => 
      m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini')
    );

    if (validModels.length === 0) throw new Error("A chave é válida, mas não tem permissão para usar modelos Gemini.");

    const preferredModel = 
      validModels.find(m => m.name.includes('1.5-flash')) ||
      validModels.find(m => m.name.includes('1.5-pro')) ||
      validModels.find(m => m.name.includes('2.5-flash')) ||
      validModels.find(m => m.name.includes('1.0-pro') || m.name === 'models/gemini-pro') ||
      validModels[0];

    modelName = preferredModel.name; 
  } catch (err) {
    throw new Error(`Falha ao validar a chave API no Google: ${err.message}`);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${cleanKey}`;
  let payload = {};
  
  if (modelName === 'models/gemini-pro' || modelName === 'models/gemini-1.0-pro') {
      payload = { contents: [{ parts: [{ text: `[INSTRUÇÕES DO SISTEMA]:\n${systemPrompt}\n\n[PEDIDO DO USUÁRIO]:\n${userPrompt}` }] }] };
  } else {
      payload = {
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] }
      };
  }

  const data = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Erro: Resposta vazia da IA.";
};

// --- DADOS PADRÃO ---
const defaultUsers = [
  { id: 1, login: 'cliente', pass: 'cliente123', role: 'empresa', name: 'Cliente Completo' },
  { id: 2, login: 'master', pass: 'master123', role: 'master', name: 'Master' },
  { id: 3, login: 'social', pass: 'social123', role: 'social media', name: 'Social Media' },
  { id: 4, login: 'trafego', pass: 'trafego123', role: 'gestor de tráfego', name: 'Gestor de Tráfego' },
  { id: 5, login: 'financeiro', pass: 'fin123', role: 'financeiro', name: 'Financeiro' },
  { id: 6, login: 'visu', pass: 'visu123', role: 'visualizador', name: 'Aprovador' }
];

const defaultKanban = [
  { id: '1', title: 'Campanha Inicial', desc: 'Vídeo promocional.', link: '', col: 'Ideias', date: '', isCarousel: false, carousel: [], caption: '', comments: [] }
];

const defaultFinances = [
  { id: 1, desc: 'Fatura Abril', due: '2026-04-20', pix: '000.000.000-00', boleto: '', nf: '', status: 'Pendente' }
];

const defaultReports = [{ 
  id: 1, name: 'Fechamento de Performance', month: '2026-03', type: 'manual', date: new Date().toISOString().split('T')[0], 
  leads: 150, cost: '5.50', contracts: 10, attachment: '', custom: [{ label: 'Alcance Total', value: '45.000' }] 
}];

const defaultDocs = [{ id: 1, title: 'Contrato Social', date: '2025-01-10', link: '' }];

const defaultConfig = { 
  companyName: 'Azione Marketing', logo: '', color: '#EF4444', secondaryColor: '#991B1B', bgColor: '#F3F4F6', textColor: '#1F2937', geminiKey: '',
  lookerStudioUrl: 'https://lookerstudio.google.com/reporting/10b2cbf5-4b1f-4f87-a96a-855d8067c523/page/4E6KF'
};

// --- HOOK DE PERSISTÊNCIA ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const local = localStorage.getItem(`azione_${key}`);
      if (!local || local === 'null' || local === 'undefined') return initialValue;
      const parsed = JSON.parse(local);
      if (Array.isArray(initialValue) && !Array.isArray(parsed)) return initialValue;
      if (typeof initialValue === 'object' && !Array.isArray(initialValue) && (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null)) return initialValue;
      return parsed;
    } catch (e) { return initialValue; }
  });
  
  const [isLoaded, setIsLoaded] = useState(false);

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
            localStorage.setItem(`azione_${key}`, JSON.stringify(newState));
            return newState;
          });
        }
        setIsLoaded(true);
      })
      .catch(err => { setIsLoaded(true); });
  }, [key]);

  const setPersistentState = (newValue) => {
    const valueToStore = typeof newValue === 'function' ? newValue(state) : newValue;
    setState(valueToStore);
    fetch(`/api/data/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: valueToStore }) }).catch(() => {});
    localStorage.setItem(`azione_${key}`, JSON.stringify(valueToStore));
  };

  return [state, setPersistentState, isLoaded];
}

const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce max-w-md border border-gray-700">
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="hover:text-gray-300 flex-shrink-0"><X size={16} /></button>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('kanban');
  const [toast, setToast] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [users, setUsers, uLoad] = usePersistentState('users', defaultUsers);
  const [kanban, setKanban, kLoad] = usePersistentState('kanban', defaultKanban);
  const [reports, setReports, rLoad] = usePersistentState('reports', defaultReports);
  const [finances, setFinances, fLoad] = usePersistentState('finances', defaultFinances);
  const [docs, setDocs, dLoad] = usePersistentState('docs', defaultDocs);
  const [config, setConfig, cLoad] = usePersistentState('config', defaultConfig);

  const [openCardId, setOpenCardId] = useState(null);

  const showToast = (msg) => setToast(msg);

  if (!uLoad || !kLoad || !rLoad || !fLoad || !dLoad || !cLoad) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-pulse text-xl font-bold text-gray-500">Conectando ao banco de dados...</div></div>;
  }

  const safeConf = { ...defaultConfig, ...config };
  const appStyles = { backgroundColor: safeConf.bgColor, color: safeConf.textColor };

  const handleLogin = (e) => {
    e.preventDefault();
    const login = e.target.login.value; const pass = e.target.pass.value;
    const found = safeArray(users).find(u => u.login === login && u.pass === pass);
    if (found) { 
      setUser(found); 
      // Direcionamento dinâmico dependendo da role
      if (found.role === 'gestor de tráfego') setView('traffic');
      else if (found.role === 'financeiro') setView('finance');
      else setView('kanban'); 
    } 
    else { showToast('Credenciais inválidas!'); }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 transition-colors duration-500" style={{ backgroundColor: safeConf.bgColor }}>
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-gray-100">
          {safeConf.logo ? <img src={safeConf.logo} alt="Logo" className="h-20 mx-auto mb-6 object-contain" /> : <h1 className="text-3xl font-black mb-6" style={{ color: safeConf.color }}>{safeConf.companyName}</h1>}
          <form onSubmit={handleLogin} className="space-y-4 relative">
            <input name="login" type="text" placeholder="Usuário" required className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 bg-gray-50 text-gray-800" style={{ focusRing: safeConf.color }} />
            
            <div className="relative">
              <input 
                name="pass" 
                type={showPassword ? "text" : "password"} 
                placeholder="Senha" 
                required 
                className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:ring-2 bg-gray-50 text-gray-800 pr-12" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button type="submit" className="w-full text-white p-4 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] shadow-lg" style={{ backgroundColor: safeConf.color }}>Acessar Painel</button>
          </form>
          <div className="mt-6 text-sm text-gray-500 flex flex-col gap-1">
            <p className="font-bold">Acesso Administrativo:</p>
            <p>master / master123</p>
          </div>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  // --- CONTROLE DE ACESSO (PERMISSÕES E MENUS) ---
  const menuItems = [
    { id: 'kanban', label: 'Esteira', icon: <KanbanSquare size={20} />, roles: ['empresa', 'master', 'social media', 'gestor de tráfego', 'visualizador'] },
    { id: 'calendar', label: 'Cronograma', icon: <CalendarDays size={20} />, roles: ['empresa', 'master', 'social media', 'visualizador'] },
    { id: 'traffic', label: 'Dados de Tráfego', icon: <TrendingUp size={20} />, roles: ['empresa', 'master', 'gestor de tráfego', 'visualizador'] },
    { id: 'finance', label: 'Financeiro', icon: <DollarSign size={20} />, roles: ['empresa', 'master', 'financeiro'] },
    { id: 'docs', label: 'Documentos', icon: <FileText size={20} />, roles: ['empresa', 'master', 'financeiro'] },
    { id: 'settings', label: 'Configurações', icon: <Settings size={20} />, roles: ['master'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen flex flex-col md:flex-row transition-colors duration-500 font-sans" style={appStyles}>
      <aside className="bg-white border-r border-gray-200 md:w-64 flex-shrink-0 flex flex-col justify-between shadow-sm z-10" style={{ borderTop: `5px solid ${safeConf.color}` }}>
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-8 overflow-hidden">
            {safeConf.logo ? <img src={safeConf.logo} alt="Logo" className="h-10 flex-shrink-0 object-contain" /> : <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl shadow-md" style={{ backgroundColor: safeConf.color }}>AZ</div>}
            <div className="hidden md:block truncate">
              <h2 className="font-bold text-gray-800 leading-tight truncate text-lg">{safeConf.companyName}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{getDisplayRole(user.role)}</p>
            </div>
          </div>
          <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {menuItems.map(item => (
              <button key={item.id} onClick={() => setView(item.id)} className={`flex items-center gap-3 p-3 rounded-xl transition-all whitespace-nowrap font-semibold ${view === item.id ? 'text-white shadow-md' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`} style={view === item.id ? { backgroundColor: safeConf.color } : {}}>
                {item.icon} <span className="hidden md:block">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-5 border-t border-gray-100 hidden md:block">
          <button onClick={() => setUser(null)} className="flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 p-3 rounded-xl w-full transition-colors font-bold">
            <LogOut size={18} /> Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[100vw] flex flex-col relative" style={{ color: safeConf.textColor }}>
        <div className="flex-1 w-full max-w-7xl mx-auto">
          {view === 'kanban' && <KanbanView data={safeArray(kanban)} setData={setKanban} user={user} config={safeConf} showToast={showToast} openCardId={openCardId} setOpenCardId={setOpenCardId} />}
          {view === 'calendar' && <CalendarView data={safeArray(kanban)} config={safeConf} onOpenCard={(id) => { setView('kanban'); setOpenCardId(id); }} />}
          {view === 'traffic' && <TrafficView data={safeArray(reports)} setData={setReports} user={user} config={safeConf} showToast={showToast} />}
          {view === 'finance' && <FinanceView data={safeArray(finances)} setData={setFinances} user={user} config={safeConf} showToast={showToast} />}
          {view === 'docs' && <DocsView data={safeArray(docs)} setData={setDocs} user={user} config={safeConf} />}
          {view === 'settings' && <SettingsView config={safeConf} setConfig={setConfig} users={safeArray(users)} setUsers={setUsers} showToast={showToast} />}
        </div>
        
        <footer className="mt-12 pt-6 border-t border-gray-200/50 text-center text-xs font-semibold" style={{ color: `${safeConf.textColor}80` }}>
          Este é um app oficial Azione Marketing, todos os direitos reservados!
        </footer>
      </main>
      {toast && <Toast msg={toast} onClose={() => setToast('')} />}
    </div>
  );
}

// ==========================================
// VIEWS (Telas Secundárias)
// ==========================================

function KanbanView({ data, setData, user, config, showToast, openCardId, setOpenCardId }) {
  const columns = ['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'];
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    if (openCardId) {
      const cardToOpen = data.find(c => c.id === openCardId);
      if (cardToOpen) setActiveCard(cardToOpen);
      setOpenCardId(null);
    }
  }, [openCardId, data, setOpenCardId]);

  const onDragStart = (e, id) => {
    e.dataTransfer.setData('cardId', id);
    setTimeout(() => { if(e.target) e.target.style.opacity = '0.5'; }, 0);
  };

  const onDragEnd = (e) => {
    if(e.target) e.target.style.opacity = '1';
  };

  const onDragOver = (e) => e.preventDefault();

  const onDropKanban = (e, col) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    if (!cardId) return;

    let kanbanArray = [...safeArray(data)];
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
    
    setData(kanbanArray);
  };

  const createCard = () => {
    const newCard = { id: Date.now().toString(), title: 'Nova Ideia', desc: '', link: '', col: 'Ideias', date: '', isCarousel: false, carousel: [], caption: '', comments: [] };
    setData([...data, newCard]);
    setActiveCard(newCard);
  };

  const deleteCard = (id) => {
    if (window.confirm('Tem certeza que deseja apagar este card permanentemente?')) {
      setData(prev => safeArray(prev).filter(c => c.id !== id));
      setActiveCard(null);
      showToast('Card apagado com sucesso.');
    }
  };

  const canCreate = ['master', 'social media', 'gestor de tráfego'].includes(user.role);

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Esteira de Produção</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Gerencie cards, arraste para reordenar e acompanhe o funil.</p>
        </div>
        {canCreate && (
          <button onClick={createCard} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg hover:opacity-90 font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Novo Card
          </button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 flex-1 items-stretch snap-x custom-scrollbar">
        {columns.map(col => (
          <div key={col} 
               className="bg-white/40 backdrop-blur-md border border-gray-200/50 min-w-[300px] w-[300px] rounded-2xl p-4 flex flex-col h-full snap-start shadow-sm" 
               onDragOver={onDragOver} 
               onDrop={(e) => onDropKanban(e, col)}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200/50">
              <h3 className="font-bold text-lg opacity-90">{col}</h3>
              <span className="text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm" style={{ backgroundColor: config.secondaryColor }}>{data.filter(c => c.col === col).length}</span>
            </div>
            
            <div className="flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar flex-1 h-full">
              {data.filter(c => c.col === col).map(card => (
                <div key={card.id} 
                     draggable 
                     onDragStart={(e) => onDragStart(e, card.id)} 
                     onDragEnd={onDragEnd}
                     onClick={() => setActiveCard(card)} 
                     className="kanban-card bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-blue-300 transition-all group relative"
                     data-id={card.id}>
                  <h4 className="font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{card.title}</h4>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mt-3 pt-3 border-t border-gray-50">
                    {card.date ? <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(card.date).toLocaleDateString('pt-BR')}</span> : <span>Sem data</span>}
                    <span className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md"><MessageSquare size={12}/> {safeArray(card.comments).length}</span>
                  </div>
                </div>
              ))}
              {data.filter(c => c.col === col).length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl opacity-50 flex-1 flex items-center justify-center pointer-events-none">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Soltar Aqui</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeCard && (
        <CardModal 
          card={activeCard} 
          user={user} 
          config={config} 
          showToast={showToast} 
          onClose={() => setActiveCard(null)} 
          onDelete={() => deleteCard(activeCard.id)}
          onSave={(updated) => {
            setData(prev => safeArray(prev).map(c => c.id === updated.id ? updated : c));
            setActiveCard(null);
          }} 
        />
      )}
    </div>
  );
}

function CardModal({ card, user, config, onClose, onSave, onDelete, showToast }) {
  const [draft, setDraft] = useState({ ...card, comments: safeArray(card.comments), carousel: safeArray(card.carousel) });
  const [commentText, setCommentText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const canEditCore = ['master', 'social media', 'gestor de tráfego'].includes(user.role);

  const handleAI = async () => {
    setAiLoading(true);
    try {
      const prompt = `Título do Post: ${draft.title}. Descrição: ${draft.desc}. Detalhes extras: ${aiPrompt}`;
      const systemInstruction = `Você é um copywriter sênior focado em redes sociais.
REGRA 1: Escreva UMA ÚNICA legenda focada em conversão, com um bom CTA e hashtags estratégicas.
REGRA 2: Você está PROIBIDO de dizer "Aqui está a legenda", "Opção 1", "Claro, vamos lá!", ou fazer perguntas no final.
REGRA 3: Não use separadores (---) ou títulos. Apenas devolva O TEXTO PURO E FINAL DA LEGENDA para ser copiado.`;
      
      const textoGerado = await callGeminiWithFallback(prompt, systemInstruction, config.geminiKey);
      
      setDraft({ ...draft, caption: textoGerado });
      showToast(`Legenda gerada com sucesso pela IA!`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setAiLoading(false);
      setAiPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white text-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-white/20">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl flex-shrink-0">
          <h2 className="text-xl font-black">Detalhes do Card</h2>
          <button onClick={onClose} className="p-2 bg-white rounded-full hover:bg-gray-200 shadow-sm transition-colors text-gray-500"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 bg-white custom-scrollbar">
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Título</label>
              <input disabled={!canEditCore} value={draft.title} onChange={e => setDraft({...draft, title: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50 font-bold text-lg" />
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Data Programada</label>
                {/* Aberto a todos que acessam o Kanban (Empresa, Visualizador, Master, etc) */}
                <input type="date" value={draft.date} onChange={e => setDraft({...draft, date: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status (Coluna)</label>
                <select value={draft.col} onChange={e => setDraft({...draft, col: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white font-semibold">
                  {['Ideias', 'Produção', 'Finalizados', 'Aprovados', 'Rejeitados', 'Programados', 'Postados'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Descrição / Roteiro</label>
              {/* Descrição agora liberada para os clientes escreverem e editarem */}
              <textarea rows={3} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50/50 resize-none" placeholder="Detalhes do conteúdo..." />
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Link da Mídia (Drive)</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200 cursor-pointer">
                  <input type="checkbox" disabled={!canEditCore} checked={draft.isCarousel} onChange={e => setDraft({...draft, isCarousel: e.target.checked})} className="accent-blue-600" />
                  Modo Carrossel
                </label>
              </div>
              
              {!draft.isCarousel ? (
                <input disabled={!canEditCore} value={draft.link} placeholder="Cole o link do Google Drive" onChange={e => setDraft({...draft, link: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white shadow-inner mb-2 text-sm" />
              ) : (
                <div className="space-y-2">
                  {draft.carousel.map((link, i) => (
                    <input key={i} disabled={!canEditCore} value={link} placeholder={`Link da Imagem/Vídeo ${i+1}`} onChange={e => {
                      const newC = [...draft.carousel]; newC[i] = e.target.value; setDraft({...draft, carousel: newC});
                    }} className="w-full p-3 border border-gray-200 rounded-xl text-sm bg-white shadow-inner" />
                  ))}
                  {canEditCore && draft.carousel.length < 15 && (
                    <button onClick={() => setDraft({...draft, carousel: [...draft.carousel, '']})} className="text-sm font-bold text-blue-600 flex items-center gap-1 w-full justify-center p-2 hover:bg-blue-50 rounded-lg transition-colors"><Plus size={16}/> Adicionar Slide</button>
                  )}
                </div>
              )}
              
              <div className="mt-4 flex flex-col gap-4">
                {!draft.isCarousel && draft.link && draft.link.includes('drive.google.com') && (
                  <iframe src={formatDriveLink(draft.link)} className="w-full h-72 border border-gray-200 rounded-xl bg-white shadow-sm" title="Preview"></iframe>
                )}
                {draft.isCarousel && draft.carousel.map((link, idx) => link && link.includes('drive.google.com') && (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">Preview {idx + 1}</span>
                    <iframe src={formatDriveLink(link)} className="w-full h-72 border border-gray-200 rounded-xl bg-white shadow-sm" title={`Preview ${idx + 1}`}></iframe>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5 flex flex-col">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Legenda (Copy)</label>
              <textarea disabled={!canEditCore} value={draft.caption} onChange={e => setDraft({...draft, caption: e.target.value})} className="w-full p-4 border border-gray-200 rounded-xl outline-none focus:border-blue-500 flex-1 min-h-[150px] resize-none mb-3 bg-gray-50/50 leading-relaxed text-gray-700 custom-scrollbar" placeholder="Escreva a legenda..." />
              
              {canEditCore && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-2xl">
                  <p className="text-xs font-black text-blue-800 mb-3 flex items-center gap-1.5 uppercase tracking-wider"><Bot size={16}/> Gerador Automático de Legenda (IA)</p>
                  <input placeholder="Instruções curtas: Tom descontraído, fale sobre X..." value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full text-sm p-3 border border-white/60 rounded-xl outline-none mb-3 bg-white/80 shadow-inner focus:border-blue-300" />
                  <button onClick={handleAI} disabled={aiLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md">
                    {aiLoading ? <span className="animate-pulse">Gerando Legenda com IA...</span> : 'Criar Legenda Incrível'}
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Comentários e Feedbacks</label>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 h-48 overflow-y-auto space-y-3 mb-3 custom-scrollbar shadow-inner">
                {draft.comments.length === 0 && <p className="text-xs font-medium text-gray-400 text-center mt-6">Nenhuma observação ainda.</p>}
                {draft.comments.map((c, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-sm ${['empresa', 'visualizador'].includes(c.author) ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100 shadow-sm'}`}>
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="font-bold text-gray-800 uppercase tracking-wider">{getDisplayRole(c.author)}</span>
                      <span className="text-gray-400 font-medium">{new Date(c.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short'})}</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">{c.text}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Deixe um comentário..." className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 transition-colors" />
                <button onClick={() => {
                  if(!commentText.trim()) return;
                  setDraft({...draft, comments: [...draft.comments, { author: user.role, text: commentText, date: new Date().toISOString() }]});
                  setCommentText('');
                }} className="bg-gray-800 hover:bg-black text-white px-5 rounded-xl font-bold shadow-md transition-colors"><Plus size={18}/></button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-between gap-3 rounded-b-2xl flex-shrink-0">
          {canEditCore ? (
            <button onClick={onDelete} className="px-5 py-2.5 font-bold text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-2 rounded-xl transition-colors"><Trash2 size={18}/> Apagar Card</button>
          ) : <div></div>}
          <div className="flex gap-3">
             <button onClick={onClose} className="px-6 py-2.5 font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-xl transition-colors">Cancelar</button>
             <button onClick={() => onSave(draft)} className="px-6 py-2.5 font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
               <Save size={18}/> Salvar e Fechar
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ data, config, onOpenCard }) {
  const progCards = data.filter(c => c.col === 'Programados' && c.date).sort((a,b) => new Date(a.date) - new Date(b.date));
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black">Cronograma de Postagens</h1>
        <p className="text-sm font-medium opacity-70 mt-1">Visualize os conteúdos com data marcada para ir ao ar.</p>
      </div>
      <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-gray-200/50">
        <div className="space-y-4">
          {progCards.length === 0 && (
            <div className="text-center py-12">
              <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold opacity-60">Nenhum post programado com data definida.</p>
            </div>
          )}
          {progCards.map(c => {
             const safeDate = new Date(c.date.length === 10 ? `${c.date}T12:00:00` : c.date);
             return (
              <div key={c.id} className="flex flex-col md:flex-row md:items-center p-5 border-l-[6px] rounded-r-2xl bg-white shadow-sm hover:shadow-md transition-shadow group" style={{ borderLeftColor: config.color }}>
                <div className="w-full md:w-32 flex-shrink-0 text-center border-b md:border-b-0 md:border-r border-gray-100 pb-3 md:pb-0 md:pr-5 mb-3 md:mb-0">
                  <p className="text-3xl font-black" style={{ color: config.color }}>{safeDate.getDate()}</p>
                  <p className="text-xs uppercase font-black opacity-40">{safeDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="md:pl-5 flex-1 mb-4 md:mb-0">
                  <h3 className="font-black text-lg group-hover:text-blue-600 transition-colors">{c.title}</h3>
                  <p className="text-sm opacity-70 line-clamp-2 mt-1">{c.caption || c.desc}</p>
                </div>
                <div className="md:px-4 flex flex-row md:flex-col gap-2 items-start md:items-end w-full md:w-auto">
                  <span className="text-xs font-bold bg-gray-100 py-1.5 px-4 rounded-full border border-gray-200 uppercase tracking-wider opacity-80">Agendado</span>
                  <button onClick={() => onOpenCard(c.id)} className="text-xs font-bold bg-gray-800 hover:bg-black text-white py-1.5 px-4 rounded-full transition-colors shadow-sm w-full md:w-auto">Ver no Kanban</button>
                </div>
              </div>
             );
          })}
        </div>
      </div>
    </div>
  );
}

function TrafficView({ data, setData, user, config, showToast }) {
  const isClientReadOnly = ['empresa', 'visualizador'].includes(user.role);
  const isAdmin = ['master', 'gestor de tráfego'].includes(user.role);
  const [activeTab, setActiveTab] = useState('dataStudio'); 
  const [expandedId, setExpandedId] = useState(null);

  const getEmbedUrl = (url) => {
    if(!url) return '';
    if(url.includes('/embed/')) return url;
    return url.replace('/u/0/reporting/', '/embed/reporting/').replace('/reporting/', '/embed/reporting/');
  };

  const addReport = () => {
    const newRep = { 
      id: Date.now(), 
      name: 'Novo Fechamento', 
      month: new Date().toISOString().slice(0, 7), 
      type: 'manual', 
      date: new Date().toISOString().split('T')[0], 
      leads: 0, cost: '0', contracts: 0, 
      attachment: '', custom: [] 
    };
    setData([newRep, ...data]);
    setExpandedId(newRep.id);
  };

  const updateReport = (idx, changes) => {
    const n = [...data];
    n[idx] = { ...n[idx], ...changes };
    setData(n);
  };

  const deleteReport = (id) => {
    if(window.confirm('Atenção: Tem certeza que deseja excluir este relatório?')) {
      setData(data.filter(r => r.id !== id));
      showToast('Relatório apagado com sucesso.');
    }
  };

  return (
    <div className="w-full flex flex-col h-full max-w-[1200px] mx-auto">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black">Dados de Tráfego</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Dashboard Data Studio e Relatórios de Performance.</p>
        </div>
        
        <div className="flex bg-gray-200/50 p-1 rounded-xl w-fit">
          <button onClick={() => setActiveTab('dataStudio')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dataStudio' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-800'}`}>
            <BarChart3 size={16}/> Dashboard Data Studio
          </button>
          <button onClick={() => setActiveTab('reports')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'reports' ? 'bg-white shadow-sm text-green-600' : 'text-gray-500 hover:text-gray-800'}`}>
            <FileSearch size={16}/> {isClientReadOnly ? 'Relatórios Mensais' : 'Gerenciar Relatórios'}
          </button>
        </div>
      </div>

      {activeTab === 'dataStudio' && (
        <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden flex flex-col min-h-[600px] relative">
          {config.lookerStudioUrl ? (
            <iframe src={getEmbedUrl(config.lookerStudioUrl)} frameBorder="0" style={{ border: 0 }} allowFullScreen className="w-full flex-1 h-full min-h-[700px]"></iframe>
          ) : (
            <div className="flex flex-col items-center justify-center h-full flex-1 p-12 text-center opacity-60">
              <BarChart3 size={64} className="mb-4" />
              <h3 className="text-xl font-bold">Dashboard não configurado</h3>
              <p className="text-sm mt-2">Insira a URL do Data Studio na aba Configurações.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="w-full max-w-4xl mx-auto space-y-4 pb-10">
          {isAdmin && (
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 p-4 rounded-2xl flex-shrink-0 mb-4">
              <p className="text-sm font-semibold text-blue-800 leading-tight">Cadastre novos fechamentos manualmente ou através de PDFs.</p>
              <button onClick={addReport} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl shadow-lg font-bold transition-transform hover:scale-105 flex-shrink-0" style={{ backgroundColor: config.color }}>
                <Plus size={16} /> Novo Relatório
              </button>
            </div>
          )}
          
          {data.length === 0 && (
             <div className="text-center py-10 bg-white/50 rounded-2xl border border-gray-200 font-bold text-gray-400">Nenhum relatório cadastrado no momento.</div>
          )}

          {data.map((rep, idx) => (
            <div key={rep.id} className="bg-white rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden hover:shadow-md transition-shadow flex-shrink-0">
              <div onClick={() => setExpandedId(expandedId === rep.id ? null : rep.id)} className="p-5 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 truncate">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner flex-shrink-0" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><TrendingUp size={20}/></div>
                  <div className="truncate">
                    <h3 className="font-black text-lg text-gray-800 truncate">{rep.name || 'Relatório de Performance'}</h3>
                    <p className="text-xs font-bold opacity-60 mt-0.5">Mês de Referência: {rep.month || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin && (
                     <button onClick={(e) => { e.stopPropagation(); deleteReport(rep.id); }} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors" title="Apagar"><Trash2 size={16}/></button>
                  )}
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-500 shadow-sm">
                    {expandedId === rep.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </div>
                </div>
              </div>

              {expandedId === rep.id && (
                <div className="border-t border-gray-100">
                  
                  {/* Edição Admin */}
                  {isAdmin && (
                    <div className="p-5 bg-gray-50/80 border-b border-gray-200/50">
                      
                      <div className="flex gap-4 mb-6 bg-gray-200 p-1.5 rounded-xl w-fit">
                        <button onClick={() => updateReport(idx, {type: 'manual'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${rep.type !== 'pdf' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Inserir Dados Manualmente</button>
                        <button onClick={() => updateReport(idx, {type: 'pdf'})} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${rep.type === 'pdf' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>Inserir PDF Personalizado</button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Nome do Relatório</label>
                          <input value={rep.name || ''} onChange={e => updateReport(idx, {name: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-gray-800 focus:border-blue-400 text-sm" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Mês Ref.</label>
                          <input type="month" value={rep.month || ''} onChange={e => updateReport(idx, {month: e.target.value})} className="w-full p-2.5 bg-white border border-gray-200 rounded-lg outline-none font-bold text-gray-800 focus:border-blue-400 text-sm" />
                        </div>
                      </div>

                      {rep.type !== 'pdf' ? (
                        <>
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Métricas Base Manuais</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            <MetricBox label="Leads" val={rep.leads} onChange={v => updateReport(idx, {leads: v})} edit={true} color={config.color} />
                            <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} onChange={v => updateReport(idx, {cost: v.replace('R$ ', '')})} edit={true} color={config.color} />
                            <MetricBox label="Contratos" val={rep.contracts} onChange={v => updateReport(idx, {contracts: v})} edit={true} color={config.color} />
                            {safeArray(rep.custom).map((c, cidx) => (
                              <div key={cidx} className="relative group">
                                <MetricBox label={c.label} val={c.value} onChange={v => { const custom = [...rep.custom]; custom[cidx].value = v; updateReport(idx, {custom}); }} edit={true} color={config.color} />
                                <button onClick={() => { const custom = [...rep.custom]; custom.splice(cidx, 1); updateReport(idx, {custom}); }} className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                              </div>
                            ))}
                            <div className="border-2 border-dashed border-gray-300 p-2 rounded-xl flex items-center justify-center bg-white hover:bg-gray-50 cursor-pointer" onClick={() => { const label = prompt("Métrica (Ex: Investimento):"); if(label) { const custom = [...safeArray(rep.custom), { label, value: '0' }]; updateReport(idx, {custom}); } }}>
                               <span className="text-xs font-bold text-gray-500">+ Métrica</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Link do PDF (Google Drive)</h4>
                          <input value={rep.attachment || ''} onChange={e => updateReport(idx, {attachment: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-white shadow-sm focus:border-blue-400" placeholder="Cole o link de visualização ou edição do Google Drive..." />
                          <p className="text-[10px] font-bold text-blue-600">O sistema converterá automaticamente este link para visualizar o PDF aqui dentro.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* VISÃO FINAL DO RELATÓRIO (Todos vêem) */}
                  <div className="p-6 bg-white flex flex-col">
                    <div className="flex flex-col mb-6 gap-1 border-b border-gray-100 pb-4">
                      <h2 className="text-xl font-black leading-tight" style={{ color: config.color }}>{rep.name || 'Fechamento de Performance'}</h2>
                      <p className="text-sm font-semibold opacity-60">Referência: {rep.month || 'N/A'}</p>
                    </div>

                    {rep.type === 'pdf' ? (
                      <div className="w-full h-[600px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-sm">
                        {rep.attachment ? (
                          <iframe src={formatDriveLink(rep.attachment)} className="w-full h-full" frameBorder="0" allowFullScreen title="Relatório PDF"></iframe>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">PDF ainda não inserido pelo Gestor.</div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricBox label="Leads" val={rep.leads} color={config.color} />
                        <MetricBox label="Custo / Lead" val={`R$ ${rep.cost}`} color={config.color} />
                        <MetricBox label="Contratos" val={rep.contracts} color={config.color} />
                        {safeArray(rep.custom).map((c, cidx) => (
                           <MetricBox key={cidx} label={c.label} val={c.value} color={config.color} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, val, onChange, edit, color }) {
  return (
    <div className="bg-white p-3 md:p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
      <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1.5 line-clamp-1">{label}</span>
      {edit ? (
        <input value={val || ''} onChange={e => onChange(e.target.value)} className="font-black text-xl text-center w-full outline-none border-b focus:border-opacity-100 border-transparent transition-colors bg-transparent" style={{ color: color, borderBottomColor: color }} />
      ) : (
        <span className="font-black text-xl" style={{ color: color }}>{val}</span>
      )}
    </div>
  );
}

function FinanceView({ data, setData, user, config, showToast }) {
  const isAdmin = user.role === 'master';
  const [editingFin, setEditingFin] = useState(null);

  const copyPix = (pix) => {
    if(!pix) return showToast("Nenhuma chave PIX!");
    const el = document.createElement('textarea'); el.value = pix; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    showToast("PIX copiado!");
  };

  const handleSaveModal = (updatedFin) => {
    if(updatedFin.id === 'new') setData([...data, { ...updatedFin, id: Date.now() }]);
    else setData(safeArray(data).map(d => d.id === updatedFin.id ? updatedFin : d));
    setEditingFin(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Departamento Financeiro</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Controle de faturas, boletos, PIX e Notas Fiscais.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setEditingFin({ id: 'new', desc: 'Nova Cobrança Mensalidade', due: '', pix: '', boleto: '', nf: '', status: 'Pendente' })} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Nova Fatura
          </button>
        )}
      </div>

      <div className="bg-white/60 backdrop-blur-md rounded-3xl shadow-sm border border-gray-200/50 overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-100/50 text-sm uppercase tracking-wider font-bold opacity-70 border-b border-gray-200/50">
              <th className="p-5">Descrição do Serviço</th><th className="p-5">Vencimento</th><th className="p-5">Status</th><th className="p-5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.map((fin) => {
              const safeDate = new Date(fin.due?.length === 10 ? `${fin.due}T12:00:00` : fin.due);
              return (
              <tr key={fin.id} className="border-b border-gray-100 hover:bg-white transition-colors">
                <td className="p-5 font-black text-gray-800 text-lg">{fin.desc}</td>
                <td className="p-5 font-semibold opacity-80">{fin.due ? safeDate.toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td className="p-5">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border shadow-sm ${fin.status === 'Pago' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                    {fin.status || 'Pendente'}
                  </span>
                </td>
                <td className="p-5 flex gap-2 justify-end">
                  <button onClick={() => copyPix(fin.pix)} className="p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 shadow-sm transition-colors" title="Copiar PIX"><Copy size={18}/></button>
                  <a href={fin.boleto || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.boleto && e.preventDefault()} className={`p-2.5 rounded-xl shadow-sm transition-colors ${fin.boleto ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}`} title="Baixar Boleto"><FileText size={18}/></a>
                  <a href={fin.nf || '#'} target="_blank" rel="noreferrer" onClick={e => !fin.nf && e.preventDefault()} className={`p-2.5 rounded-xl shadow-sm transition-colors ${fin.nf ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100' : 'bg-gray-50 text-gray-300 cursor-not-allowed border border-gray-100'}`} title="Baixar NF"><Download size={18}/></a>
                  {isAdmin && (
                    <>
                      <div className="w-px bg-gray-200 mx-1"></div>
                      <button onClick={() => setEditingFin(fin)} className="p-2.5 bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 border border-yellow-100 shadow-sm" title="Editar"><Edit3 size={18}/></button>
                      <button onClick={() => {setData(data.filter(d => d.id !== fin.id)); showToast("Fatura apagada!");}} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100 shadow-sm" title="Apagar"><Trash2 size={18}/></button>
                    </>
                  )}
                </td>
              </tr>
            )})}
            {data.length === 0 && <tr><td colSpan="4" className="p-10 text-center font-bold opacity-50">Nenhuma fatura encontrada.</td></tr>}
          </tbody>
        </table>
      </div>

      {editingFin && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl space-y-5 text-gray-800">
            <h3 className="text-2xl font-black border-b border-gray-100 pb-4">Detalhes da Cobrança</h3>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Descrição do Serviço</label>
              <input value={editingFin.desc} onChange={e => setEditingFin({...editingFin, desc: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white" />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Vencimento</label>
                <input type="date" value={editingFin.due} onChange={e => setEditingFin({...editingFin, due: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                <select value={editingFin.status || 'Pendente'} onChange={e => setEditingFin({...editingFin, status: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white">
                  <option value="Pendente">Pendente</option><option value="Pago">Pago</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Chave PIX</label>
              <input value={editingFin.pix} onChange={e => setEditingFin({...editingFin, pix: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link do Boleto</label>
              <input value={editingFin.boleto} onChange={e => setEditingFin({...editingFin, boleto: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Link da Nota Fiscal</label>
              <input value={editingFin.nf} onChange={e => setEditingFin({...editingFin, nf: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => setEditingFin(null)} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
              <button onClick={() => handleSaveModal(editingFin)} className="px-6 py-3 font-bold text-white rounded-xl shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>Salvar Fatura</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocsView({ data, setData, user, config }) {
  const isAdmin = user.role === 'master';
  const [editingDocLink, setEditingDocLink] = useState(null);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black">Documentos Oficiais</h1>
          <p className="text-sm font-medium opacity-70 mt-1">Acesso a contratos, aditivos e propostas.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setData([...data, { id: Date.now(), title: 'Novo Documento Legal', date: '', link: '' }])} className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>
            <Plus size={18} /> Upload de Arquivo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.map((doc, idx) => {
          const safeDate = new Date(doc.date?.length === 10 ? `${doc.date}T12:00:00` : doc.date);
          return (
          <div key={doc.id} className="bg-white/60 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-gray-200/50 flex flex-col gap-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-5 w-full pr-2">
                <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner" style={{ backgroundColor: `${config.secondaryColor}20`, color: config.secondaryColor }}><FileText size={28}/></div>
                <div className="w-full">
                  {isAdmin ? <input value={doc.title} onChange={e => { const n = [...data]; n[idx].title = e.target.value; setData(n); }} className="font-black text-lg border-b-2 border-transparent focus:border-gray-300 bg-transparent outline-none text-gray-800 w-full transition-colors" placeholder="Título Legal..." /> : <h3 className="font-black text-lg text-gray-800">{doc.title}</h3>}
                  {isAdmin ? <input type="date" value={doc.date} onChange={e => { const n = [...data]; n[idx].date = e.target.value; setData(n); }} className="text-xs font-bold opacity-60 bg-transparent outline-none mt-1 w-full" /> : <p className="text-xs font-bold opacity-60 mt-1">Data Assinatura: {doc.date ? safeDate.toLocaleDateString('pt-BR') : 'S/ Data'}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <button onClick={() => setEditingDocLink(editingDocLink === doc.id ? null : doc.id)} className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors"><Edit3 size={18}/></button>
                    <button onClick={() => setData(safeArray(data).filter(d => d.id !== doc.id))} className="p-3 bg-red-50 rounded-xl hover:bg-red-100 text-red-600 transition-colors"><Trash2 size={18}/></button>
                  </>
                )}
                <a href={doc.link || '#'} target="_blank" rel="noreferrer" onClick={e => !doc.link && e.preventDefault()} className={`p-3 rounded-xl transition-colors shadow-sm ${doc.link ? 'text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} style={doc.link ? { backgroundColor: config.color } : {}}><Download size={18}/></a>
              </div>
            </div>
            {editingDocLink === doc.id && (
              <div className="flex gap-2 w-full pt-4 border-t border-gray-100">
                <input autoFocus value={doc.link} onChange={e => { const n = [...data]; n[idx].link = e.target.value; setData(n); }} placeholder="https:// link do PDF (Drive)..." className="flex-1 p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 font-medium" />
                <button onClick={() => setEditingDocLink(null)} className="text-white px-5 rounded-xl font-bold shadow-md transition-transform hover:scale-105" style={{ backgroundColor: config.secondaryColor }}>Salvar</button>
              </div>
            )}
          </div>
        )})}
      </div>
    </div>
  );
}

function SettingsView({ config, setConfig, users, setUsers, showToast }) {
  const [newUser, setNewUser] = useState({ login: '', pass: '', role: 'empresa', name: '' });
  const [testingApi, setTestingApi] = useState(false);

  const handleTestApi = async () => {
    if (!config.geminiKey) return showToast("Insira a chave da API antes de testar.");
    setTestingApi(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.geminiKey}`);
      if (res.ok) showToast(`✅ Chave API validada e pronta para uso!`);
      else throw new Error("Chave inválida.");
    } catch (err) {
      showToast(`❌ Erro na chave: ${err.message}`);
    } finally {
      setTestingApi(false);
    }
  };

  const HexInput = ({ label, value, onChange }) => (
    <div>
      <label className="text-[10px] font-bold opacity-60 uppercase tracking-wider block mb-1">{label}</label>
      <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
        <input value={value} onChange={e => onChange(e.target.value)} className="w-full bg-transparent outline-none font-mono text-sm uppercase text-gray-700 px-2" placeholder="#000000" maxLength={7} />
        <div className="w-8 h-8 rounded-lg shadow-sm border border-gray-200 flex-shrink-0" style={{ backgroundColor: value }}></div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-black">Painel de Controle e Customização</h1>
        <p className="text-sm font-medium opacity-70 mt-1">Ajuste cores globais, links e gerencie os usuários do sistema.</p>
      </div>
      
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🎨 Identidade Visual (White-label)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Nome Fantasia do Painel</label>
              <input value={config.companyName} onChange={e => setConfig({...config, companyName: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none font-bold bg-gray-50 focus:bg-white focus:border-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">URL da Logotipo</label>
              <input value={config.logo} onChange={e => setConfig({...config, logo: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400" placeholder="Ex: https://..." />
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HexInput label="Cor Primária" value={config.color} onChange={v => setConfig({...config, color: v})} />
            <HexInput label="Cor Secundária" value={config.secondaryColor} onChange={v => setConfig({...config, secondaryColor: v})} />
            <HexInput label="Fundo Global" value={config.bgColor} onChange={v => setConfig({...config, bgColor: v})} />
            <HexInput label="Texto / Contraste" value={config.textColor} onChange={v => setConfig({...config, textColor: v})} />
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3 flex items-center gap-2">🔗 Motores Externos (Data Studio & IA)</h2>
        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Dashboard Embed URL (Data Studio)</label>
            <input value={config.lookerStudioUrl || ''} onChange={e => setConfig({...config, lookerStudioUrl: e.target.value})} className="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm bg-gray-50 focus:bg-white focus:border-blue-400 font-medium" placeholder="Cole o link do seu relatório Data Studio aqui..." />
            <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wide">Cole o link padrão e o sistema converterá em Embed Automaticamente.</p>
          </div>
          <div>
            <label className="text-xs font-bold opacity-60 uppercase tracking-wider block mb-1">Google AI Studio Key (Gemini API para a Esteira)</label>
            <div className="flex gap-2">
              <input type="password" value={config.geminiKey || ''} onChange={e => setConfig({...config, geminiKey: e.target.value})} className="flex-1 p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 focus:bg-white focus:border-blue-400 font-mono" placeholder="AIzaSy..." />
              <button onClick={handleTestApi} disabled={testingApi} className="bg-gray-800 text-white px-5 rounded-xl font-bold shadow-md hover:bg-black transition-colors disabled:opacity-50">
                {testingApi ? 'Testando...' : 'Verificar API'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Usado para gerar as legendas e copy dos posts na Esteira.</p>
          </div>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-sm border border-gray-200/50 space-y-6">
        <h2 className="text-xl font-black border-b border-gray-100 pb-3">👥 Gerenciamento de Acessos</h2>
        <div className="space-y-3">
          {safeArray(users).map((u, i) => (
            <div key={u.id} className="flex gap-3 items-center border border-gray-100 p-3 rounded-2xl bg-gray-50 shadow-inner">
              <span className="bg-white shadow-sm border border-gray-200 text-xs font-black px-3 py-1.5 rounded-lg uppercase tracking-wider w-32 text-center text-gray-700">{getDisplayRole(u.role)}</span>
              <input value={u.login} onChange={e => { const n = [...users]; n[i].login = e.target.value; setUsers(n); }} className="flex-1 outline-none font-bold text-gray-800 bg-transparent" placeholder="Login" />
              <div className="relative flex-1 flex items-center">
                 <input value={u.pass} onChange={e => { const n = [...users]; n[i].pass = e.target.value; setUsers(n); }} className="w-full outline-none text-gray-500 font-medium bg-transparent" placeholder="Senha" type="text" />
              </div>
              <button onClick={() => {if(users.length>1) setUsers(users.filter(usr=>usr.id!==u.id)); else showToast("Impossível apagar o último.")}} className="p-2.5 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"><Trash2 size={18}/></button>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200/50">
          <h3 className="text-sm font-black text-gray-800 mb-3 uppercase tracking-wider">Novo Colaborador / Cliente</h3>
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full md:w-48 bg-white shadow-sm focus:border-blue-400">
              <option value="empresa">Cliente Completo</option>
              <option value="visualizador">Cliente Visualizador</option>
              <option value="financeiro">Financeiro do Cliente</option>
              <option value="master">Master</option>
              <option value="gestor de tráfego">Gestor de Tráfego</option>
              <option value="social media">Social Media</option>
            </select>
            <input value={newUser.login} onChange={e => setNewUser({...newUser, login: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-bold text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Nome de Usuário" />
            <input value={newUser.pass} onChange={e => setNewUser({...newUser, pass: e.target.value})} className="flex-1 p-3.5 border border-gray-200 rounded-xl outline-none font-medium text-sm w-full bg-white shadow-sm focus:border-blue-400" placeholder="Senha Forte" type="text" />
            <button onClick={() => { if(newUser.login) { setUsers([...users, {...newUser, id:Date.now()}]); setNewUser({login:'', pass:'', role:'empresa', name:''}); showToast("Usuário adicionado!"); }}} className="w-full md:w-auto px-8 py-3.5 rounded-xl font-black text-white shadow-lg transition-transform hover:scale-105" style={{ backgroundColor: config.color }}>Adicionar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
