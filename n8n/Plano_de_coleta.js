/* Base inteira de cadastros da unidade 54. A /v1/members trava em 150 por pagina,
   entao 6 paginas com passo de 150 cobrem 900 cadastros (eram ~760 em 10/2026).
   Mesmo endereco que o Placar usa. */
const base = 'https://evo-integracao.w12app.com.br/api';
const pedidos = [];
for (let p = 0; p < 6; p++) pedidos.push({ json: { rotulo: 'membros:' + p, url: base + '/v1/members?idBranch=54&take=150&skip=' + (p * 150) } });
return pedidos;
