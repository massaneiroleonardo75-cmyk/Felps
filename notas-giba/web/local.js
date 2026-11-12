// Notas do Giba — motor local para a versão de link aberto (GitHub Pages).
// Oferece a mesma interface que o app usa no claude.ai (window.claude.use("db" | "assets" | "sample")),
// mas guardando tudo no próprio navegador (IndexedDB): os dados continuam lá depois de fechar o
// navegador ou desligar o computador. A leitura de fotos usa o Google Gemini (plano grátis) com a chave do usuário.
(() => {
  const NOME_BANCO = 'notas-giba';
  const CHAVE_API = 'notas-giba:chave-gemini';
  let idb = null;
  let abrindo = null;
  const cache = new Map(); // caminho -> dados
  const urls = new Map(); // id do arquivo -> object URL
  const ouvintes = new Set();
  const canal = 'BroadcastChannel' in window ? new BroadcastChannel('notas-giba') : null;

  const req = (r) => new Promise((ok, erro) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => erro(r.error))));
  const fim = (t) => new Promise((ok, erro) => ((t.oncomplete = ok), (t.onerror = () => erro(t.error)), (t.onabort = () => erro(t.error || new Error('abortado')))));
  const clonar = (v) => (v === undefined ? undefined : structuredClone(v));
  const erroEspaco = (e) =>
    Object.assign(new Error(e?.name === 'QuotaExceededError' ? 'O navegador está sem espaço para guardar. Faça um backup e apague notas antigas.' : 'Não consegui salvar no navegador. Recarregue a página.'), { code: 'armazenamento' });

  function abrir() {
    abrindo ??= new Promise((ok, erro) => {
      if (!('indexedDB' in window)) return erro(new Error('Este navegador não consegue guardar dados. Use Chrome, Edge, Safari ou Firefox atualizados.'));
      const r = indexedDB.open(NOME_BANCO, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('docs')) d.createObjectStore('docs');
        if (!d.objectStoreNames.contains('arquivos')) d.createObjectStore('arquivos');
      };
      r.onsuccess = async () => {
        idb = r.result;
        await recarregar();
        // pede para o navegador não apagar os dados sozinho quando faltar espaço
        try {
          await navigator.storage?.persist?.();
        } catch {}
        ok();
      };
      r.onerror = () => erro(r.error);
      r.onblocked = () => erro(new Error('Feche as outras abas do site e recarregue.'));
    });
    return abrindo;
  }

  async function recarregar() {
    const t = idb.transaction(['docs', 'arquivos']);
    const docs = t.objectStore('docs');
    const arqs = t.objectStore('arquivos');
    const [chaves, valores, idsArq, blobs] = await Promise.all([req(docs.getAllKeys()), req(docs.getAll()), req(arqs.getAllKeys()), req(arqs.getAll())]);
    cache.clear();
    chaves.forEach((k, i) => cache.set(k, valores[i]));
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
    idsArq.forEach((id, i) => urls.set(id, URL.createObjectURL(blobs[i])));
  }

  const avisar = () => setTimeout(() => ouvintes.forEach((f) => f()), 0);
  canal && (canal.onmessage = () => recarregar().then(avisar));

  async function gravar(caminho, valor) {
    await abrir();
    try {
      const t = idb.transaction('docs', 'readwrite');
      if (valor === undefined) t.objectStore('docs').delete(caminho);
      else t.objectStore('docs').put(valor, caminho);
      await fim(t);
    } catch (e) {
      throw erroEspaco(e);
    }
    if (valor === undefined) cache.delete(caminho);
    else cache.set(caminho, valor);
    avisar();
    canal?.postMessage('mudou');
  }

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const segmentos = (p) => p.split('/').length;
  const snapDoc = (caminho) => ({
    id: caminho.split('/').pop(),
    exists: cache.has(caminho),
    data: () => clonar(cache.get(caminho)),
    metadata: { fromCache: true, hasPendingWrites: false },
  });

  function doc(caminho) {
    return {
      id: caminho.split('/').pop(),
      path: caminho,
      get: async () => (await abrir(), snapDoc(caminho)),
      set: (dados) => gravar(caminho, clonar(dados)),
      update: async (dados) => {
        await abrir();
        if (!cache.has(caminho)) throw Object.assign(new Error('Registro não existe mais.'), { code: 'not_found' });
        await gravar(caminho, { ...cache.get(caminho), ...clonar(dados) });
      },
      delete: () => gravar(caminho, undefined),
      onSnapshot(prox, erro) {
        const f = () => prox(snapDoc(caminho));
        ouvintes.add(f);
        abrir().then(f, (e) => erro?.(e));
        return () => ouvintes.delete(f);
      },
      collection: (sub) => colecao(`${caminho}/${sub}`),
    };
  }

  function colecao(caminho) {
    const listar = () => {
      const docs = [...cache.keys()].filter((k) => k.startsWith(caminho + '/') && segmentos(k) === segmentos(caminho) + 1).map(snapDoc);
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: true, hasPendingWrites: false } };
    };
    return {
      path: caminho,
      doc: (id) => doc(`${caminho}/${id || novoId()}`),
      add: async (dados) => {
        const d = doc(`${caminho}/${novoId()}`);
        await d.set(dados);
        return d;
      },
      get: async () => (await abrir(), listar()),
      onSnapshot(prox, erro) {
        const f = () => prox(listar());
        ouvintes.add(f);
        abrir().then(f, (e) => erro?.(e));
        return () => ouvintes.delete(f);
      },
    };
  }

  const db = { doc, collection: colecao };

  const assets = {
    async upload(blob) {
      await abrir();
      const id = 'f' + novoId();
      try {
        const t = idb.transaction('arquivos', 'readwrite');
        t.objectStore('arquivos').put(blob, id);
        await fim(t);
      } catch (e) {
        throw erroEspaco(e);
      }
      const url = URL.createObjectURL(blob);
      urls.set(id, url);
      canal?.postMessage('mudou');
      return { id, url, sizeBytes: blob.size, contentType: blob.type };
    },
    async delete(id) {
      await abrir();
      const t = idb.transaction('arquivos', 'readwrite');
      t.objectStore('arquivos').delete(id);
      await fim(t);
      if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
      urls.delete(id);
    },
  };

  // ---------------- leitura de fotos com o Google Gemini (plano gratuito) ----------------
  // Chave grátis em aistudio.google.com/apikey. Fica guardada só neste aparelho.
  // Se a cota grátis de um modelo acabar, tenta o próximo da lista.
  const MODELOS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  const URL_API = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const T = (type, extra = {}) => ({ type, ...extra });
  const N = (type) => ({ type, nullable: true });
  const ITEM = T('OBJECT', {
    properties: {
      codigo: N('STRING'),
      descricao: T('STRING', { description: 'descrição exatamente como impressa na nota' }),
      nome_produto: T('STRING', { description: 'nome comercial claro e completo do produto, por extenso' }),
      categoria: N('STRING'),
      ncm: N('STRING'),
      quantidade: T('NUMBER'),
      unidade: N('STRING'),
      valor_unitario: T('NUMBER'),
      valor_total: T('NUMBER'),
      encomendas_ids: T('ARRAY', { items: T('STRING') }),
    },
    required: ['codigo', 'descricao', 'nome_produto', 'categoria', 'ncm', 'quantidade', 'unidade', 'valor_unitario', 'valor_total', 'encomendas_ids'],
  });
  const ESQUEMAS = {
    nota: T('OBJECT', {
      properties: {
        eh_nota_fiscal: T('BOOLEAN'),
        emitente_nome: N('STRING'),
        emitente_cnpj: N('STRING'),
        numero: N('STRING'),
        serie: N('STRING'),
        chave_acesso: N('STRING'),
        data_emissao: N('STRING'),
        itens: T('ARRAY', { items: ITEM }),
        valor_produtos: N('NUMBER'),
        frete: N('NUMBER'),
        seguro: N('NUMBER'),
        desconto: N('NUMBER'),
        outras_despesas: N('NUMBER'),
        impostos_adicionais: N('NUMBER'),
        valor_total: N('NUMBER'),
        avisos: T('ARRAY', { items: T('STRING') }),
      },
      required: ['eh_nota_fiscal', 'emitente_nome', 'emitente_cnpj', 'numero', 'serie', 'chave_acesso', 'data_emissao', 'itens', 'valor_produtos', 'frete', 'seguro', 'desconto', 'outras_despesas', 'impostos_adicionais', 'valor_total', 'avisos'],
    }),
    nomes: T('OBJECT', {
      properties: {
        itens: T('ARRAY', {
          items: T('OBJECT', {
            properties: { indice: T('INTEGER'), nome_produto: T('STRING'), categoria: N('STRING'), encomendas_ids: T('ARRAY', { items: T('STRING') }) },
            required: ['indice', 'nome_produto', 'categoria', 'encomendas_ids'],
          }),
        }),
      },
      required: ['itens'],
    }),
  };

  const lerChave = () => {
    try {
      return localStorage.getItem(CHAVE_API) || '';
    } catch {
      return '';
    }
  };

  const paraBase64 = (blob) =>
    new Promise((ok, erro) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1]);
      r.onerror = () => erro(r.error);
      r.readAsDataURL(blob);
    });

  async function chamarGemini(chave, modelo, corpo) {
    let r;
    try {
      r = await fetch(`${URL_API}${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpo),
      });
    } catch {
      throw { code: 'sem_internet' };
    }
    let dados = null;
    try {
      dados = await r.json();
    } catch {}
    if (r.ok) return dados;
    const status = dados?.error?.status || '';
    const razao = JSON.stringify(dados?.error?.details || '');
    console.warn('[gemini]', modelo, r.status, dados?.error?.message);
    if (r.status === 400 && /API_KEY_INVALID/.test(razao + status)) throw { code: 'chave_invalida' };
    if (r.status === 401 || r.status === 403) throw { code: 'chave_invalida' };
    if (r.status === 429 || r.status === 404 || status === 'RESOURCE_EXHAUSTED' || status === 'NOT_FOUND') throw { code: 'proximo_modelo', limite: r.status === 429 };
    if (r.status === 400) throw { code: 'pedido_recusado' };
    throw { code: 'proximo_modelo' };
  }

  function criarSample(chave) {
    return {
      provedor: 'gemini',
      limits: async () => ({ images: { maxCount: 8, maxInputBytes: 15 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] }, modelTiers: ['default'] }),
      async json(prompt, opcoes = {}) {
        const imagens = opcoes.images ? [].concat(opcoes.images) : [];
        const partes = [];
        for (const b of imagens) partes.push({ inline_data: { mime_type: b.type || 'image/jpeg', data: await paraBase64(b) } });
        partes.push({ text: prompt });
        const corpo = {
          contents: [{ role: 'user', parts: partes }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMAS[opcoes.tipo] || ESQUEMAS.nota, temperature: 0.1, maxOutputTokens: 16384 },
        };
        let limite = false;
        for (const modelo of MODELOS) {
          let dados;
          try {
            dados = await chamarGemini(chave, modelo, corpo);
          } catch (e) {
            if (e.code === 'proximo_modelo') {
              limite ||= e.limite;
              continue;
            }
            throw e;
          }
          if (dados?.promptFeedback?.blockReason) throw { code: 'refused' };
          const cand = dados?.candidates?.[0];
          const texto = (cand?.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
          if (!texto) {
            if (cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT') throw { code: 'refused' };
            continue;
          }
          try {
            return JSON.parse(texto.replace(/^```(?:json)?\s*|\s*```$/g, ''));
          } catch {
            if (cand?.finishReason === 'MAX_TOKENS') throw { code: 'prompt_too_large' };
            throw { code: 'invalid_json' };
          }
        }
        throw { code: limite ? 'limite_gratis' : 'upstream_error' };
      },
    };
  }

  // ---------------- backup ----------------
  async function exportar() {
    await abrir();
    const t = idb.transaction('arquivos');
    const s = t.objectStore('arquivos');
    const [ids, blobs] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
    const arquivos = {};
    for (let i = 0; i < ids.length; i++) arquivos[ids[i]] = { tipo: blobs[i].type, base64: await paraBase64(blobs[i]) };
    const conteudo = { app: 'notas-giba', versao: 1, exportado_em: new Date().toISOString(), docs: Object.fromEntries(cache), arquivos };
    return new Blob([JSON.stringify(conteudo)], { type: 'application/json' });
  }

  async function importar(arquivo) {
    await abrir();
    let dados;
    try {
      dados = JSON.parse(await arquivo.text());
    } catch {
      throw new Error('Este arquivo não é um backup válido.');
    }
    if (dados?.app !== 'notas-giba' || typeof dados.docs !== 'object') throw new Error('Este arquivo não é um backup do Notas do Giba.');
    const t = idb.transaction(['docs', 'arquivos'], 'readwrite');
    const docs = t.objectStore('docs');
    const arqs = t.objectStore('arquivos');
    docs.clear();
    arqs.clear();
    for (const [k, v] of Object.entries(dados.docs)) docs.put(v, k);
    for (const [id, a] of Object.entries(dados.arquivos || {})) {
      const bin = Uint8Array.from(atob(a.base64), (c) => c.charCodeAt(0));
      arqs.put(new Blob([bin], { type: a.tipo || 'image/jpeg' }), id);
    }
    try {
      await fim(t);
    } catch (e) {
      throw erroEspaco(e);
    }
    await recarregar();
    avisar();
    canal?.postMessage('mudou');
    return Object.keys(dados.docs).length;
  }

  async function espaco() {
    try {
      const [est, persistido] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
      return { usado: est?.usage || 0, total: est?.quota || 0, persistido: Boolean(persistido) };
    } catch {
      return null;
    }
  }

  window.__NOTAS_LOCAL = {
    url: (id) => urls.get(id) || '',
    chave: lerChave,
    salvarChave(chave) {
      try {
        if (chave) localStorage.setItem(CHAVE_API, chave);
        else localStorage.removeItem(CHAVE_API);
      } catch {
        throw new Error('O navegador não deixou guardar a chave (modo anônimo?).');
      }
    },
    exportar,
    importar,
    espaco,
  };

  window.claude = {
    async use(nome) {
      if (nome === 'db') return abrir().then(() => db);
      if (nome === 'assets') return abrir().then(() => assets);
      if (nome === 'sample') {
        const chave = lerChave();
        return chave ? criarSample(chave) : null;
      }
      return null;
    },
  };
})();
