/*!
 * Painel administrativo — Doçuras da Lorrany
 * Edita o dados.json do catálogo (loja, contato, horários, pedidos, pagamentos e produtos)
 * e publica direto no repositório do GitHub (GitHub Pages atualiza o site em 1–2 minutos).
 *
 * Acesso: usuário e senha (primeiro acesso: Admin / Admin, com troca obrigatória).
 * O token do GitHub fica no admin/acesso.json criptografado (AES-GCM) com uma chave que só
 * abre com a senha ou com o código de recuperação enviado para o e-mail da dona da loja.
 * O rascunho fica salvo no aparelho até ser publicado.
 */
(function () {
  'use strict';

  var RASCUNHO = 'lorrany:rascunho';
  var SESSAO = 'lorrany:sessao';
  var PADRAO_GH = { owner: 'Tanattos18', repo: 'Catalago_Lorrany', branch: 'main' };
  var USUARIO_PADRAO = 'Admin', SENHA_PADRAO = 'Admin';
  var ITERACOES = 310000;
  var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  var ABAS = [
    ['loja', 'Loja'], ['catalogo', 'Catálogo'], ['contato', 'Contato e endereço'], ['horarios', 'Horários'],
    ['pedidos', 'Pedidos e agenda'], ['pagamentos', 'Pagamentos'], ['publicar', 'Publicar'], ['conta', 'Minha conta']
  ];

  var D = null;           // dados em edição
  var A = null;           // admin/acesso.json (null = primeiro acesso)
  var S = lerSessao();    // { usuario, token, owner, repo, branch, k }
  var alterado = false;   // há mudanças não publicadas
  var publicado = null;
  var aba = 'loja';
  var abertos = {};       // <details> abertos no catálogo
  var validade = null;    // { dias, data } do token
  var instalar = null;    // evento beforeinstallprompt
  var app = document.getElementById('admin');

  /* ---------- utilidades ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function brl(n) { return (+n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function $(s, el) { return (el || document).querySelector(s); }
  function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
  function slug(s) { return String(s || 'foto').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'foto'; }
  function dataBR(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function hojeISO() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function imgSrc(v, w) {
    if (!v) return '';
    if (/^(data:|https?:)/.test(v)) return v;
    if (/[\/.]/.test(v)) return '../' + v;
    return 'https://images.unsplash.com/photo-' + v + '?w=' + (w || 300) + '&q=70&auto=format&fit=crop';
  }
  function obter(obj, caminho) {
    return caminho.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function definir(obj, caminho, valor) {
    var p = caminho.split('.'), o = obj;
    for (var i = 0; i < p.length - 1; i++) {
      if (o[p[i]] == null) o[p[i]] = /^\d+$/.test(p[i + 1]) ? [] : {};
      o = o[p[i]];
    }
    o[p[p.length - 1]] = valor;
  }
  function remover(caminho) {
    var p = caminho.split('.'), i = +p.pop(), lista = obter(D, p.join('.'));
    lista.splice(i, 1);
  }
  function mover(caminho, d) {
    var p = caminho.split('.'), i = +p.pop(), lista = obter(D, p.join('.')), j = i + d;
    if (j < 0 || j >= lista.length) return;
    var x = lista[i]; lista[i] = lista[j]; lista[j] = x;
  }
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function lerSessao() {
    try { return JSON.parse(localStorage.getItem(SESSAO) || sessionStorage.getItem(SESSAO)) || null; } catch (e) { return null; }
  }
  function salvarSessao(v, lembrar) {
    try {
      localStorage.removeItem(SESSAO); sessionStorage.removeItem(SESSAO);
      if (v) (lembrar ? localStorage : sessionStorage).setItem(SESSAO, JSON.stringify(v));
    } catch (e) { /* sem armazenamento */ }
    S = v;
  }
  function lembrado() { try { return !!localStorage.getItem(SESSAO); } catch (e) { return false; } }
  function salvarRascunho() {
    alterado = true;
    try { localStorage.setItem(RASCUNHO, JSON.stringify(D)); }
    catch (e) { toast('O aparelho ficou sem espaço para o rascunho. Publique agora para não perder as fotos.'); }
    barra();
  }
  var toastTimer;
  function toast(msg, ms) {
    var el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); el.hidden = true; }, ms || 2600);
  }
  function carregando(sim, txt) {
    var el = $('.carregador');
    if (!el) { el = document.createElement('div'); el.className = 'carregador'; el.innerHTML = '<div><i></i><p></p></div>'; document.body.appendChild(el); }
    $('p', el).textContent = txt || 'Aguarde...';
    el.hidden = !sim;
  }

  /* ---------- criptografia (WebCrypto) ---------- */
  var enc = new TextEncoder(), dec = new TextDecoder();
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function aleatorio(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function derivar(segredo, salt, iter) {
    return crypto.subtle.importKey('raw', enc.encode(segredo), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function chaveK(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
  function cifrar(chave, bytes) {
    var iv = aleatorio(12);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, chave, bytes).then(function (c) { return { iv: b64(iv), dados: b64(c) }; });
  }
  function decifrar(chave, o) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, chave, unb64(o.dados)).then(function (b) { return new Uint8Array(b); });
  }
  // guarda a chave K protegida por um segredo (senha ou código de recuperação)
  function embrulhar(kRaw, segredo) {
    var salt = aleatorio(16);
    return derivar(segredo, salt, ITERACOES).then(function (ch) { return cifrar(ch, kRaw); })
      .then(function (c) { return { salt: b64(salt), iv: c.iv, dados: c.dados }; });
  }
  function desembrulhar(w, segredo) {
    return derivar(segredo, unb64(w.salt), A.iteracoes || ITERACOES).then(function (ch) { return decifrar(ch, w); });
  }
  function cifrarToken(kRaw, token) { return chaveK(kRaw).then(function (k) { return cifrar(k, enc.encode(token)); }); }
  function decifrarToken(kRaw) { return chaveK(kRaw).then(function (k) { return decifrar(k, A.token); }).then(function (b) { return dec.decode(b); }); }
  var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function novoCodigo() {
    var b = aleatorio(16), s = '';
    for (var i = 0; i < 16; i++) s += ALFABETO[b[i] % 32] + (i % 4 === 3 && i < 15 ? '-' : '');
    return s;
  }
  function normCodigo(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function mascararEmail(e) {
    var p = String(e || '').split('@');
    return p.length === 2 ? p[0].slice(0, 2) + '•••••@' + p[1] : '';
  }

  /* ---------- GitHub ---------- */
  function api(caminho, opts, cred) {
    opts = opts || {}; cred = cred || S;
    return fetch('https://api.github.com/repos/' + cred.owner + '/' + cred.repo + caminho, {
      method: opts.method || 'GET',
      headers: { Authorization: 'Bearer ' + cred.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || 'Erro ' + r.status); e.status = r.status; throw e; }
        if (opts.headers) j.__exp = r.headers.get('github-authentication-token-expiration');
        return j;
      });
    });
  }
  function validarToken(cred) {
    return api('', { headers: true }, cred).then(function (r) {
      if (!r.permissions || !r.permissions.push) throw new Error('Este token não tem permissão de escrita no repositório.');
      return r;
    }).catch(function (e) {
      if (e.status === 401) throw new Error('Token inválido ou expirado.');
      if (e.status === 404) throw new Error('Repositório não encontrado para este token.');
      throw e;
    });
  }
  // grava vários arquivos num único commit
  function commitar(arquivos, mensagem, cred) {
    cred = cred || S;
    var base;
    return api('/git/ref/heads/' + cred.branch, null, cred).then(function (r) {
      base = r.object.sha;
      return api('/git/commits/' + base, null, cred);
    }).then(function (commit) {
      return Promise.all(arquivos.map(function (a) {
        return api('/git/blobs', { method: 'POST', body: a.base64 ? { content: a.base64, encoding: 'base64' } : { content: a.texto, encoding: 'utf-8' } }, cred)
          .then(function (b) { return { path: a.path, mode: '100644', type: 'blob', sha: b.sha }; });
      })).then(function (tree) { return api('/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: tree } }, cred); });
    }).then(function (tree) {
      return api('/git/commits', { method: 'POST', body: { message: mensagem, tree: tree.sha, parents: [base] } }, cred);
    }).then(function (c) {
      return api('/git/refs/heads/' + cred.branch, { method: 'PATCH', body: { sha: c.sha } }, cred);
    });
  }
  function salvarAcesso(novo, cred, msg) {
    return commitar([{ path: 'admin/acesso.json', texto: JSON.stringify(novo, null, 2) + '\n' }], msg || 'Atualiza acesso do painel', cred).then(function () { A = novo; });
  }
  function carregarAcesso() {
    return fetch('acesso.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function conferirValidade() {
    if (!S) return;
    api('', { headers: true }).then(function (r) {
      var data = r.__exp ? new Date(r.__exp.replace(' UTC', 'Z').replace(' ', 'T')) : A && A.validadeToken ? new Date(A.validadeToken + 'T23:59:59') : null;
      validade = data && !isNaN(data) ? { data: data, dias: Math.ceil((data - new Date()) / 864e5) } : null;
      alerta();
    }).catch(function (e) {
      if (e.status === 401) { validade = { dias: -1 }; alerta(); }
    });
  }
  function alerta() {
    var el = $('.alerta'); if (!el) return;
    var txt = '';
    if (validade && validade.dias < 0) txt = 'A chave de publicação (token do GitHub) venceu. Peça para renovar em "Minha conta" → Trocar token.';
    else if (validade && validade.dias <= 15) txt = 'A chave de publicação vence em ' + validade.dias + ' dia(s) (' + validade.data.toLocaleDateString('pt-BR') + '). Renove em "Minha conta" para não parar de publicar.';
    el.innerHTML = txt ? esc(txt) + ' <button type="button" data-aba="conta">Abrir</button>' : '';
    el.hidden = !txt;
  }

  /* ---------- campos ---------- */
  function campo(rot, html, dica) {
    return '<label class="campo"><span>' + rot + '</span>' + html + (dica ? '<small>' + dica + '</small>' : '') + '</label>';
  }
  function fTexto(rot, k, dica, extra) {
    var v = obter(D, k);
    return campo(rot, '<input data-k="' + k + '" value="' + esc(Array.isArray(v) ? v.join(', ') : v) + '"' + (extra || '') + '>', dica);
  }
  function fArea(rot, k, dica, linhas) {
    return campo(rot, '<textarea data-k="' + k + '" rows="' + (linhas || 3) + '">' + esc(obter(D, k)) + '</textarea>', dica);
  }
  function fLista(rot, k, dica) {
    return campo(rot, '<textarea data-k="' + k + '" data-t="linhas" rows="4">' + esc((obter(D, k) || []).join('\n')) + '</textarea>', dica || 'Um por linha.');
  }
  function fNum(rot, k, dica, extra) {
    var v = obter(D, k);
    return campo(rot, '<input type="number" inputmode="decimal" step="0.01" min="0" data-k="' + k + '" data-t="num" value="' + (v == null ? '' : v) + '"' + (extra || '') + '>', dica);
  }
  function fCheck(rot, k, dica, render) {
    return '<label class="check"><input type="checkbox" data-k="' + k + '" data-t="bool"' + (render ? ' data-r="1"' : '') + (obter(D, k) ? ' checked' : '') +
      '><span><b>' + rot + '</b>' + (dica ? '<small>' + dica + '</small>' : '') + '</span></label>';
  }
  function fSelect(rot, k, ops, render) {
    var v = obter(D, k);
    return campo(rot, '<select data-k="' + k + '"' + (render ? ' data-r="1"' : '') + '>' + ops.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('') + '</select>');
  }
  function fCor(rot, k) {
    return '<label class="cor"><input type="color" data-k="' + k + '" value="' + esc(obter(D, k) || '#ffffff') + '"><span>' + rot + '</span></label>';
  }
  function fFoto(rot, k, max, png) {
    var v = obter(D, k);
    return '<div class="foto"><div class="foto-prev">' + (v ? '<img src="' + esc(imgSrc(v)) + '" alt="">' : '<span>Sem foto</span>') + '</div>' +
      '<div class="foto-acoes"><b>' + rot + '</b><label class="btn btn-sm">Trocar foto<input type="file" accept="image/*" data-img="' + k + '" data-max="' + (max || 1000) + '"' + (png ? ' data-png="1"' : '') + ' hidden></label>' +
      (v ? '<button type="button" class="btn btn-sm btn-ghost" data-acao="limpar" data-k="' + k + '">Remover</button>' : '') + '</div></div>';
  }
  function grupo(tit, html, desc) {
    return '<section class="grupo"><h2>' + tit + '</h2>' + (desc ? '<p class="desc">' + desc + '</p>' : '') + html + '</section>';
  }
  function senhaCampo(rot, nome, dica, auto) {
    return campo(rot, '<span class="senha"><input name="' + nome + '" type="password" required autocomplete="' + (auto || 'new-password') + '">' +
      '<button type="button" data-ver-senha aria-label="Mostrar senha">👁</button></span>', dica);
  }

  /* ---------- abas ---------- */
  var RENDER = {
    loja: function () {
      return grupo('Identidade',
        fFoto('Logo', 'logo', 512, true) +
        fTexto('Nome da loja', 'nome') + fTexto('Chamada (aparece acima do nome)', 'chamada') + fArea('Frase de apresentação', 'slogan', '', 2)) +
        grupo('Foto de capa', fFoto('Capa (fundo do topo)', 'capa', 1600), 'Use uma foto horizontal e bem iluminada.') +
        grupo('Destaque', fCheck('Mostrar o destaque', 'promo.ativo', 'Faixa logo abaixo da capa, para promoções ou avisos.') +
          fTexto('Selo', 'promo.selo') + fTexto('Título', 'promo.titulo') + fArea('Texto', 'promo.texto', '', 2)) +
        grupo('Sobre nós', fArea('Texto', 'sobre', '', 4) + fLista('Diferenciais', 'diferenciais') +
          '<p class="rot">Galeria de fotos</p><div class="galeria">' + (D.galeria || []).map(function (g, i) {
            return '<div class="gal-item">' + fFoto('Foto ' + (i + 1), 'galeria.' + i, 900) +
              '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="galeria.' + i + '">Excluir</button></div>';
          }).join('') + '</div><button type="button" class="btn btn-sm" data-acao="add-galeria">+ Adicionar foto à galeria</button>') +
        grupo('Depoimentos de clientes', (D.depoimentos || []).map(function (d, i) {
          var k = 'depoimentos.' + i;
          return '<div class="bloco">' + fFoto('Foto (opcional)', k + '.foto', 400) + fTexto('Nome do cliente', k + '.nome') +
            fArea('O que o cliente disse', k + '.texto', '', 3) +
            '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + k + '">Excluir depoimento</button></div>';
        }).join('') + '<button type="button" class="btn btn-sm" data-acao="add-depoimento">+ Adicionar depoimento</button>',
        'Copie elogios do WhatsApp ou do Instagram (peça autorização ao cliente). Sem depoimentos, a seção não aparece no site.') +
        grupo('Cores', '<div class="cores">' + fCor('Cor principal', 'tema.primaria') + fCor('Cor de destaque', 'tema.secundaria') +
          fCor('Fundo', 'tema.fundo') + fCor('Texto', 'tema.texto') + '</div>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-acao="cores-padrao">Voltar às cores originais</button>');
    },

    contato: function () {
      return grupo('Contato',
        fTexto('WhatsApp que recebe os pedidos', 'contato.whatsapp', 'Só números, com 55 + DDD. Ex.: 5562991751262', ' inputmode="numeric"') +
        fTexto('Telefone (como aparece no site)', 'contato.telefone') + fTexto('E-mail', 'contato.email', 'Opcional.', ' type="email"')) +
        grupo('Redes sociais', fTexto('Instagram', 'redes.instagram', 'Só o usuário, sem @.') + fTexto('Facebook', 'redes.facebook') + fTexto('TikTok', 'redes.tiktok')) +
        grupo('Endereço', fTexto('Rua / conjunto / número', 'endereco.rua') + fTexto('Bairro', 'endereco.bairro') +
          '<div class="linha">' + fTexto('Cidade', 'endereco.cidade') + fTexto('UF', 'endereco.uf') + fTexto('CEP', 'endereco.cep') + '</div>' +
          fTexto('Ponto de referência', 'endereco.referencia') +
          fTexto('Link do Google Maps', 'endereco.linkMapa', 'No Google Maps: Compartilhar → Copiar link.'));
    },

    horarios: function () {
      var H = D.horarios || (D.horarios = [null, null, null, null, null, null, null]);
      return grupo('Horário de atendimento',
        fCheck('Mostrar horário e status no site', 'mostrarHorario', 'Desligado, o site não mostra "atendendo agora" nem a tabela de horários.') +
        '<div class="horarios">' + DIAS.map(function (d, i) {
          var h = H[i];
          return '<div class="hora-dia"><label class="check mini"><input type="checkbox" data-acao-dia="' + i + '"' + (h ? ' checked' : '') + '><span><b>' + d + '</b></span></label>' +
            (h ? '<input type="time" data-k="horarios.' + i + '.abre" value="' + esc(h.abre) + '"><span>às</span><input type="time" data-k="horarios.' + i + '.fecha" value="' + esc(h.fecha) + '">' : '<span class="fechado">Fechado</span>') + '</div>';
        }).join('') + '</div>', 'Desmarque o dia para "fechado". Para virar a madrugada, use um horário de fechar menor que o de abrir.');
    },

    pedidos: function () {
      var p = D.pedidos;
      var sem = p.diasSemEncomenda || [];
      return grupo('Como o cliente pode pedir',
        fCheck('Entrega', 'pedidos.entrega', 'O cliente informa o endereço no pedido.', true) +
        fCheck('Retirada no local', 'pedidos.retirada', 'O cliente busca no seu endereço.', true) +
        fCheck('Pedido na mesa', 'pedidos.mesa', 'Mostra a opção "Na mesa" no pedido (para eventos ou consumo no local).', true) +
        (p.mesa ? '<div class="sub">' + fNum('Quantidade de mesas', 'pedidos.mesas', '', ' step="1"') +
          '<button type="button" class="btn btn-sm" data-acao="qr-mesas">Imprimir QR Code das mesas</button></div>' : '')) +
        grupo('Encomendas',
          fCheck('Trabalho por encomenda', 'pedidos.encomenda', 'Pede data e horário de entrega/retirada no pedido.', true) +
          (p.encomenda ? fNum('Antecedência mínima (dias)', 'pedidos.antecedenciaDias', 'O calendário do cliente só libera datas a partir deste prazo.', ' step="1"') +
            fArea('Aviso para o cliente', 'pedidos.avisoEncomenda', '', 2) : '')) +
        (p.encomenda ? grupo('Agenda',
          '<p class="rot">Dias da semana sem encomenda</p><div class="dias">' + DIAS.map(function (d, i) {
            return '<label class="check mini"><input type="checkbox" data-dia-sem="' + i + '"' + (sem.indexOf(i) > -1 ? ' checked' : '') + '><span><b>' + d.slice(0, 3) + '</b></span></label>';
          }).join('') + '</div>' +
          '<p class="rot">Datas lotadas ou de folga</p><div class="massa-preco"><input type="date" min="' + hojeISO() + '" data-nova-data>' +
          '<button type="button" class="btn btn-sm btn-pri" data-acao="add-data">Bloquear data</button></div>' +
          '<div class="chips">' + (p.datasBloqueadas || []).map(function (d, i) {
            return '<span class="chip">' + dataBR(d) + ' <button type="button" data-acao="remover" data-k="pedidos.datasBloqueadas.' + i + '" aria-label="Liberar ' + dataBR(d) + '">×</button></span>';
          }).join('') + '</div>',
          'Quando a agenda de um dia encher, bloqueie a data aqui e publique: o cliente não consegue mais escolher esse dia. Datas que já passaram somem sozinhas.') : '') +
        (p.entrega ? grupo('Entrega',
          fNum('Taxa de entrega (R$)', 'entrega.taxa', 'Deixe em branco para "a combinar". Use 0 para entrega grátis.') +
          fNum('Pedido mínimo para entrega (R$)', 'entrega.pedidoMinimo', '0 = sem mínimo.') +
          fNum('Entrega grátis acima de (R$)', 'entrega.gratisAcima', '0 = desligado.') +
          fTexto('Tempo médio', 'entrega.tempo', 'Ex.: 40–60 min. Opcional.') + fTexto('Área de entrega', 'entrega.area')) : '');
    },

    pagamentos: function () {
      var pg = D.pagamento;
      return grupo('Pix',
        fCheck('Aceitar Pix', 'pagamento.pix.ativo', 'Mostra a chave e gera o Pix copia e cola com o valor do pedido.', true) +
        (pg.pix.ativo ? fSelect('Tipo de chave', 'pagamento.pix.tipo', [['telefone', 'Telefone'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['email', 'E-mail'], ['aleatoria', 'Chave aleatória']]) +
          fTexto('Chave Pix', 'pagamento.pix.chave', 'Confira com cuidado: é para esta chave que o dinheiro vai.') +
          fTexto('Nome do titular', 'pagamento.pix.titular', 'Como aparece no banco.') + fTexto('Cidade do titular', 'pagamento.pix.cidade') : '')) +
        grupo('Cartão', fCheck('Cartão de crédito', 'pagamento.credito') + fCheck('Cartão de débito', 'pagamento.debito') +
          fTexto('Como funciona o cartão', 'pagamento.obsCartao', 'Ex.: Maquininha na entrega ou na retirada.') +
          fTexto('Link de pagamento (opcional)', 'pagamento.linkCartao', 'Link do Mercado Pago, PagSeguro, InfinitePay etc.')) +
        grupo('Dinheiro', fCheck('Dinheiro', 'pagamento.dinheiro', 'Pergunta se precisa de troco.')) +
        grupo('Contas bancárias', fCheck('Aceitar transferência bancária', 'pagamento.transferencia', 'Mostra as contas abaixo no site.', true) +
          (pg.contas || []).map(function (c, i) {
            var k = 'pagamento.contas.' + i;
            return '<div class="bloco">' + fTexto('Banco', k + '.banco') + '<div class="linha">' + fTexto('Agência', k + '.agencia') + fTexto('Conta', k + '.conta') + '</div>' +
              fSelect('Tipo', k + '.tipo', [['Conta corrente', 'Conta corrente'], ['Conta poupança', 'Conta poupança'], ['Conta de pagamento', 'Conta de pagamento']]) +
              fTexto('Titular', k + '.titular') + fTexto('CPF/CNPJ', k + '.documento') +
              '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + k + '">Excluir conta</button></div>';
          }).join('') + '<button type="button" class="btn btn-sm" data-acao="add-conta">+ Adicionar conta</button>') +
        grupo('Sinal / condições', fArea('Aviso de pagamento (opcional)', 'pagamento.sinal', 'Ex.: Sinal de 50% para confirmar a encomenda.', 2));
    },

    catalogo: function () {
      var kg = D.bolosKg;
      return '<section class="grupo"><h2>Categorias e produtos</h2><p class="desc">Toque num produto para editar. Use as setas para mudar a ordem.</p>' +
        D.categorias.map(categoriaHtml).join('') +
        '<button type="button" class="btn" data-acao="add-cat">+ Nova categoria</button></section>' +
        grupo('Bolos por kg', fTexto('Pesos disponíveis (kg)', 'bolosKg.pesos', 'Separe por vírgula. Ex.: 1, 1.5, 2, 3', ' data-t="numeros"') +
          fNum('Fatias por kg (estimativa)', 'bolosKg.fatiasPorKg', '0 para não mostrar.', ' step="1"') +
          '<p class="rot">Massas</p>' + (kg.massas || []).map(function (m, i) {
            var k = 'bolosKg.massas.' + i;
            return '<div class="bloco linha-massa">' + fTexto('Massa', k + '.nome') + fNum('Acréscimo (R$)', k + '.acrescimo') +
              fCheck('Por kg', k + '.porKg', 'Multiplica o acréscimo pelo peso.') +
              '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + k + '">Excluir</button></div>';
          }).join('') + '<button type="button" class="btn btn-sm" data-acao="add-massa">+ Adicionar massa</button>' +
          '<p class="rot">Personalização</p>' +
          fLista('Coberturas', 'bolosKg.coberturas', 'Uma por linha (ex.: Chantilly). Deixe vazio para não perguntar.') +
          fCheck('Pedir nome e idade para escrever no bolo', 'bolosKg.pedirNome') +
          fCheck('Oferecer topo de bolo personalizado', 'bolosKg.topo.ativo', '', true) +
          (kg.topo && kg.topo.ativo ? fNum('Preço do topo (R$)', 'bolosKg.topo.preco') : ''),
        'Vale para todos os produtos com preço "por kg".');
    },

    publicar: function () {
      return grupo('Publicar no site',
        '<p class="desc">' + (alterado ? 'Você tem <b>alterações não publicadas</b>. ' : 'Tudo publicado. ') +
        'Depois de publicar, o site atualiza em 1 a 2 minutos.</p>' +
        '<div class="acoes"><button type="button" class="btn" data-acao="previa">Pré-visualizar</button>' +
        '<button type="button" class="btn btn-pri" data-acao="publicar">Publicar agora</button></div>') +
        grupo('Cópia de segurança',
          '<div class="acoes"><button type="button" class="btn" data-acao="exportar">Baixar backup (.json)</button>' +
          '<label class="btn">Restaurar backup<input type="file" accept="application/json,.json" data-acao-arquivo="importar" hidden></label></div>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-acao="descartar">Descartar alterações não publicadas</button>');
    },

    conta: function () {
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      return grupo('Dados de acesso',
        '<form class="login" data-form="dados-acesso">' +
        campo('Usuário', '<input name="usuario" required autocomplete="username" value="' + esc(A.usuario) + '">') +
        campo('E-mail de recuperação', '<input name="email" type="email" required value="' + esc(A.email) + '">', 'É para este e-mail que vai o código de recuperação de senha.') +
        '<button class="btn btn-pri">Salvar</button></form>') +
        grupo('Trocar senha', '<form class="login" data-form="trocar-senha">' +
          senhaCampo('Senha atual', 'atual', '', 'current-password') + senhaCampo('Nova senha', 'nova', 'Mínimo de 8 caracteres.') + senhaCampo('Repita a nova senha', 'nova2') +
          '<button class="btn btn-pri">Trocar senha</button></form>') +
        grupo('Código de recuperação',
          '<p class="desc">Se você esquecer a senha, o código que está no seu e-mail (<b>' + esc(mascararEmail(A.email)) + '</b>) libera uma senha nova. ' +
          'Perdeu o e-mail? Gere um código novo: o antigo deixa de valer.</p>' +
          '<button type="button" class="btn" data-acao="novo-codigo">Gerar novo código</button>') +
        grupo('Chave de publicação (GitHub)',
          '<p class="desc">Repositório <b>' + esc(S.owner + '/' + S.repo) + '</b> (' + esc(S.branch) + ')' +
          (validade && validade.data ? ' · vence em <b>' + validade.data.toLocaleDateString('pt-BR') + '</b>' : '') + '.</p>' +
          '<details class="avancado"><summary>Trocar token</summary><form class="login" data-form="trocar-token">' +
          campo('Novo token', '<input name="token" type="password" autocomplete="off" required placeholder="github_pat_...">') +
          campo('Validade', '<input name="validade" type="date">', 'A data que o GitHub mostrou ao criar o token.') +
          '<button class="btn btn-pri">Salvar token</button></form></details>') +
        grupo('Aplicativo no celular',
          (instalar ? '<button type="button" class="btn btn-pri" data-acao="instalar">Instalar o painel como aplicativo</button>' :
            '<p class="desc">' + (ios ? 'No iPhone: toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.' :
              'No Android: abra o menu do Chrome (⋮) e toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.') + '</p>')) +
        grupo('Sair', '<p class="desc">' + (lembrado() ? 'Este aparelho está lembrando o acesso.' : 'O acesso termina quando fechar o navegador.') + '</p>' +
          '<button type="button" class="btn btn-ghost" data-acao="sair">Sair do painel</button>');
    }
  };

  function precoTipo(it) { return it.precoKg > 0 ? 'kg' : it.opcoes && it.opcoes.length ? 'opcoes' : 'unidade'; }
  function precoResumo(it) {
    var t = precoTipo(it);
    if (t === 'kg') return brl(it.precoKg) + '/kg';
    if (t === 'opcoes') return 'a partir de ' + brl(Math.min.apply(null, it.opcoes.map(function (o) { return +o.preco || 0; })));
    return brl(it.preco) + (it.unidade ? '/' + it.unidade : '');
  }
  function setas(k) {
    return '<span class="setas"><button type="button" data-acao="subir" data-k="' + k + '" aria-label="Subir">▲</button>' +
      '<button type="button" data-acao="descer" data-k="' + k + '" aria-label="Descer">▼</button></span>';
  }
  function categoriaHtml(cat, ci) {
    var k = 'categorias.' + ci;
    return '<details class="cat" data-d="' + k + '"' + (abertos[k] ? ' open' : '') + '><summary><span class="cat-ic">' + esc(cat.icone || '•') + '</span><b>' + esc(cat.nome || 'Sem nome') + '</b>' +
      '<small>' + (cat.itens || []).length + ' itens' + (cat.oculto ? ' · oculta' : '') + '</small>' + setas(k) + '</summary><div class="cat-corpo">' +
      '<div class="linha linha-cat">' + fTexto('Nome da categoria', k + '.nome') + fTexto('Ícone', k + '.icone', 'Um emoji. Ex.: 🎂', ' maxlength="4" class="curto"') + '</div>' +
      fArea('Descrição', k + '.desc', '', 2) + fCheck('Ocultar categoria do site', k + '.oculto') +
      '<div class="massa-preco"><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="Novo preço por kg" data-preco-cat="' + ci + '">' +
      '<button type="button" class="btn btn-sm" data-acao="preco-cat" data-ci="' + ci + '">Aplicar a todos os bolos por kg</button></div>' +
      '<div class="produtos">' + (cat.itens || []).map(function (it, ii) { return itemHtml(it, k + '.itens.' + ii); }).join('') + '</div>' +
      '<div class="acoes"><button type="button" class="btn btn-sm btn-pri" data-acao="add-item" data-ci="' + ci + '">+ Novo produto</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + k + '" data-confirma="Excluir a categoria e todos os produtos dela?">Excluir categoria</button></div>' +
      '</div></details>';
  }
  function itemHtml(it, k) {
    var tipo = precoTipo(it);
    return '<details class="prod" data-d="' + k + '"' + (abertos[k] ? ' open' : '') + '><summary>' +
      '<span class="thumb">' + (it.img ? '<img src="' + esc(imgSrc(it.img, 120)) + '" alt="" loading="lazy">' : '') + '</span>' +
      '<span class="prod-nome"><b>' + esc(it.nome || 'Novo produto') + '</b><small>' + precoResumo(it) +
      (it.esgotado ? ' · <em>esgotado</em>' : '') + (it.oculto ? ' · <em>oculto</em>' : '') + '</small></span>' + setas(k) + '</summary>' +
      '<div class="prod-corpo">' + fFoto('Foto do produto', k + '.img', 1000) +
      fTexto('Nome', k + '.nome') + fArea('Descrição', k + '.desc', '', 2) +
      fTexto('Rendimento', k + '.rendimento', 'Opcional. Ex.: Forma de 24 cm, serve 12 pessoas.') +
      campo('Tipo de preço', '<select data-tipo="' + k + '">' + [['unidade', 'Preço fixo (unidade, cento...)'], ['kg', 'Por kg (bolo confeitado)'], ['opcoes', 'Com opções/tamanhos']].map(function (o) {
        return '<option value="' + o[0] + '"' + (tipo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select>') +
      (tipo === 'kg' ? fNum('Preço por kg (R$)', k + '.precoKg') : '') +
      (tipo === 'unidade' ? '<div class="linha">' + fNum('Preço (R$)', k + '.preco') + fTexto('Vendido por', k + '.unidade', 'Ex.: cento, unidade, fatia. Opcional.') + '</div>' : '') +
      (tipo === 'opcoes' ? fTexto('Título das opções', k + '.opcoesTitulo', 'Ex.: Quantidade, Tamanho.') + (it.opcoes || []).map(function (o, oi) {
        var ko = k + '.opcoes.' + oi;
        return '<div class="linha bloco">' + fTexto('Opção', ko + '.nome') + fNum('Preço (R$)', ko + '.preco') +
          '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + ko + '">×</button></div>';
      }).join('') + '<button type="button" class="btn btn-sm" data-acao="add-opcao" data-k="' + k + '">+ Opção</button>' : '') +
      '<div class="linha linha-sabor">' + fLista('Sabores para o cliente escolher', k + '.sabores.lista', 'Um por linha. Vazio = sem escolha de sabor.') +
      fNum('Máximo de sabores', k + '.sabores.max', '', ' step="1"') + '</div>' +
      fNum('Preço antigo (R$)', k + '.precoAntigo', 'Opcional: aparece riscado, para promoções.') +
      campo('Etiquetas', '<input data-k="' + k + '.tags" data-t="virgulas" value="' + esc((it.tags || []).join(', ')) + '">', 'Separe por vírgula. Ex.: Mais pedido, Novo') +
      fCheck('Esgotado', k + '.esgotado', 'Aparece no site, mas não pode ser pedido.') +
      fCheck('Ocultar do site', k + '.oculto') +
      '<div class="acoes"><button type="button" class="btn btn-sm" data-acao="duplicar" data-k="' + k + '">Duplicar</button>' +
      '<button type="button" class="btn btn-sm btn-ghost" data-acao="remover" data-k="' + k + '" data-confirma="Excluir este produto?">Excluir produto</button></div>' +
      '</div></details>';
  }

  /* ---------- telas de acesso ---------- */
  function tela(html) {
    app.innerHTML = '<div class="acesso"><img class="acesso-logo" src="../assets/img/logo.png" alt="Doçuras da Lorrany"><h1>Painel da loja</h1>' + html + '</div>';
    var f = $('input', app); if (f) f.focus();
  }
  function telaLogin(msg) {
    tela('<form class="login cartao" data-form="login">' + (msg ? '<p class="aviso">' + esc(msg) + '</p>' : '') +
      campo('Usuário', '<input name="usuario" required autocomplete="username" autocapitalize="none">') +
      senhaCampo('Senha', 'senha', '', 'current-password') +
      '<label class="check"><input type="checkbox" name="lembrar" checked><span><b>Manter conectado neste aparelho</b><small>Desmarque em aparelhos de outras pessoas.</small></span></label>' +
      '<button class="btn btn-pri">Entrar</button>' +
      '<button type="button" class="link" data-acao="esqueci">Esqueci minha senha</button></form>');
  }
  function telaPrimeiroAcesso() {
    tela('<form class="login cartao" data-form="primeiro">' +
      '<p class="aviso">Primeiro acesso: crie a sua senha e conecte a publicação. Depois disso, "Admin / Admin" deixa de funcionar.</p>' +
      campo('Usuário', '<input name="usuario" required autocomplete="username" value="' + USUARIO_PADRAO + '">', 'Pode manter "Admin" ou trocar.') +
      senhaCampo('Nova senha', 'nova', 'Mínimo de 8 caracteres. Evite datas e nomes.') + senhaCampo('Repita a nova senha', 'nova2') +
      campo('E-mail de recuperação', '<input name="email" type="email" required placeholder="seuemail@gmail.com">', 'O código para recuperar a senha vai para este e-mail.') +
      '<fieldset class="tecnico"><legend>Publicação (quem instalou o site preenche)</legend>' +
      campo('Token do GitHub', '<input name="token" type="password" autocomplete="off" required placeholder="github_pat_...">') +
      campo('Validade do token', '<input name="validade" type="date">', 'Opcional: o painel avisa antes de vencer.') +
      '<div class="linha">' + campo('Usuário GitHub', '<input name="owner" value="' + PADRAO_GH.owner + '">') +
      campo('Repositório', '<input name="repo" value="' + PADRAO_GH.repo + '">') + campo('Branch', '<input name="branch" value="' + PADRAO_GH.branch + '">') + '</div></fieldset>' +
      '<button class="btn btn-pri">Criar acesso</button><button type="button" class="link" data-acao="voltar-login">Voltar</button></form>');
  }
  function telaEsqueci() {
    if (!A) return telaLogin('O painel ainda não foi configurado: entre com usuário Admin e senha Admin.');
    tela('<form class="login cartao" data-form="recuperar">' +
      '<p class="desc">Procure no e-mail <b>' + esc(mascararEmail(A.email)) + '</b> a mensagem <b>"Código de recuperação – Painel Doçuras da Lorrany"</b> e digite o código abaixo.</p>' +
      campo('Código de recuperação', '<input name="codigo" required autocomplete="one-time-code" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX">') +
      senhaCampo('Nova senha', 'nova', 'Mínimo de 8 caracteres.') + senhaCampo('Repita a nova senha', 'nova2') +
      '<button class="btn btn-pri">Criar nova senha</button><button type="button" class="link" data-acao="voltar-login">Voltar</button>' +
      '<p class="desc pequeno">Não acha o e-mail? Procure também em Spam e Promoções. Se não encontrar, fale com quem instalou o site.</p></form>');
  }
  var depoisCodigo = null;
  function telaCodigo(codigo, email, depois) {
    depoisCodigo = depois;
    var assunto = 'Código de recuperação – Painel Doçuras da Lorrany';
    var corpo = 'Guarde este e-mail.\n\nSe você esquecer a senha do painel da loja, abra ' + location.href.split('?')[0] +
      ', toque em "Esqueci minha senha" e digite o código:\n\n' + codigo + '\n\nCada código vale até você gerar um novo ou recuperar a senha.';
    tela('<div class="login cartao"><h2>Seu código de recuperação</h2>' +
      '<p class="desc">Envie este código para o seu e-mail agora. É com ele que você cria uma senha nova se esquecer a atual.</p>' +
      '<div class="codigo">' + esc(codigo) + '</div>' +
      '<a class="btn btn-pri" href="mailto:' + encodeURIComponent(email) + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo) + '" data-enviado>Enviar para ' + esc(mascararEmail(email)) + '</a>' +
      '<button type="button" class="btn" data-copiar="' + esc(codigo) + '">Copiar código</button>' +
      '<p class="desc pequeno">O botão abre o seu aplicativo de e-mail com a mensagem pronta: é só tocar em enviar.</p>' +
      '<button type="button" class="btn btn-ghost" data-acao="codigo-ok">Já enviei, continuar</button></div>');
  }

  function senhaValida(f) {
    if (f.nova.value.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.'); f.nova.focus(); return false; }
    if (f.nova.value !== f.nova2.value) { toast('As duas senhas não são iguais.'); f.nova2.focus(); return false; }
    if (f.nova.value.toLowerCase() === SENHA_PADRAO.toLowerCase()) { toast('Escolha uma senha diferente de "Admin".'); return false; }
    return true;
  }
  function entrar(f) {
    var usuario = f.usuario.value.trim(), senha = f.senha.value, lembrar = f.lembrar.checked;
    if (!A) {
      if (usuario.toLowerCase() === USUARIO_PADRAO.toLowerCase() && senha === SENHA_PADRAO) return telaPrimeiroAcesso();
      return toast('Usuário ou senha incorretos.');
    }
    if (usuario.toLowerCase() !== String(A.usuario).toLowerCase()) return toast('Usuário ou senha incorretos.');
    carregando(true, 'Entrando...');
    var k;
    desembrulhar(A.senha, senha).then(function (raw) { k = raw; return decifrarToken(k); }).then(function (token) {
      carregando(false);
      salvarSessao({ usuario: A.usuario, token: token, owner: A.repo.owner, repo: A.repo.repo, branch: A.repo.branch, k: b64(k) }, lembrar);
      abrirEditor();
    }).catch(function () { carregando(false); toast('Usuário ou senha incorretos.'); });
  }
  function primeiroAcesso(f) {
    if (!senhaValida(f)) return;
    var cred = { token: f.token.value.trim(), owner: f.owner.value.trim(), repo: f.repo.value.trim(), branch: f.branch.value.trim() || 'main' };
    var k = aleatorio(32), codigo = novoCodigo(), novo;
    carregando(true, 'Conferindo o token...');
    validarToken(cred).then(function () {
      carregando(true, 'Protegendo o acesso...');
      return Promise.all([embrulhar(k, f.nova.value), embrulhar(k, normCodigo(codigo)), cifrarToken(k, cred.token)]);
    }).then(function (r) {
      novo = { versao: 1, usuario: f.usuario.value.trim() || USUARIO_PADRAO, email: f.email.value.trim(), iteracoes: ITERACOES,
        senha: r[0], recuperacao: r[1], token: r[2], repo: { owner: cred.owner, repo: cred.repo, branch: cred.branch }, validadeToken: f.validade.value || null };
      carregando(true, 'Salvando...');
      return salvarAcesso(novo, cred, 'Configura acesso do painel');
    }).then(function () {
      carregando(false);
      salvarSessao({ usuario: novo.usuario, token: cred.token, owner: cred.owner, repo: cred.repo, branch: cred.branch, k: b64(k) }, true);
      telaCodigo(codigo, novo.email, abrirEditor);
    }).catch(function (e) { carregando(false); toast(e.message, 5000); });
  }
  function recuperar(f) {
    if (!senhaValida(f)) return;
    var k, token, codigo = novoCodigo(), novo = clonar(A);
    carregando(true, 'Conferindo o código...');
    desembrulhar(A.recuperacao, normCodigo(f.codigo.value)).then(function (raw) { k = raw; return decifrarToken(k); }, function () {
      throw new Error('Código de recuperação incorreto.');
    }).then(function (t) {
      token = t;
      return Promise.all([embrulhar(k, f.nova.value), embrulhar(k, normCodigo(codigo))]);
    }).then(function (r) {
      novo.senha = r[0]; novo.recuperacao = r[1];
      carregando(true, 'Salvando a nova senha...');
      var cred = { token: token, owner: A.repo.owner, repo: A.repo.repo, branch: A.repo.branch };
      return salvarAcesso(novo, cred, 'Recupera senha do painel').then(function () {
        salvarSessao({ usuario: novo.usuario, token: token, owner: cred.owner, repo: cred.repo, branch: cred.branch, k: b64(k) }, true);
      });
    }).then(function () {
      carregando(false); toast('Senha nova criada!');
      telaCodigo(codigo, novo.email, abrirEditor);
    }).catch(function (e) {
      carregando(false);
      toast(e.status === 401 ? 'A chave de publicação venceu. Fale com quem instalou o site.' : e.message, 5000);
    });
  }
  function trocarSenha(f) {
    if (!senhaValida(f)) return;
    var novo = clonar(A), k = unb64(S.k);
    carregando(true, 'Conferindo...');
    desembrulhar(A.senha, f.atual.value).then(function () { return embrulhar(k, f.nova.value); }, function () {
      throw new Error('A senha atual está incorreta.');
    }).then(function (w) {
      novo.senha = w;
      return salvarAcesso(novo, null, 'Troca senha do painel');
    }).then(function () { carregando(false); f.reset(); toast('Senha trocada! Use a nova senha no próximo acesso.', 4000); })
      .catch(function (e) { carregando(false); toast(e.message, 5000); });
  }
  function salvarDadosAcesso(f) {
    var novo = clonar(A);
    novo.usuario = f.usuario.value.trim() || A.usuario; novo.email = f.email.value.trim();
    carregando(true, 'Salvando...');
    salvarAcesso(novo, null, 'Atualiza dados de acesso do painel').then(function () {
      S.usuario = novo.usuario; salvarSessao(S, lembrado());
      carregando(false); toast('Dados de acesso salvos.'); render();
    }).catch(function (e) { carregando(false); toast(e.message, 5000); });
  }
  function gerarCodigo() {
    if (!confirm('Gerar um código novo? O código antigo deixa de funcionar.')) return;
    var novo = clonar(A), codigo = novoCodigo();
    carregando(true, 'Gerando...');
    embrulhar(unb64(S.k), normCodigo(codigo)).then(function (w) {
      novo.recuperacao = w;
      return salvarAcesso(novo, null, 'Gera novo código de recuperação');
    }).then(function () {
      carregando(false);
      telaCodigo(codigo, novo.email, function () { aba = 'conta'; montar(); });
    }).catch(function (e) { carregando(false); toast(e.message, 5000); });
  }
  function trocarToken(f) {
    var cred = { token: f.token.value.trim(), owner: S.owner, repo: S.repo, branch: S.branch };
    var novo = clonar(A);
    carregando(true, 'Conferindo o token...');
    validarToken(cred).then(function () { return cifrarToken(unb64(S.k), cred.token); }).then(function (c) {
      novo.token = c; novo.validadeToken = f.validade.value || null;
      return salvarAcesso(novo, cred, 'Troca token de publicação do painel');
    }).then(function () {
      S.token = cred.token; salvarSessao(S, lembrado());
      carregando(false); toast('Token salvo!'); conferirValidade(); render();
    }).catch(function (e) { carregando(false); toast(e.message, 5000); });
  }

  /* ---------- editor ---------- */
  function montar() {
    app.innerHTML = '<header class="topo"><img src="' + esc(imgSrc(D.logo)) + '" alt=""><div><b>' + esc(D.nome) + '</b><small>Olá, ' + esc(S.usuario) + '</small></div>' +
      '<a class="btn btn-sm btn-ghost" href="../" target="_blank" rel="noopener">Ver site</a></header>' +
      '<div class="alerta" hidden></div>' +
      '<nav class="abas">' + ABAS.map(function (a) { return '<button type="button" data-aba="' + a[0] + '">' + a[1] + '</button>'; }).join('') + '</nav>' +
      '<main class="painel"></main>' +
      '<div class="barra" hidden><span>Não publicado</span><button type="button" class="btn btn-sm btn-ghost" data-acao="previa">Pré-visualizar</button>' +
      '<button type="button" class="btn btn-sm btn-pri" data-acao="ir-publicar">Publicar</button></div>';
    render(); alerta();
  }
  function render() {
    if (!$('.painel')) return;
    $$('.abas button').forEach(function (b) { b.classList.toggle('ativo', b.dataset.aba === aba); });
    $('.painel').innerHTML = RENDER[aba]();
    barra();
  }
  function barra() { var b = $('.barra'); if (b) b.hidden = !alterado || aba === 'publicar'; }

  /* ---------- eventos ---------- */
  function converter(el) {
    var t = el.dataset.t, v = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'bool') return !!v;
    if (t === 'num') return v === '' ? null : +String(v).replace(',', '.');
    if (t === 'linhas') return v.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    if (t === 'virgulas') return v.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (t === 'numeros') return v.split(/[;,\s]+/).map(function (s) { return +s.replace(',', '.'); }).filter(function (n) { return n > 0; });
    return v;
  }
  app.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset.k || el.type === 'checkbox' || el.tagName === 'SELECT') return;
    definir(D, el.dataset.k, converter(el)); salvarRascunho();
    if (/\.nome$/.test(el.dataset.k)) {
      var sum = el.closest('details') && $('summary b', el.closest('details'));
      if (sum) sum.textContent = el.value || 'Sem nome';
    }
  });
  app.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset.img) return carregarFoto(el);
    if (el.dataset.acaoArquivo === 'importar') return importar(el);
    if (el.dataset.acaoDia) {
      var i = +el.dataset.acaoDia;
      D.horarios[i] = el.checked ? { abre: '08:00', fecha: '18:00' } : null;
      salvarRascunho(); return render();
    }
    if (el.dataset.diaSem) {
      var d = +el.dataset.diaSem, sem = (D.pedidos.diasSemEncomenda || []).filter(function (x) { return x !== d; });
      if (el.checked) sem.push(d);
      D.pedidos.diasSemEncomenda = sem.sort(); salvarRascunho(); return;
    }
    if (el.dataset.tipo) { mudarTipo(el.dataset.tipo, el.value); salvarRascunho(); return render(); }
    if (el.dataset.k && (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'color' || el.dataset.t === 'numeros')) {
      definir(D, el.dataset.k, converter(el)); salvarRascunho();
      if (el.dataset.r) render();
    }
  });
  app.addEventListener('toggle', function (e) {
    var d = e.target; if (d.dataset && d.dataset.d) abertos[d.dataset.d] = d.open;
  }, true);
  app.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, tipo = f.dataset.form;
    if (tipo === 'login') entrar(f);
    else if (tipo === 'primeiro') primeiroAcesso(f);
    else if (tipo === 'recuperar') recuperar(f);
    else if (tipo === 'trocar-senha') trocarSenha(f);
    else if (tipo === 'dados-acesso') salvarDadosAcesso(f);
    else if (tipo === 'trocar-token') trocarToken(f);
  });
  app.addEventListener('click', function (e) {
    var ver = e.target.closest('[data-ver-senha]');
    if (ver) { var inp0 = ver.previousElementSibling; inp0.type = inp0.type === 'password' ? 'text' : 'password'; return; }
    var cp = e.target.closest('[data-copiar]');
    if (cp) { if (navigator.clipboard) navigator.clipboard.writeText(cp.dataset.copiar).then(function () { toast('Código copiado.'); }); return; }
    var ab = e.target.closest('[data-aba]');
    if (ab) { aba = ab.dataset.aba; render(); window.scrollTo(0, 0); return; }
    var b = e.target.closest('[data-acao]'); if (!b) return;
    var k = b.dataset.k, a = b.dataset.acao;
    if (b.closest('summary')) e.preventDefault();
    if (a === 'remover') {
      if (b.dataset.confirma && !confirm(b.dataset.confirma)) return;
      remover(k); salvarRascunho(); render();
    } else if (a === 'subir' || a === 'descer') {
      mover(k, a === 'subir' ? -1 : 1); abertos = {}; salvarRascunho(); render();
    } else if (a === 'limpar') { definir(D, k, null); salvarRascunho(); render(); }
    else if (a === 'duplicar') {
      var p = k.split('.'), i = +p.pop(), lista = obter(D, p.join('.')), copia = clonar(lista[i]);
      copia.nome += ' (cópia)'; lista.splice(i + 1, 0, copia); abertos[p.join('.') + '.' + (i + 1)] = true; salvarRascunho(); render();
    } else if (a === 'add-item') {
      var cat = D.categorias[+b.dataset.ci], base = cat.itens.filter(function (x) { return x.precoKg > 0; })[0];
      cat.itens.push(base ? { nome: '', desc: '', precoKg: base.precoKg, img: '' } : { nome: '', desc: '', preco: 0, img: '' });
      abertos['categorias.' + b.dataset.ci + '.itens.' + (cat.itens.length - 1)] = true; salvarRascunho(); render();
    } else if (a === 'add-cat') {
      D.categorias.push({ nome: 'Nova categoria', icone: '🍰', desc: '', itens: [] });
      abertos['categorias.' + (D.categorias.length - 1)] = true; salvarRascunho(); render();
    } else if (a === 'add-opcao') { var it = obter(D, k); (it.opcoes = it.opcoes || []).push({ nome: '', preco: 0 }); salvarRascunho(); render(); }
    else if (a === 'add-conta') { D.pagamento.contas.push({ banco: '', agencia: '', conta: '', tipo: 'Conta corrente', titular: '', documento: '' }); salvarRascunho(); render(); }
    else if (a === 'add-massa') { D.bolosKg.massas.push({ nome: '', acrescimo: 0, porKg: false }); salvarRascunho(); render(); }
    else if (a === 'add-galeria') { (D.galeria = D.galeria || []).push(''); render(); }
    else if (a === 'add-depoimento') { (D.depoimentos = D.depoimentos || []).push({ nome: '', texto: '', foto: '' }); salvarRascunho(); render(); }
    else if (a === 'add-data') {
      var nd = $('[data-nova-data]').value;
      if (!nd) return toast('Escolha a data no calendário.');
      var datas = D.pedidos.datasBloqueadas = D.pedidos.datasBloqueadas || [];
      if (datas.indexOf(nd) < 0) datas.push(nd);
      datas.sort(); salvarRascunho(); render(); toast(dataBR(nd) + ' bloqueada. Publique para valer no site.');
    } else if (a === 'preco-cat') {
      var inp = $('[data-preco-cat="' + b.dataset.ci + '"]'), v = +String(inp.value).replace(',', '.');
      if (!(v > 0)) return toast('Digite o novo preço por kg.');
      var n = 0; D.categorias[+b.dataset.ci].itens.forEach(function (x) { if (x.precoKg > 0) { x.precoKg = v; n++; } });
      salvarRascunho(); render(); toast(n + ' bolo(s) atualizados para ' + brl(v) + '/kg');
    } else if (a === 'cores-padrao') {
      D.tema = clonar(CORES_PADRAO); salvarRascunho(); render();
    } else if (a === 'previa') { salvarRascunho(); alterado = alteradoReal(); window.open('../?previa=1', '_blank'); }
    else if (a === 'ir-publicar') { aba = 'publicar'; render(); window.scrollTo(0, 0); }
    else if (a === 'publicar') publicar();
    else if (a === 'exportar') exportar();
    else if (a === 'descartar') {
      if (!confirm('Descartar tudo que ainda não foi publicado?')) return;
      try { localStorage.removeItem(RASCUNHO); } catch (er) { /* ok */ }
      D = JSON.parse(publicado); alterado = false; render();
    } else if (a === 'sair') { salvarSessao(null); telaLogin(); }
    else if (a === 'qr-mesas') imprimirMesas();
    else if (a === 'esqueci') telaEsqueci();
    else if (a === 'voltar-login') telaLogin();
    else if (a === 'codigo-ok') { if (depoisCodigo) depoisCodigo(); }
    else if (a === 'novo-codigo') gerarCodigo();
    else if (a === 'instalar' && instalar) { instalar.prompt(); instalar = null; }
  });
  var CORES_PADRAO = { primaria: '#d6457a', textoPrimaria: '#ffffff', secundaria: '#f7c6d6', fundo: '#fff7f9', superficie: '#ffffff', texto: '#4a2318', suave: '#8a6a62' };
  function alteradoReal() { return JSON.stringify(D) !== publicado; }

  function mudarTipo(k, tipo) {
    var it = obter(D, k), ref = it.preco || it.precoKg || (it.opcoes && it.opcoes[0] && it.opcoes[0].preco) || 0;
    delete it.preco; delete it.precoKg; delete it.opcoes; delete it.opcoesTitulo;
    if (tipo === 'kg') { it.precoKg = ref || 80; delete it.unidade; }
    else if (tipo === 'opcoes') { it.opcoes = [{ nome: 'Pequeno', preco: ref }, { nome: 'Grande', preco: ref }]; it.opcoesTitulo = 'Escolha o tamanho'; }
    else it.preco = ref;
  }

  /* ---------- fotos ---------- */
  function carregarFoto(el) {
    var f = el.files && el.files[0]; if (!f) return;
    var max = +el.dataset.max || 1000, png = !!el.dataset.png;
    var leitor = new FileReader();
    leitor.onload = function () {
      var im = new Image();
      im.onload = function () {
        var fator = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * fator); c.height = Math.round(im.height * fator);
        var ctx = c.getContext('2d');
        if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(im, 0, 0, c.width, c.height);
        definir(D, el.dataset.img, png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.82));
        salvarRascunho(); render(); toast('Foto pronta. Publique para ela ir para o site.');
      };
      im.onerror = function () { toast('Não foi possível abrir esta imagem.'); };
      im.src = leitor.result;
    };
    leitor.readAsDataURL(f);
  }

  /* ---------- publicar ---------- */
  function limparDados(dados) {
    var hoje = hojeISO();
    dados.pedidos.datasBloqueadas = (dados.pedidos.datasBloqueadas || []).filter(function (d) { return d >= hoje; });
    dados.galeria = (dados.galeria || []).filter(Boolean);
    dados.depoimentos = (dados.depoimentos || []).filter(function (d) { return d.texto; });
    dados.categorias.forEach(function (c) {
      c.itens.forEach(function (it) { if (it.sabores && !(it.sabores.lista || []).length) delete it.sabores; });
    });
    return dados;
  }
  function publicar() {
    var dados = limparDados(clonar(D)), arquivos = [], n = 0, carimbo = Date.now().toString(36);
    // fotos novas (data:) viram arquivos em img/produtos/
    (function trocar(o, nome) {
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === 'string' && v.indexOf('data:image/') === 0) {
          var ext = v.indexOf('image/png') > 0 ? 'png' : 'jpg';
          var caminho = 'img/produtos/' + slug(o.nome || nome || k) + '-' + carimbo + (n++) + '.' + ext;
          arquivos.push({ path: caminho, base64: v.split(',')[1] });
          o[k] = caminho;
        } else if (v && typeof v === 'object') trocar(v, o.nome || nome);
      });
    })(dados, '');
    arquivos.push({ path: 'dados.json', texto: JSON.stringify(dados, null, 2) + '\n' });

    carregando(true, 'Publicando...');
    commitar(arquivos, 'Atualiza catálogo pelo painel (' + new Date().toLocaleString('pt-BR') + ')').then(function () {
      D = dados; publicado = JSON.stringify(D); alterado = false;
      try { localStorage.removeItem(RASCUNHO); } catch (e) { /* ok */ }
      carregando(false); render();
      toast('Publicado! O site atualiza em 1 a 2 minutos.', 5000);
    }).catch(function (e) {
      carregando(false);
      toast('Não foi possível publicar: ' + (e.status === 401 ? 'a chave de publicação venceu ou foi revogada.' : e.message), 6000);
      if (e.status === 401) { validade = { dias: -1 }; alerta(); }
    });
  }

  /* ---------- backup ---------- */
  function exportar() {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }));
    a.download = 'backup-docuras-da-lorrany-' + hojeISO() + '.json';
    a.click();
  }
  function importar(el) {
    var f = el.files && el.files[0]; if (!f) return;
    f.text().then(function (txt) {
      var j = JSON.parse(txt);
      if (!j || !Array.isArray(j.categorias)) throw new Error('arquivo inválido');
      D = normalizar(j); salvarRascunho(); render(); toast('Backup restaurado. Publique para aplicar no site.');
    }).catch(function () { toast('Este arquivo não é um backup do catálogo.'); });
  }

  /* ---------- QR das mesas ---------- */
  function imprimirMesas() {
    var n = +D.pedidos.mesas || 0;
    if (!n) return toast('Informe a quantidade de mesas.');
    var url = location.href.replace(/admin\/.*$/, '');
    var w = window.open('', '_blank');
    w.document.write('<!doctype html><meta charset="utf-8"><title>QR Code das mesas</title><style>body{font-family:sans-serif;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:16px}' +
      '.p{border:2px dashed #d6457a;border-radius:16px;padding:16px;text-align:center;break-inside:avoid}.p img,.p canvas{margin:8px auto}h2{margin:0;color:#d6457a}</style>');
    for (var i = 1; i <= n; i++) w.document.write('<div class="p"><h2>Mesa ' + i + '</h2><div id="q' + i + '"></div><p>' + esc(D.nome) + '<br>Aponte a câmera e faça seu pedido</p></div>');
    for (var j = 1; j <= n; j++) if (window.QRCode) new window.QRCode(w.document.getElementById('q' + j), { text: url + '?mesa=' + j, width: 170, height: 170 });
    w.document.close(); setTimeout(function () { w.print(); }, 400);
  }

  /* ---------- início ---------- */
  function normalizar(j) {
    j.tema = j.tema || clonar(CORES_PADRAO);
    j.promo = j.promo || { ativo: false };
    j.contato = j.contato || {}; j.redes = j.redes || {}; j.endereco = j.endereco || {};
    j.pedidos = j.pedidos || {}; j.entrega = j.entrega || {};
    j.pedidos.datasBloqueadas = j.pedidos.datasBloqueadas || []; j.pedidos.diasSemEncomenda = j.pedidos.diasSemEncomenda || [];
    j.pagamento = j.pagamento || {}; j.pagamento.pix = j.pagamento.pix || {}; j.pagamento.contas = j.pagamento.contas || [];
    j.bolosKg = j.bolosKg || { pesos: [1, 2, 3], massas: [] }; j.bolosKg.massas = j.bolosKg.massas || [];
    j.bolosKg.topo = j.bolosKg.topo || { ativo: false, preco: 0 };
    j.depoimentos = j.depoimentos || [];
    j.categorias.forEach(function (c) { c.itens = c.itens || []; });
    return j;
  }
  function abrirEditor() {
    fetch('../dados.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (pub) {
      publicado = JSON.stringify(normalizar(pub));
      var rasc = null;
      try { rasc = JSON.parse(localStorage.getItem(RASCUNHO)); } catch (e) { /* sem rascunho */ }
      D = rasc ? normalizar(rasc) : JSON.parse(publicado);
      alterado = alteradoReal();
      montar();
      if (alterado) toast('Rascunho recuperado: há alterações não publicadas.', 4000);
      conferirValidade();
    }).catch(function () {
      app.innerHTML = '<p class="carregando">Não foi possível carregar os dados da loja. Verifique a internet e atualize a página.</p>';
    });
  }
  function iniciar() {
    carregarAcesso().then(function (acesso) {
      A = acesso;
      // sessão de outro acesso (senha trocada em outro aparelho continua valendo aqui até sair)
      if (S && A && S.k && S.token) abrirEditor();
      else { salvarSessao(null); telaLogin(); }
    }).catch(function () {
      app.innerHTML = '<p class="carregando">Não foi possível abrir o painel. Verifique a internet e atualize a página.</p>';
    });
  }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); instalar = e; if (aba === 'conta') render(); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () { /* opcional */ });
  iniciar();
})();
