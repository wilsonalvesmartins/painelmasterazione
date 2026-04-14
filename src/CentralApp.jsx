import React, { useState, useEffect } from 'react';
import { 
  Server, Globe, RefreshCw, Users, KanbanSquare, 
  DollarSign, TrendingUp, Plus, X, ExternalLink, 
  CheckCircle2, XCircle, ShieldCheck, Activity,
  Trash2, LogOut 
} from 'lucide-react';

// --- HOOK DE PERSISTÊNCIA LOCAL (Para o Painel Master) ---
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [state, setValue];
}

// --- DADOS MOCK PARA PREVIEW ---
const mockClientData = {
  kanban: [
    { id: '1', title: 'Post Carrossel', col: 'Aprovados', date: '2026-05-10' },
    { id: '2', title: 'Vídeo Reels', col: 'Produção', date: '' }
  ],
  finances: [
    { id: 1, desc: 'Gestão de Tráfego', due: '2026-05-05', status: 'Pendente', pix: '123' }
  ],
  reports: [
    { id: 1, leads: 120, cost: '4.50' }
  ]
};

// --- COMPONENTES DE UI ---
const Toast = ({ msg, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 4000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="hover:text-gray-300"><X size={16} /></button>
    </div>
  );
};

// --- APP CENTRAL (MASTER) ---
export default function CentralApp() {
  const [masterLogged, setMasterLogged] = useState(false);
  const [clients, setClients] = usePersistentState('azione_master_clients', []);
  const [toast, setToast] = useState('');
  
  const [syncingId, setSyncingId] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const showToast = (msg) => setToast(msg);

  // --- LÓGICA DE SINCRONIZAÇÃO (HTTP REQUEST PARA AS VPS) ---
  const syncClient = async (client) => {
    setSyncingId(client.id);
    try {
      let kanbanData, financesData, reportsData;

      // 1. Simulação para testes ou URL demo
      if (client.url.includes('demo') || client.url.includes('localhost')) {
        await new Promise(r => setTimeout(r, 1500)); // simula delay de rede
        if (client.login === 'admin' && client.pass === 'admin123') {
           kanbanData = mockClientData.kanban;
           financesData = mockClientData.finances;
           reportsData = mockClientData.reports;
        } else {
          throw new Error("Credenciais recusadas pelo cliente.");
        }
      } 
      // 2. HTTP Request Real para a VPS do Cliente
      else {
        // A) Verifica Credenciais buscando a rota de users do cliente
        const urlBase = client.url.replace(/\/$/, '');
        const resUsers = await fetch(`${urlBase}/api/data/users`);
        if (!resUsers.ok) throw new Error("VPS Inacessível (Erro 404/500)");
        
        const dataUsers = await resUsers.json();
        
        // Proteção contra Null caso o cliente não tenha salvo nada no banco ainda
        let usersArray = dataUsers?.data && Array.isArray(dataUsers.data) ? dataUsers.data : (Array.isArray(dataUsers) ? dataUsers : []);
        
        // CORREÇÃO: Se a VPS for recém-instalada, o banco de dados estará vazio. 
        // Nesse caso, o Master confia nas credenciais padrão para conectar a primeira vez.
        if (usersArray.length === 0) {
          usersArray = [
            { login: 'gestor', pass: 'gestor123', role: 'administrador' },
            { login: 'admin', pass: 'admin123', role: 'administrador' }
          ];
        }

        const isValid = usersArray.find(u => u.login === client.login && u.pass === client.pass && ['gestor', 'administrador'].includes(u.role));
        if (!isValid) throw new Error("Acesso Negado: Senha incorreta ou sem permissão de Admin.");

        // B) Busca os Dados Reais
        const [resK, resF, resR] = await Promise.all([
          fetch(`${urlBase}/api/data/kanban`),
          fetch(`${urlBase}/api/data/finances`),
          fetch(`${urlBase}/api/data/reports`)
        ]);

        const jsonK = await resK.json();
        const jsonF = await resF.json();
        const jsonR = await resR.json();

        // Proteção Extra contra bancos de dados vazios (Null)
        kanbanData = jsonK?.data || (Array.isArray(jsonK) ? jsonK : []);
        financesData = jsonF?.data || (Array.isArray(jsonF) ? jsonF : []);
        reportsData = jsonR?.data || (Array.isArray(jsonR) ? jsonR : []);
      }

      // 3. Atualiza o estado central com os dados daquele cliente
      setClients(prev => prev.map(c => c.id === client.id ? {
        ...c, 
        status: 'online', 
        lastSync: new Date().toISOString(),
        error: null,
        data: { kanban: kanbanData, finances: financesData, reports: reportsData }
      } : c));

      showToast(`Sincronizado: ${client.name}`);

    } catch (err) {
      setClients(prev => prev.map(c => c.id === client.id ? {
        ...c, status: 'offline', error: err.message
      } : c));
      showToast(`Erro em ${client.name}: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = () => {
    clients.forEach(c => syncClient(c));
  };

  // Login da Central
  if (!masterLogged) {
    return (
      <div className="min-h-screen bg-[#0A0F1C] flex items-center justify-center p-4 font-sans text-gray-200">
        <div className="bg-[#111827] p-10 rounded-3xl shadow-2xl border border-gray-800 w-full max-w-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
              <Server className="text-blue-400" size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white text-center mb-2">Painel Master</h1>
          <p className="text-center text-gray-500 mb-8 text-sm">Azione Marketing - Central de Operações</p>
          
          <form onSubmit={(e) => { e.preventDefault(); if(e.target.pass.value === 'master2026') setMasterLogged(true); else showToast("Senha de diretoria incorreta!"); }} className="space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2">Chave de Acesso Global</label>
              <input name="pass" type="password" placeholder="••••••••" required className="w-full p-4 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white font-mono tracking-widest" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-cyan-500/25 transition-all">Conectar à Central</button>
          </form>
          <p className="text-center text-xs text-gray-600 mt-6">Senha padrão: <span className="text-gray-400">master2026</span></p>
        </div>
        {toast && <Toast msg={toast} onClose={() => setToast('')} />}
      </div>
    );
  }

  // Cálculos Consolidados
  const totalClients = clients.length;
  const onlineClients = clients.filter(c => c.status === 'online').length;
  
  let globalPendencies = 0;
  let globalLeads = 0;
  let globalAprovados = 0;

  clients.forEach(c => {
    if (c.data?.finances) globalPendencies += c.data.finances.filter(f => f.status !== 'Pago').length;
    if (c.data?.reports?.length > 0) globalLeads += Number(c.data.reports[0].leads || 0);
    if (c.data?.kanban) globalAprovados += c.data.kanban.filter(k => k.col === 'Aprovados' || k.col === 'Programados').length;
  });

  return (
    <div className="min-h-screen bg-[#0B1120] text-gray-300 font-sans flex flex-col">
      {/* Topbar */}
      <header className="bg-[#111827] border-b border-gray-800 p-4 sticky top-0 z-40">
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
            <button onClick={syncAll} className="flex items-center gap-2 bg-[#1F2937] hover:bg-[#374151] border border-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
              <RefreshCw size={16} className={syncingId ? 'animate-spin text-cyan-400' : 'text-gray-400'} /> 
              <span className="hidden sm:inline">Sincronizar Todos</span>
            </button>
            <button onClick={() => setMasterLogged(false)} className="text-red-400 hover:text-red-300 p-2">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* DASHBOARD CONSOLIDADO */}
        <section>
          <h2 className="text-lg font-black text-white mb-4 uppercase tracking-widest flex items-center gap-2">
            <Activity size={20} className="text-cyan-500"/> Visão Global da Agência
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Clientes Conectados" value={`${onlineClients} / ${totalClients}`} icon={<Server/>} color="text-emerald-400" bg="bg-emerald-400/10" border="border-emerald-500/20" />
            <StatCard title="Faturas Pendentes" value={globalPendencies} icon={<DollarSign/>} color="text-rose-400" bg="bg-rose-400/10" border="border-rose-500/20" />
            <StatCard title="Posts p/ Agendar" value={globalAprovados} icon={<KanbanSquare/>} color="text-amber-400" bg="bg-amber-400/10" border="border-amber-500/20" />
            <StatCard title="Leads (Últ. Relatório)" value={globalLeads} icon={<TrendingUp/>} color="text-blue-400" bg="bg-blue-400/10" border="border-blue-500/20" />
          </div>
        </section>

        {/* LISTA DE VPS / CLIENTES */}
        <section>
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Users size={20} className="text-blue-500"/> Instâncias (VPS Clientes)
            </h2>
            <button onClick={() => setAddModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg flex items-center gap-2 transition-colors">
              <Plus size={16} /> <span className="hidden sm:inline">Novo Cliente</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {clients.length === 0 && (
              <div className="col-span-full text-center py-20 bg-[#111827] rounded-3xl border border-gray-800">
                <Globe size={48} className="mx-auto text-gray-700 mb-4" />
                <p className="text-gray-400 font-bold text-lg">Nenhum painel de cliente conectado.</p>
                <p className="text-sm text-gray-600 mt-2">Clique em "Novo Cliente" para adicionar o link do sistema de um cliente.</p>
              </div>
            )}
            
            {clients.map(client => (
              <div key={client.id} className="bg-[#111827] rounded-2xl border border-gray-800 overflow-hidden flex flex-col relative group hover:border-gray-600 transition-colors shadow-lg">
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
                    <button onClick={() => syncClient(client)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors" title="Sincronizar Dados">
                      <RefreshCw size={16} className={syncingId === client.id ? 'animate-spin text-cyan-400' : ''} />
                    </button>
                    <button onClick={() => { if(window.confirm('Remover conexão deste cliente?')) setClients(clients.filter(c => c.id !== client.id))}} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* DADOS PUXADOS DA VPS (CONSOLIDADO DO CLIENTE) */}
                <div className="p-5 flex-1 bg-[#0d131f]">
                  {client.error ? (
                    <div className="text-rose-400 text-xs bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 font-mono break-words">
                      <strong>Falha de Conexão:</strong> {client.error}
                    </div>
                  ) : client.data ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Posts Aprovados</p>
                        <p className="text-xl font-black text-white">{client.data.kanban?.filter(k => k.col === 'Aprovados').length || 0}</p>
                      </div>
                      <div className="text-center border-x border-gray-800">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Faturas Abertas</p>
                        <p className={`text-xl font-black ${client.data.finances?.filter(f => f.status !== 'Pago').length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {client.data.finances?.filter(f => f.status !== 'Pago').length || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">Últimos Leads</p>
                        <p className="text-xl font-black text-cyan-400">{client.data.reports?.[0]?.leads || 0}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-gray-600 font-bold uppercase py-4">Aguardando Sincronização...</div>
                  )}
                </div>
                
                {client.lastSync && (
                  <div className="bg-[#111827] p-2 text-center text-[9px] text-gray-500 uppercase tracking-widest border-t border-gray-800">
                    Última sincronização: {new Date(client.lastSync).toLocaleString('pt-BR')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* MODAL ADICIONAR CLIENTE */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
            <h3 className="text-2xl font-black text-white mb-6 flex items-center gap-3">
              <Globe className="text-blue-500"/> Conectar Novo Cliente
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
              setClients([...clients, newClient]);
              setAddModalOpen(false);
              syncClient(newClient); // Tenta sincronizar na hora
            }} className="space-y-4">
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nome do Cliente / Empresa</label>
                <input name="nome" required placeholder="Ex: Agmaq Agro" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">URL do Painel do Cliente</label>
                <input name="url" required placeholder="https://painel-agmaq.com.br" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white font-mono text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800 mt-4">
                <div className="col-span-full">
                  <p className="text-xs font-bold text-amber-500 flex items-center gap-1"><ShieldCheck size={14}/> Credenciais de Administrador do Painel</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Usuário Admin</label>
                  <input name="login" required placeholder="gestor" defaultValue="gestor" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Senha Admin</label>
                  <input name="pass" type="password" required placeholder="***" defaultValue="gestor123" className="w-full p-3 bg-[#1F2937] border border-gray-700 rounded-xl outline-none focus:border-blue-500 text-white" />
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setAddModalOpen(false)} className="flex-1 p-3 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 p-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">Conectar API</button>
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
function StatCard({ title, value, icon, color, bg, border }) {
  return (
    <div className={`p-5 rounded-2xl border ${border} ${bg} flex flex-col justify-between shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <span className={`p-2.5 rounded-xl bg-[#111827] border ${border} ${color}`}>{icon}</span>
      </div>
      <div>
        <h3 className="text-3xl font-black text-white mb-1">{value}</h3>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{title}</p>
      </div>
    </div>
  );
}
