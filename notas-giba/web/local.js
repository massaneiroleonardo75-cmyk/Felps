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
    const t = idb.transaction('docs');
    const docs = t.objectStore('docs');
    const [chaves, valores] = await Promise.all([req(docs.getAllKeys()), req(docs.getAll())]);
    cache.clear();
    chaves.forEach((k, i) => cache.set(k, valores[i]));
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
  // [modelo, configuração de raciocínio, tempo máximo em ms]
  const MODELOS = {
    nota: [['gemini-3.5-flash-lite', null, 25000], ['gemini-3.6-flash', { thinkingLevel: 'minimal' }, 40000], ['gemini-3.8-flash', { thinkingLevel: 'low' }, 60000], ['gemini-2.5-flash', null, 60000]],
    nomes: [['gemini-3.8-flash', { thinkingLevel: 'low' }, 45000], ['gemini-3.6-flash', { thinkingLevel: 'minimal' }, 40000], ['gemini-3.5-flash-lite', null, 25000]],
  };
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
        moeda: T('STRING', { enum: ['USD', 'BRL'], description: 'USD é o padrão; BRL só quando há R$ ou é DANFE/NF-e brasileiro' }),
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
      required: ['eh_nota_fiscal', 'moeda', 'emitente_nome', 'emitente_cnpj', 'numero', 'serie', 'chave_acesso', 'data_emissao', 'itens', 'valor_produtos', 'frete', 'seguro', 'desconto', 'outras_despesas', 'impostos_adicionais', 'valor_total', 'avisos'],
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

  async function chamarGemini(chave, modelo, corpo, limite = 60000) {
    let r;
    const ctl = new AbortController();
    const relogio = setTimeout(() => ctl.abort(), limite);
    try {
      r = await fetch(`${URL_API}${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpo),
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(relogio);
      if (ctl.signal.aborted) throw { code: 'proximo_modelo' }; // demorou demais: tenta o próximo
      throw { code: 'sem_internet' };
    }
    clearTimeout(relogio);
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
    if (r.status === 400 && /thinking/i.test(dados?.error?.message || '')) throw { code: 'proximo_modelo' };
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
        const tipo = opcoes.tipo === 'nomes' ? 'nomes' : 'nota';
        let limite = false;
        for (const [modelo, pensar, tempo] of MODELOS[tipo]) {
          const corpo = {
            contents: [{ role: 'user', parts: partes }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMAS[tipo], temperature: 0.1, maxOutputTokens: 16384, ...(pensar ? { thinkingConfig: pensar } : {}) },
          };
          let dados;
          try {
            dados = await chamarGemini(chave, modelo, corpo, tempo);
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

  // foto da nota: lida do aparelho só quando aparece na tela
  const carregando = new Set();
  function urlFoto(id) {
    if (urls.has(id)) return urls.get(id);
    if (idb && !carregando.has(id)) {
      carregando.add(id);
      req(idb.transaction('arquivos').objectStore('arquivos').get(id)).then((blob) => {
        if (blob) { urls.set(id, URL.createObjectURL(blob)); avisar(); }
      }).catch(() => {}).finally(() => carregando.delete(id));
    }
    return '';
  }

  // ---------------- sincronização entre aparelhos (Firebase / Firestore) ----------------
  // Sem configuração ou sem "espaço" escolhido, tudo continua só no aparelho (modo local acima).
  const FIREBASE = window.__FIREBASE_CONFIG || null;
  const CHAVE_ESPACO = 'notas-giba:espaco';
  const lerLS = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const gravarLS = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
  let ESPACO = lerLS(CHAVE_ESPACO);
  let fs = null;
  let carregandoKit = null;
  let aoMudarFoto = () => {};
  const novoEspaco = () => { const a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, (b) => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 56]).join(''); };

  function carregarKit() {
    carregandoKit ??= new Promise((ok, erro) => {
      if (window.FB) return ok();
      const s = document.createElement('script');
      s.src = 'vendor/sync.js';
      s.onload = () => ok();
      s.onerror = () => { carregandoKit = null; erro(new Error('Não consegui carregar a sincronização. Verifique a internet e recarregue.')); };
      document.head.append(s);
    });
    return carregandoKit;
  }

  let conectando = null;
  function conectarFirestore() {
    // uma única conexão, mesmo quando dados e fotos pedem ao mesmo tempo
    conectando ??= (async () => {
      await carregarKit();
      let f;
      try {
        f = FB.initializeFirestore(FB.initializeApp(FIREBASE), { ignoreUndefinedProperties: true, localCache: FB.persistentLocalCache({ tabManager: FB.persistentMultipleTabManager() }) });
      } catch {
        // navegador sem armazenamento persistente (ex.: modo anônimo): funciona só com internet
        f = FB.initializeFirestore(FB.initializeApp(FIREBASE, 'sem-cache'), { ignoreUndefinedProperties: true });
      }
      const emu = lerLS('notas-giba:emulador'); // só para testes
      if (emu) FB.connectFirestoreEmulator(f, emu.split(':')[0], Number(emu.split(':')[1]));
      fs = f;
      return f;
    })().catch((e) => { conectando = null; throw e; });
    return conectando;
  }

  // Gravação que não trava a tela: o Firestore aplica na hora no aparelho e envia quando houver internet.
  function semEsperar(prom) {
    prom.catch((e) => { console.warn('[sync]', e); window.dispatchEvent(new CustomEvent('notas-erro-sync', { detail: e?.code || e?.message })); });
    return Promise.race([prom, new Promise((ok) => setTimeout(ok, 1500))]).then(() => {});
  }

  function criarRemoto(fs, espaco) {
    const base = `espacos/${espaco}/`;
    const conv = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
    const convLista = (s) => ({ docs: s.docs.map(conv), size: s.size, empty: s.empty, metadata: s.metadata, docChanges: () => [] });
    function rdoc(p) {
      const r = FB.doc(fs, base + p);
      return {
        id: r.id,
        path: p,
        get: async () => conv(await FB.getDoc(r)),
        set: (d) => semEsperar(FB.setDoc(r, clonar(d))),
        update: (d) => semEsperar(FB.updateDoc(r, clonar(d))),
        delete: () => semEsperar(FB.deleteDoc(r)),
        onSnapshot: (prox, erro) => FB.onSnapshot(r, (s) => prox(conv(s)), erro),
        collection: (sub) => rcol(`${p}/${sub}`),
      };
    }
    function rcol(p) {
      const c = FB.collection(fs, base + p);
      return {
        path: p,
        doc: (id) => rdoc(`${p}/${id || FB.doc(c).id}`),
        add: async (d) => { const r = FB.doc(c); await semEsperar(FB.setDoc(r, clonar(d))); return rdoc(`${p}/${r.id}`); },
        get: async () => convLista(await FB.getDocs(c)),
        onSnapshot: (prox, erro) => FB.onSnapshot(c, (s) => prox(convLista(s)), erro),
      };
    }
    return { doc: rdoc, collection: rcol };
  }

  // fotos: guardadas como documentos (imagem comprimida), para não precisar de plano pago
  async function reduzir(blob, lado = 1400, q = 0.72) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((ok) => cv.toBlob(ok, 'image/jpeg', q));
  }
  const deBase64 = (b64, tipo) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: tipo || 'image/jpeg' });

  function criarArquivosRemotos(fs, espaco) {
    const col = FB.collection(fs, `espacos/${espaco}/arquivos`);
    return {
      async upload(blob) {
        let b = blob;
        if (b.size > 600000) b = await reduzir(b);
        if (b.size > 600000) b = await reduzir(b, 1100, 0.6);
        const r = FB.doc(col);
        await semEsperar(FB.setDoc(r, { tipo: b.type || 'image/jpeg', dados: await paraBase64(b), criado_em: new Date().toISOString() }));
        const url = URL.createObjectURL(b);
        urls.set(r.id, url);
        return { id: r.id, url, sizeBytes: b.size, contentType: b.type };
      },
      async delete(id) {
        await semEsperar(FB.deleteDoc(FB.doc(col, id)));
        if (urls.has(id)) URL.revokeObjectURL(urls.get(id));
        urls.delete(id);
      },
    };
  }
  const buscandoFoto = new Set();
  function urlFotoRemota(id) {
    if (urls.has(id)) return urls.get(id);
    if (fs && !buscandoFoto.has(id)) {
      buscandoFoto.add(id);
      FB.getDoc(FB.doc(fs, `espacos/${ESPACO}/arquivos/${id}`)).then((s) => {
        const d = s.data();
        if (d?.dados) { urls.set(id, URL.createObjectURL(deBase64(d.dados, d.tipo))); aoMudarFoto(); }
      }).catch(() => {}).finally(() => buscandoFoto.delete(id));
    }
    return '';
  }

  // Leva tudo o que está só neste aparelho para o espaço compartilhado (sem apagar nada de lá).
  async function enviarDadosLocais(espaco, aoProgresso = () => {}) {
    await abrir();
    const f = await conectarFirestore();
    const base = `espacos/${espaco}/`;
    const t = idb.transaction('arquivos');
    const [ids, blobs] = await Promise.all([req(t.objectStore('arquivos').getAllKeys()), req(t.objectStore('arquivos').getAll())]);
    const itens = [...cache.entries()];
    const ajustesRemotos = await FB.getDoc(FB.doc(f, base + 'config/ajustes')).then((s) => s.exists()).catch(() => false);
    let lote = FB.writeBatch(f), n = 0, feitos = 0;
    const total = itens.length + ids.length;
    const fechar = async () => { if (n) { await lote.commit(); lote = FB.writeBatch(f); n = 0; } };
    for (const [caminho, valor] of itens) {
      if (caminho === 'config/ajustes' && ajustesRemotos) continue;
      lote.set(FB.doc(f, base + caminho), clonar(valor)); n++; feitos++;
      if (n >= 300) { await fechar(); aoProgresso(feitos, total); }
    }
    await fechar();
    for (let i = 0; i < ids.length; i++) {
      let b = blobs[i];
      if (b.size > 600000) b = await reduzir(b);
      await FB.setDoc(FB.doc(f, `${base}arquivos/${ids[i]}`), { tipo: b.type || 'image/jpeg', dados: await paraBase64(b), criado_em: new Date().toISOString() });
      feitos++; aoProgresso(feitos, total);
    }
    gravarLS(`notas-giba:enviado-${espaco}`, '1');
    return total;
  }

  async function exportarRemoto() {
    const f = await conectarFirestore();
    const base = `espacos/${ESPACO}/`;
    const docs = {};
    for (const c of ['notas', 'contatos', 'encomendas', 'config']) {
      const s = await FB.getDocs(FB.collection(f, base + c));
      s.docs.forEach((d) => (docs[`${c}/${d.id}`] = d.data()));
    }
    const arquivos = {};
    const s = await FB.getDocs(FB.collection(f, base + 'arquivos'));
    s.docs.forEach((d) => (arquivos[d.id] = { tipo: d.data().tipo, base64: d.data().dados }));
    return new Blob([JSON.stringify({ app: 'notas-giba', versao: 1, exportado_em: new Date().toISOString(), docs, arquivos })], { type: 'application/json' });
  }

  async function importarRemoto(arquivo) {
    let dados;
    try { dados = JSON.parse(await arquivo.text()); } catch { throw new Error('Este arquivo não é um backup válido.'); }
    if (dados?.app !== 'notas-giba' || typeof dados.docs !== 'object') throw new Error('Este arquivo não é um backup do Notas do Giba.');
    const f = await conectarFirestore();
    const base = `espacos/${ESPACO}/`;
    let lote = FB.writeBatch(f), n = 0;
    for (const [k, v] of Object.entries(dados.docs)) { lote.set(FB.doc(f, base + k), v); if (++n >= 300) { await lote.commit(); lote = FB.writeBatch(f); n = 0; } }
    if (n) await lote.commit();
    for (const [id, a] of Object.entries(dados.arquivos || {})) await FB.setDoc(FB.doc(f, `${base}arquivos/${id}`), { tipo: a.tipo || 'image/jpeg', dados: a.base64 });
    return Object.keys(dados.docs).length;
  }

  const linkConexao = (comChave) => {
    const dados = { e: ESPACO };
    if (comChave && lerChave()) dados.k = lerChave();
    const b64 = btoa(JSON.stringify(dados)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${location.origin}${location.pathname}#conectar-${b64}`;
  };
  function lerLinkConexao() {
    if (!/^#conectar-/.test(location.hash)) return null;
    try {
      const b64 = location.hash.slice(10).replace(/-/g, '+').replace(/_/g, '/');
      const d = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
      history.replaceState(null, '', location.pathname + location.search + '#inicio');
      return d && typeof d.e === 'string' && d.e.length >= 20 ? d : null;
    } catch { history.replaceState(null, '', location.pathname + location.search + '#inicio'); return null; }
  }
  const qrSvg = (texto) => { if (!window.QR) return ''; const q = QR(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); };

  const sincronizacao = {
    disponivel: Boolean(FIREBASE),
    get ativa() { return Boolean(FIREBASE && ESPACO); },
    get espaco() { return ESPACO; },
    linkConexao,
    qrSvg,
    carregarKit,
    // liga a sincronização neste aparelho criando um espaço novo (ou entrando num existente)
    async ligar(espaco = novoEspaco(), aoProgresso) {
      if (!FIREBASE) throw new Error('A sincronização ainda não foi configurada no site.');
      const n = await enviarDadosLocais(espaco, aoProgresso);
      gravarLS(CHAVE_ESPACO, espaco); ESPACO = espaco;
      return n;
    },
    desligar() { gravarLS(CHAVE_ESPACO, ''); ESPACO = ''; },
  };

  window.__NOTAS_LOCAL = {
    url: (id) => (sincronizacao.ativa ? urlFotoRemota(id) : urlFoto(id)),
    set aoMudarFoto(fn) { aoMudarFoto = fn; },
    chave: lerChave,
    salvarChave(chave) {
      try {
        if (chave) localStorage.setItem(CHAVE_API, chave);
        else localStorage.removeItem(CHAVE_API);
      } catch {
        throw new Error('O navegador não deixou guardar a chave (modo anônimo?).');
      }
    },
    exportar: () => (sincronizacao.ativa ? exportarRemoto() : exportar()),
    importar: (a) => (sincronizacao.ativa ? importarRemoto(a) : importar(a)),
    espaco,
    sincronizacao,
    lerLinkConexao,
  };

  window.claude = {
    async use(nome) {
      if (nome === 'db' || nome === 'assets') {
        if (sincronizacao.ativa) {
          try {
            const f = await conectarFirestore();
            return nome === 'db' ? criarRemoto(f, ESPACO) : criarArquivosRemotos(f, ESPACO);
          } catch (e) {
            console.warn('[sync] sem sincronização agora, usando o aparelho', e);
          }
        }
        return abrir().then(() => (nome === 'db' ? db : assets));
      }
      if (nome === 'sample') {
        const chave = lerChave();
        return chave ? criarSample(chave) : null;
      }
      return null;
    },
  };
})();
