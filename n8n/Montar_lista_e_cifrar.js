/* Lista de alunos da pagina de avaliacao (relatorio-professores/avaliacao).
   Entram criancas de ate 12 anos com cadastro ativo e contrato ativo (congelado fica fora).
   O repositorio e publico: a lista sai cifrada com a senha da equipe, no mesmo esquema
   do Placar (PBKDF2-SHA256 200.000 iteracoes + AES-256-GCM, tag no fim do texto cifrado),
   que e o que a pagina sabe abrir. A senha mora na variavel SENHA_AVALIACAO_EQUIPE. */
const nc = require('crypto');
const senha = String($vars.SENHA_AVALIACAO_EQUIPE || '');
if (senha.length < 8) throw new Error('Crie a variavel SENHA_AVALIACAO_EQUIPE (Overview > Variables) com a senha da equipe, com pelo menos 8 caracteres.');

const resp = $input.all().map(i => i.json);
const falhas = resp.filter(r => !r.ok);
if (falhas.length) throw new Error('A EVO falhou em ' + falhas.map(f => f.rotulo + ' (' + f.status + ')').join(', ') + '. A lista nao foi atualizada.');
const pagina = (r) => Number(String(r.rotulo || '').split(':')[1]);
const ultima = resp.slice().sort((a, b) => pagina(b) - pagina(a))[0];
if (ultima && ultima.qtd >= 150) throw new Error('A ultima pagina de cadastros veio cheia: a base passou de 900. Aumente as paginas no no Plano de coleta.');
const membros = [].concat(...resp.map(r => r.itens || []));

const agora = new Date(Date.now() - 3 * 3600000);
const hy = agora.getUTCFullYear(), hm = agora.getUTCMonth() + 1, hd = agora.getUTCDate();
const idade = (n) => {
  if (!n) return null;
  const p = String(n).slice(0, 10).split('-');
  const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
  if (!y || !m || !d) return null;
  let a = hy - y;
  if (hm < m || (hm === m && hd < d)) a--;
  return a;
};
/* Nome vindo todo em maiusculas vira "Nome Sobrenome"; o resto fica como esta no EVO. */
const MINUSC = ['da', 'de', 'do', 'das', 'dos', 'e'];
const cap = (t) => {
  t = String(t || '').trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t.toLowerCase().split(' ').filter(Boolean).map(w => MINUSC.indexOf(w) >= 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const vistos = {};
const alunos = [];
let semNascimento = 0, semContratoAtivo = 0;
for (const m of membros) {
  const id = m.idMember;
  if (!id || vistos[id]) continue;
  vistos[id] = 1;
  if (String(m.status || '') !== 'Active') continue;
  const a = idade(m.birthDate);
  if (a === null) { if (String(m.membershipStatus || '') === 'Active') semNascimento++; continue; }
  if (a > 12 || a < 0) continue;
  if (String(m.membershipStatus || '') !== 'Active') { semContratoAtivo++; continue; }
  const nome = (cap(m.firstName) + ' ' + cap(m.lastName)).trim();
  if (nome) alunos.push({ id: id, nome: nome });
}
/* Lista vazia quase sempre e erro de leitura, nao escola sem criancas: nao sobrescreve. */
if (!alunos.length) throw new Error('Nenhuma crianca encontrada em ' + membros.length + ' cadastros. A lista nao foi atualizada.');

const dados = { atualizadoEm: new Date().toISOString(), alunos: alunos };
const salt = nc.randomBytes(16);
const iv = nc.randomBytes(12);
const chave = nc.pbkdf2Sync(senha, salt, 200000, 32, 'sha256');
const cip = nc.createCipheriv('aes-256-gcm', chave, iv);
const ct = Buffer.concat([cip.update(JSON.stringify(dados), 'utf8'), cip.final(), cip.getAuthTag()]);
const pacote = { cifrado: 1, atualizadoEm: dados.atualizadoEm, salt: salt.toString('base64'), iv: iv.toString('base64'), dados: ct.toString('base64') };

return [{ json: {
  arquivo: JSON.stringify(pacote, null, 2),
  resumo: { criancas: alunos.length, cadastros_lidos: membros.length, sem_data_nascimento: semNascimento, criancas_sem_contrato_ativo: semContratoAtivo }
} }];
