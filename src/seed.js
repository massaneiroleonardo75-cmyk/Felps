// Popula o banco com freteiros de exemplo para testar (dados fictícios).
import { openDb, getDb } from './db.js';
import { cadastrarFreteiro } from './fluxo.js';

openDb();
const exemplos = [
  { nome: 'Carlos Schmitt', telefone: '47990000001', veiculo: 'utilitario', ajudantes: 0, notas: [5, 5, 4, 5], concluidos: 12 },
  { nome: 'Marcos Pereira', telefone: '47990000002', veiculo: 'caminhao_34', ajudantes: 2, faz_montagem: true, notas: [5, 5, 5, 5, 4, 5], concluidos: 30 },
  { nome: 'Joana Kreutzfeld', telefone: '47990000003', veiculo: 'van', ajudantes: 1, faz_montagem: true, notas: [5, 4, 5], concluidos: 8 },
  { nome: 'Rafael Moretti', telefone: '47990000004', veiculo: 'caminhonete', ajudantes: 0, notas: [4, 3, 4], concluidos: 5, cancelamentos: 1 },
  { nome: 'Anderson Silva', telefone: '47990000005', veiculo: 'caminhao_bau', ajudantes: 3, faz_montagem: true, notas: [5, 5, 4, 5, 5], concluidos: 22 },
  { nome: 'Luiz Fernando', telefone: '47990000006', veiculo: 'caminhao_34', ajudantes: 1, notas: [], concluidos: 0 },
  { nome: 'Pedro Zanghelini', telefone: '47990000007', veiculo: 'van', ajudantes: 2, notas: [5, 5, 5, 5, 5, 5, 5, 4], concluidos: 41 },
];

for (const e of exemplos) {
  try {
    const f = cadastrarFreteiro({ ...e, aceite: true, aprovado: true, atende_empresas: true, regioes: ['Todas'] });
    getDb()
      .prepare('UPDATE freteiros SET nota_soma=?, avaliacoes=?, concluidos=?, cancelamentos=? WHERE id=?')
      .run(e.notas.reduce((a, b) => a + b, 0), e.notas.length, e.concluidos, e.cancelamentos || 0, f.id);
    console.log(`+ ${f.nome} (${f.telefone})`);
  } catch (err) {
    console.log(`= ${e.nome}: ${err.message}`);
  }
}
