// Notas do Giba — motor local para a versão de link aberto (GitHub Pages).
// Oferece a mesma interface que o app usa no claude.ai (window.claude.use("db" | "assets" | "sample")),
// mas guardando tudo no próprio navegador (IndexedDB): os dados continuam lá depois de fechar o
// navegador ou desligar o computador. A leitura de fotos usa a API do Claude com a chave do usuário.
(() => {
  const NOME_BANCO = 'notas-giba';
  const CHAVE_API = 'notas-giba:chave-api';
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

  // ---------------- leitura de fotos com a API do Claude ----------------
  const anulavel = (tipo) => ({ anyOf: [{ type: tipo }, { type: 'null' }] });
  const ESQUEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['eh_nota_fiscal', 'emitente_nome', 'emitente_cnpj', 'numero', 'serie', 'chave_acesso', 'data_emissao', 'itens', 'valor_produtos', 'frete', 'seguro', 'desconto', 'outras_despesas', 'impostos_adicionais', 'valor_total', 'avisos'],
    properties: {
      eh_nota_fiscal: { type: 'boolean' },
      emitente_nome: anulavel('string'),
      emitente_cnpj: anulavel('string'),
      numero: anulavel('string'),
      serie: anulavel('string'),
      chave_acesso: anulavel('string'),
      data_emissao: anulavel('string'),
      itens: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['codigo', 'descricao', 'ncm', 'quantidade', 'unidade', 'valor_unitario', 'valor_total', 'encomendas_ids'],
          properties: {
            codigo: anulavel('string'),
            descricao: { type: 'string' },
            ncm: anulavel('string'),
            quantidade: { type: 'number' },
            unidade: anulavel('string'),
            valor_unitario: { type: 'number' },
            valor_total: { type: 'number' },
            encomendas_ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      valor_produtos: anulavel('number'),
      frete: anulavel('number'),
      seguro: anulavel('number'),
      desconto: anulavel('number'),
      outras_despesas: anulavel('number'),
      impostos_adicionais: anulavel('number'),
      valor_total: anulavel('number'),
      avisos: { type: 'array', items: { type: 'string' } },
    },
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

  function criarSample(chave) {
    const Anthropic = window.Anthropic;
    if (!Anthropic) return null;
    const cliente = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true, maxRetries: 2 });
    return {
      limits: async () => ({ images: { maxCount: 8, maxInputBytes: 5 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] }, modelTiers: ['default', 'complex'] }),
      async json(prompt, opcoes = {}) {
        const imagens = opcoes.images ? [].concat(opcoes.images) : [];
        const conteudo = [];
        for (const b of imagens) conteudo.push({ type: 'image', source: { type: 'base64', media_type: b.type || 'image/jpeg', data: await paraBase64(b) } });
        conteudo.push({ type: 'text', text: prompt });
        let resp;
        try {
          resp = await cliente.beta.messages.create({
            model: 'claude-opus-5-5',
            max_tokens: 16000,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            output_config: { effort: 'medium', format: { type: 'json_schema', schema: ESQUEMA } },
            messages: [{ role: 'user', content: conteudo }],
          });
        } catch (e) {
          console.error('[leitura]', e);
          if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw { code: 'chave_invalida' };
          if (e instanceof Anthropic.RateLimitError) throw { code: 'rate_limited' };
          if (e instanceof Anthropic.BadRequestError) throw { code: 'pedido_recusado' };
          if (e instanceof Anthropic.APIConnectionError) throw { code: 'sem_internet' };
          throw { code: 'upstream_error' };
        }
        if (resp.stop_reason === 'refusal') throw { code: 'refused' };
        const texto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        try {
          return JSON.parse(texto);
        } catch {
          throw { code: 'invalid_json' };
        }
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
