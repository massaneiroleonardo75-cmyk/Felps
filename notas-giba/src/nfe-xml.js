// Leitor do XML da NF-e (o arquivo que o fornecedor manda por e-mail). Não precisa de IA:
// os dados vêm exatos, direto da Sefaz.

const tag = (xml, nome) => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`));
  return m ? decodificar(m[1].trim()) : null;
};
const bloco = (xml, nome) => tag(xml, nome) ?? '';
const blocos = (xml, nome) =>
  [...xml.matchAll(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, 'g'))].map((m) => m[1]);
const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

function decodificar(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function ehXmlNFe(texto) {
  return /<(?:\w+:)?infNFe[\s>]/.test(texto) && /<(?:\w+:)?det[\s>]/.test(texto);
}

export function lerXmlNFe(xml) {
  if (!ehXmlNFe(xml)) throw new Error('Este arquivo não parece ser o XML de uma NF-e.');
  const chaveM = xml.match(/<(?:\w+:)?infNFe[^>]*\sId="NFe(\d{44})"/);
  const ide = bloco(xml, 'ide');
  const emit = bloco(xml, 'emit');
  const tot = bloco(xml, 'ICMSTot');
  const data = tag(ide, 'dhEmi') || tag(ide, 'dEmi');

  const itens = blocos(xml, 'det').map((det, i) => {
    const prod = bloco(det, 'prod');
    const imposto = bloco(det, 'imposto');
    const qtd = num(tag(prod, 'qCom'));
    return {
      ordem: i,
      codigo: tag(prod, 'cProd'),
      descricao: tag(prod, 'xProd') || `Item ${i + 1}`,
      ncm: tag(prod, 'NCM'),
      quantidade: qtd || 1,
      unidade: tag(prod, 'uCom'),
      valor_unitario: num(tag(prod, 'vUnCom')),
      valor_total: num(tag(prod, 'vProd')),
      _ipi: num(tag(bloco(imposto, 'IPI'), 'vIPI')),
    };
  });

  const impostos = num(tag(tot, 'vIPI')) + num(tag(tot, 'vST')) + num(tag(tot, 'vII'));
  return {
    numero: tag(ide, 'nNF'),
    serie: tag(ide, 'serie'),
    chave: chaveM ? chaveM[1] : null,
    emitente_nome: tag(emit, 'xFant') || tag(emit, 'xNome'),
    emitente_cnpj: tag(emit, 'CNPJ') || tag(emit, 'CPF'),
    data_emissao: data ? data.slice(0, 10) : null,
    valor_produtos: num(tag(tot, 'vProd')),
    frete: num(tag(tot, 'vFrete')),
    seguro: num(tag(tot, 'vSeg')),
    desconto: num(tag(tot, 'vDesc')),
    outras: num(tag(tot, 'vOutro')),
    impostos,
    valor_total: num(tag(tot, 'vNF')),
    itens: itens.map(({ _ipi, ...i }) => i),
    avisos: [],
  };
}
