/*!
 * Catálogo Doçuras da Lorrany — motor de renderização
 * Lê o dados.json (editado pelo painel /admin) e monta a página inteira:
 * capa, catálogo com preços (por unidade, por cento ou por kg), carrinho com envio
 * pelo WhatsApp, encomenda com data, Pix copia e cola, horários, mapa e contato.
 * Baseado no motor do Cardápio Digital (modelo Hamburgueria 1 · Impacto).
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var RASCUNHO = 'lorrany:rascunho';

  // ?previa=1 mostra o rascunho que está sendo editado no painel admin
  function carregar() {
    if (params.get('previa')) {
      try {
        var r = JSON.parse(localStorage.getItem(RASCUNHO));
        if (r) return Promise.resolve(r);
      } catch (e) { /* sem rascunho */ }
    }
    return fetch('dados.json?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  carregar().then(iniciar).catch(function (e) {
    document.getElementById('app').innerHTML = '<p style="padding:2rem;text-align:center">Não foi possível carregar o catálogo. Tente atualizar a página.</p>';
    console.error(e);
  });

  function iniciar(C) {
    var MESA = params.get('mesa');
    var DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    var entrega = C.entrega || {};
    var pedidos = C.pedidos || {};
    var pag = C.pagamento || {};
    var pix = pag.pix || {};
    var contato = C.contato || {};
    var redes = C.redes || {};
    var end = C.endereco || {};
    var kg = C.bolosKg || {};
    var credito = C.credito || {};
    if (!pedidos.mesa) MESA = null;

    /* ---------- utilidades ---------- */
    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function brl(n) { return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
    function img(src, w) {
      if (!src) return '';
      if (/[\/.:]/.test(src)) return src; // caminho local, URL completa ou data:
      return 'https://images.unsplash.com/photo-' + src + '?w=' + (w || 600) + '&q=70&auto=format&fit=crop';
    }
    function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }
    function wa(numero, texto) {
      return 'https://wa.me/' + soDigitos(numero) + (texto ? '?text=' + encodeURIComponent(texto) : '');
    }
    function semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function kgTxt(p) { return String(p).replace('.', ',') + ' kg'; }
    function toMin(h) { var p = h.split(':'); return +p[0] * 60 + +p[1]; }
    function urlLimpa() { return location.origin + location.pathname; }
    var store = {
      get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
    };

    /* ---------- ícones ---------- */
    function svg(path) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>'; }
    var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    var ICON = {
      whatsapp: svg('<path fill="currentColor" d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.23 9.43-9.44 9.43m8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.04c0 2 .52 3.95 1.52 5.67L.6 23.3l5.72-1.5a11.3 11.3 0 0 0 5.42 1.38h.01c6.25 0 11.34-5.09 11.34-11.34 0-3.03-1.18-5.88-3.32-8.02"/>'),
      instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5" ' + S + '/><circle cx="12" cy="12" r="4" ' + S + '/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>'),
      facebook: svg('<path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.24-1.46 1.49-1.46h1.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.8v3h2.6V21z"/>'),
      tiktok: svg('<path fill="currentColor" d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.37-2.48V9.66a5.7 5.7 0 0 0-.77-.05 5.69 5.69 0 0 0-5.69 5.69A5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.68-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48"/>'),
      phone: svg('<path ' + S + ' d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
      mail: svg('<rect x="3" y="5" width="18" height="14" rx="2" ' + S + '/><path ' + S + ' d="m3 7 9 6 9-6"/>'),
      pin: svg('<path ' + S + ' d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5" ' + S + '/>'),
      clock: svg('<circle cx="12" cy="12" r="9" ' + S + '/><path ' + S + ' d="M12 7v5l3 2"/>'),
      moto: svg('<circle cx="5.5" cy="17" r="3" ' + S + '/><circle cx="18.5" cy="17" r="3" ' + S + '/><path ' + S + ' d="M8.5 17h7l-3-7H9M15 6h3l2.5 6"/>'),
      card: svg('<rect x="2" y="5" width="20" height="14" rx="2" ' + S + '/><path ' + S + ' d="M2 10h20"/>'),
      cal: svg('<rect x="3" y="4" width="18" height="17" rx="2" ' + S + '/><path ' + S + ' d="M3 9h18M8 2v4M16 2v4"/>'),
      share: svg('<circle cx="18" cy="5" r="3" ' + S + '/><circle cx="6" cy="12" r="3" ' + S + '/><circle cx="18" cy="19" r="3" ' + S + '/><path ' + S + ' d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
      qr: svg('<path ' + S + ' d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>'),
      cart: svg('<path ' + S + ' d="M6 6h15l-1.5 9h-12zM6 6 5 2H2"/><circle cx="9" cy="20" r="1.5" fill="currentColor"/><circle cx="18" cy="20" r="1.5" fill="currentColor"/>'),
      menu: svg('<path ' + S + ' d="M4 6h16M4 12h16M4 18h16"/>'),
      search: svg('<circle cx="11" cy="11" r="7" ' + S + '/><path ' + S + ' d="m20 20-4-4"/>'),
      x: svg('<path ' + S + ' d="M6 6l12 12M18 6 6 18"/>'),
      plus: svg('<path ' + S + ' d="M12 5v14M5 12h14"/>'),
      minus: svg('<path ' + S + ' d="M5 12h14"/>'),
      trash: svg('<path ' + S + ' d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
      check: svg('<path ' + S + ' d="m5 12 5 5 9-10"/>'),
      copy: svg('<rect x="9" y="9" width="12" height="12" rx="2" ' + S + '/><path ' + S + ' d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
      bank: svg('<path ' + S + ' d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3l9 5H3z"/>')
    };
    var REDES = [
      ['instagram', 'Instagram', function (v) { return 'https://instagram.com/' + v.replace(/^@/, ''); }, function (v) { return '@' + v.replace(/^@/, ''); }],
      ['facebook', 'Facebook', function (v) { return 'https://facebook.com/' + v; }, function (v) { return '/' + v; }],
      ['tiktok', 'TikTok', function (v) { return 'https://tiktok.com/@' + v.replace(/^@/, ''); }, function (v) { return '@' + v.replace(/^@/, ''); }]
    ];

    /* ---------- tema ---------- */
    var t = C.tema || {};
    var mapa = { primaria: '--pri', textoPrimaria: '--pri-ink', secundaria: '--sec', fundo: '--bg', superficie: '--surface', texto: '--text', suave: '--muted' };
    Object.keys(mapa).forEach(function (k) { if (t[k]) document.documentElement.style.setProperty(mapa[k], t[k]); });
    var meta = document.querySelector('meta[name=theme-color]'); if (meta && t.primaria) meta.content = t.primaria;
    if (C.logo) { var fav = document.querySelector('link[rel=icon]'); if (fav) fav.href = img(C.logo, 128); }

    /* ---------- horários ---------- */
    function status() {
      var H = C.horarios || [];
      var d = new Date(), dia = d.getDay(), m = d.getHours() * 60 + d.getMinutes();
      var h = H[dia];
      if (h) {
        var a = toMin(h.abre), f = toMin(h.fecha);
        if (f <= a ? m >= a : m >= a && m < f) return { aberto: true, txt: 'Atendendo agora · até ' + h.fecha };
      }
      for (var i = 0; i < 8; i++) {
        var dd = (dia + i) % 7, hh = H[dd];
        if (hh && (i > 0 || toMin(hh.abre) > m)) {
          var quando = i === 0 ? 'hoje' : i === 1 ? 'amanhã' : DIAS[dd].toLowerCase();
          return { aberto: false, txt: 'Fora do horário · atendimento ' + quando + ' às ' + hh.abre };
        }
      }
      return { aberto: false, txt: 'Fora do horário' };
    }
    var ST = status();

    /* ---------- itens ---------- */
    var ITENS = {};
    var CATS = (C.categorias || []).filter(function (c) { return !c.oculto; }).map(function (cat, ci) {
      var itens = (cat.itens || []).filter(function (it) { return !it.oculto; });
      itens.forEach(function (it, ii) {
        it.id = ci + '-' + ii;
        it.categoria = cat.nome;
        ITENS[it.id] = it;
      });
      return { nome: cat.nome, icone: cat.icone, desc: cat.desc, itens: itens };
    }).filter(function (c) { return c.itens.length; });

    var PESOS = (kg.pesos && kg.pesos.length ? kg.pesos : [1, 1.5, 2, 2.5, 3]).slice().sort(function (a, b) { return a - b; });
    var MASSAS = kg.massas && kg.massas.length ? kg.massas : [{ nome: 'Massa branca', acrescimo: 0 }];
    var COBERTURAS = (kg.coberturas || []).filter(Boolean);
    var TOPO = kg.topo && kg.topo.ativo;
    function acrescimoMassa(m, peso) { return (m && m.acrescimo || 0) * (m && m.porKg ? peso : 1); }
    function ehKg(it) { return it.precoKg > 0; }
    function precoBase(it) {
      if (ehKg(it)) return it.precoKg;
      if (it.opcoes && it.opcoes.length) return Math.min.apply(null, it.opcoes.map(function (o) { return o.preco; }));
      return it.preco;
    }
    function precoHtml(it) {
      var temOp = !ehKg(it) && it.opcoes && it.opcoes.length > 1;
      var un = ehKg(it) ? 'kg' : it.unidade;
      return '<span class="price">' +
        (it.precoAntigo ? '<s>' + brl(it.precoAntigo) + '</s>' : '') +
        (temOp ? '<small>a partir de</small>' : '') + '<b>' + brl(precoBase(it)) + '</b>' + (un ? '<small>/' + esc(un) + '</small>' : '') + '</span>';
    }
    function opcoesHtml(it) {
      if (ehKg(it)) return '<p class="item-opts"><span>A partir de ' + kgTxt(PESOS[0]) + '</span>' + (MASSAS.length > 1 ? '<span>' + MASSAS.length + ' opções de massa</span>' : '') + '</p>';
      if (!it.opcoes || it.opcoes.length < 2) return '';
      return '<p class="item-opts">' + it.opcoes.map(function (o) {
        return '<span>' + esc(o.nome) + ' <b>' + brl(o.preco) + '</b></span>';
      }).join('') + '</p>';
    }
    function slugTag(tg) { return semAcento(tg.toLowerCase()).replace(/\s+/g, '-'); }
    function tagsHtml(it) {
      var tags = (it.tags || []).slice();
      if (it.esgotado) tags.unshift('Esgotado');
      if (!tags.length) return '';
      return '<span class="tags">' + tags.map(function (tg) {
        return '<span class="tag tag-' + esc(slugTag(tg)) + '">' + esc(tg) + '</span>';
      }).join('') + '</span>';
    }
    function imgTag(src, w, alt) {
      return src ? '<img src="' + esc(img(src, w)) + '" alt="' + esc(alt) + '" loading="lazy" onerror="this.parentNode.classList.add(\'noimg\');this.remove()">' : '';
    }
    function itemHtml(it) {
      var busca = esc(semAcento((it.nome + ' ' + (it.desc || '') + ' ' + it.categoria).toLowerCase()));
      var addBtn = it.esgotado ? '<span class="add add-off">Esgotado</span>' :
        '<button class="add" data-add="' + it.id + '" aria-label="Adicionar ' + esc(it.nome) + '">' + ICON.plus + '<span>' + (ehKg(it) ? 'Montar' : 'Adicionar') + '</span></button>';
      return '<article class="item' + (it.esgotado ? ' esgotado' : '') + '" data-item="' + it.id + '" data-busca="' + busca + '">' +
        '<div class="item-img' + (it.img ? '' : ' noimg') + '">' + imgTag(it.img, 600, it.nome) + tagsHtml(it) + '</div>' +
        '<div class="item-body"><h4>' + esc(it.nome) + '</h4>' + (it.desc ? '<p class="desc">' + esc(it.desc) + '</p>' : '') +
        (it.rendimento ? '<p class="rend">' + esc(it.rendimento) + '</p>' : '') + opcoesHtml(it) +
        '<div class="item-foot">' + precoHtml(it) + addBtn + '</div></div></article>';
    }

    /* ---------- seções ---------- */
    function logoHtml(cls) {
      return '<div class="' + cls + '">' + (C.logo ? '<img src="' + esc(img(C.logo, 300)) + '" alt="Logo ' + esc(C.nome) + '">' : '<span>' + esc(C.nome.charAt(0)) + '</span>') + '</div>';
    }
    function statusHtml() {
      if (C.mostrarHorario === false) return '';
      return '<span class="status ' + (ST.aberto ? 'on' : 'off') + '"><i></i>' + esc(ST.txt) + '</span>';
    }
    function chips() {
      var c = [];
      if (pedidos.encomenda) c.push(ICON.cal + 'Sob encomenda');
      if (pedidos.entrega) c.push(ICON.moto + (entrega.taxa == null || entrega.taxa === '' ? 'Entrega a combinar' : entrega.taxa ? 'Entrega ' + brl(entrega.taxa) : 'Entrega grátis'));
      if (pedidos.retirada) c.push(ICON.pin + 'Retirada no local');
      if (pix.ativo && pix.chave) c.push(ICON.card + 'Pix e cartão');
      return '<ul class="chips">' + c.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    }
    function heroHtml() {
      var capa = img(C.capa, 1600);
      return '<header class="hero"' + (capa ? ' style="background-image:linear-gradient(180deg,rgba(74,35,24,.25),rgba(74,35,24,.78)),url(\'' + esc(capa) + '\')"' : '') + '>' +
        '<nav class="topbar"><span class="brand">' + esc(C.nome) + '</span><div class="top-actions">' +
        '<button class="icon-btn" data-acao="qr" aria-label="QR Code do catálogo">' + ICON.qr + '</button>' +
        '<button class="icon-btn" data-acao="share" aria-label="Compartilhar">' + ICON.share + '</button></div></nav>' +
        '<div class="hero-inner">' + logoHtml('logo logo-hero') + statusHtml() +
        (C.chamada ? '<p class="eyebrow">' + esc(C.chamada) + '</p>' : '') +
        '<h1>' + esc(C.nome) + '</h1>' + (C.slogan ? '<p class="slogan">' + esc(C.slogan) + '</p>' : '') +
        '<div class="hero-ctas"><a href="#cardapio" class="btn btn-pri">Ver catálogo</a>' +
        '<a href="' + wa(contato.whatsapp, 'Olá, ' + C.nome + '! Vim pelo catálogo digital.') + '" target="_blank" rel="noopener" class="btn btn-ghost">' + ICON.whatsapp + 'WhatsApp</a></div>' +
        chips() + '</div></header>';
    }
    function promoHtml() {
      var p = C.promo;
      if (!p || p.ativo === false || !p.titulo) return '';
      return '<section class="promo"><span class="promo-badge">' + esc(p.selo || 'Destaque') + '</span><div><h3>' + esc(p.titulo) +
        '</h3>' + (p.texto ? '<p>' + esc(p.texto) + '</p>' : '') + '</div></section>';
    }
    // "Bolos confeitados · R$ 80/kg" vira título "Bolos confeitados" e detalhe "R$ 80/kg"
    function partesCat(nome) { var p = String(nome).split(/\s+·\s+/); return { titulo: p[0], detalhe: p.slice(1).join(' · ') }; }
    function catCards(fechar) {
      return CATS.map(function (c, i) {
        var p = partesCat(c.nome), n = c.itens.length;
        return '<a class="cat-card" href="#cat-' + i + '"' + (fechar ? ' data-acao="fechar"' : '') + '>' +
          '<span class="cc-ic">' + (c.icone || '•') + '</span><span class="cc-txt"><b>' + esc(p.titulo) + '</b>' +
          '<small>' + (p.detalhe ? esc(p.detalhe) + ' · ' : '') + n + (n === 1 ? ' opção' : ' opções') + '</small></span></a>';
      }).join('');
    }
    function menuHtml() {
      return '<section id="cardapio" class="menu">' +
        '<div class="menu-head"><h2>Nosso catálogo</h2><label class="search">' + ICON.search +
        '<input type="search" placeholder="Buscar bolo, recheio, docinho..." aria-label="Buscar no catálogo"></label></div>' +
        '<nav class="cat-grid" aria-label="Categorias">' + catCards() + '</nav>' +
        '<div class="cat-bar" hidden><span class="cat-atual"></span><button type="button" class="btn btn-pri btn-sm" data-acao="cats">' + ICON.menu + 'Categorias</button></div>' +
        CATS.map(function (c, i) {
          return '<div class="cat" id="cat-' + i + '"><h3>' + (c.icone ? '<span class="cat-ic">' + c.icone + '</span>' : '') + esc(c.nome) + '</h3>' +
            (c.desc ? '<p class="cat-desc">' + esc(c.desc) + '</p>' : '') +
            '<div class="items">' + c.itens.map(itemHtml).join('') + '</div></div>';
        }).join('') +
        '<p class="no-results" hidden>Nenhum item encontrado.</p></section>';
    }
    function sobreHtml() {
      if (!C.sobre) return '';
      var gal = (C.galeria || []).filter(Boolean).map(function (g) { return '<figure>' + imgTag(g, 500, '') + '</figure>'; }).join('');
      return '<section id="sobre" class="sobre"><div class="sobre-txt"><h2>Sobre nós</h2><p>' + esc(C.sobre) + '</p>' +
        (C.diferenciais && C.diferenciais.length ? '<ul class="diferenciais">' + C.diferenciais.map(function (d) { return '<li>' + ICON.check + esc(d) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' + (gal ? '<div class="galeria">' + gal + '</div>' : '') + '</section>';
    }
    function depoimentosHtml() {
      var L = (C.depoimentos || []).filter(function (d) { return d && d.texto; });
      if (!L.length) return '';
      return '<section id="depoimentos" class="depoimentos"><h2>O que dizem nossos clientes</h2><div class="depo-lista">' + L.map(function (d) {
        return '<figure class="depo"><blockquote>' + esc(d.texto) + '</blockquote><figcaption>' +
          (d.foto ? '<img src="' + esc(img(d.foto, 120)) + '" alt="" loading="lazy">' : '<span class="depo-ini">' + esc((d.nome || '?').charAt(0)) + '</span>') +
          '<b>' + esc(d.nome || 'Cliente') + '</b></figcaption></figure>';
      }).join('') + '</div></section>';
    }
    function formasPagamento() {
      var f = [];
      if (pix.ativo) f.push('Pix');
      if (pag.credito) f.push('Cartão de crédito');
      if (pag.debito) f.push('Cartão de débito');
      if (pag.dinheiro) f.push('Dinheiro');
      if (pag.transferencia && (pag.contas || []).length) f.push('Transferência bancária');
      return f.length ? f : ['A combinar'];
    }
    function pixChave() {
      var k = String(pix.chave || '').trim();
      if (pix.tipo === 'telefone') { var d = soDigitos(k); return d ? '+' + (d.length <= 11 ? '55' + d : d) : ''; }
      if (pix.tipo === 'cpf' || pix.tipo === 'cnpj') return soDigitos(k);
      return k;
    }
    function contasHtml() {
      return (pag.contas || []).map(function (c) {
        return '<div class="conta"><b>' + esc(c.banco) + '</b>' +
          (c.agencia ? '<span>Agência: ' + esc(c.agencia) + '</span>' : '') +
          (c.conta ? '<span>' + esc(c.tipo || 'Conta') + ': ' + esc(c.conta) + '</span>' : '') +
          (c.titular ? '<span>Titular: ' + esc(c.titular) + '</span>' : '') +
          (c.documento ? '<span>CPF/CNPJ: ' + esc(c.documento) + '</span>' : '') + '</div>';
      }).join('');
    }
    function pixBoxHtml(valor) {
      var chave = pixChave();
      if (!pix.ativo || !chave) return '';
      var payload = valor ? brcode(valor) : '';
      return '<div class="pix-box"><p class="pix-tit">' + ICON.card + '<b>Chave Pix</b>' + (pix.tipo ? ' <small>(' + esc(pix.tipo) + ')</small>' : '') + '</p>' +
        '<div class="copiar"><code>' + esc(chave) + '</code><button type="button" class="btn btn-sm btn-pri" data-copiar="' + esc(chave) + '">' + ICON.copy + 'Copiar</button></div>' +
        (pix.titular ? '<p class="pix-tit-nome">Titular: ' + esc(pix.titular) + '</p>' : '') +
        (payload ? '<div class="pix-qr" data-payload="' + esc(payload) + '"></div><p class="pix-tit-nome">Pix copia e cola com o valor de ' + brl(valor) + '</p>' +
          '<div class="copiar"><code class="cc">' + esc(payload) + '</code><button type="button" class="btn btn-sm btn-pri" data-copiar="' + esc(payload) + '">' + ICON.copy + 'Copiar</button></div>' : '') +
        '</div>';
    }
    function infoHtml() {
      var H = C.horarios || [], hoje = new Date().getDay();
      var tabela = DIAS.map(function (d, i) {
        var h = H[i];
        return '<tr' + (i === hoje ? ' class="hoje"' : '') + '><td>' + d + (i === hoje ? ' <em>hoje</em>' : '') + '</td><td>' +
          (h ? h.abre + ' – ' + h.fecha : 'Fechado') + '</td></tr>';
      }).join('');
      var ent = [];
      if (pedidos.encomenda) ent.push(['Encomendas', pedidos.antecedenciaDias ? 'com ' + pedidos.antecedenciaDias + ' dia(s) de antecedência' : 'Sim']);
      ent.push(['Entrega', pedidos.entrega ? (entrega.taxa == null || entrega.taxa === '' ? 'Taxa a combinar' : entrega.taxa ? brl(entrega.taxa) : 'Grátis') : 'Não']);
      if (pedidos.entrega && entrega.gratisAcima) ent.push(['Frete grátis', 'acima de ' + brl(entrega.gratisAcima)]);
      if (pedidos.entrega && entrega.pedidoMinimo) ent.push(['Pedido mínimo', brl(entrega.pedidoMinimo)]);
      if (pedidos.entrega && entrega.tempo) ent.push(['Tempo médio', entrega.tempo]);
      if (pedidos.entrega && entrega.area) ent.push(['Área de entrega', entrega.area]);
      ent.push(['Retirada no local', pedidos.retirada ? 'Sim' : 'Não']);
      if (pedidos.mesa) ent.push(['Consumo no local', 'Sim, peça pela mesa']);
      return '<section id="info" class="info-grid">' +
        (C.mostrarHorario === false ? '' : '<div class="card"><h3>' + ICON.clock + 'Horário de atendimento</h3>' + statusHtml() + '<table>' + tabela + '</table></div>') +
        '<div class="card"><h3>' + ICON.moto + 'Encomenda, entrega e retirada</h3><dl>' + ent.map(function (e) {
          return '<div><dt>' + esc(e[0]) + '</dt><dd>' + esc(e[1]) + '</dd></div>';
        }).join('') + '</dl></div>' +
        '<div class="card card-pag"><h3>' + ICON.card + 'Formas de pagamento</h3><div class="pay-tags">' + formasPagamento().map(function (p) {
          return '<span>' + esc(p) + '</span>';
        }).join('') + '</div>' +
        ((pag.credito || pag.debito) && pag.obsCartao ? '<p class="obs-pag">' + esc(pag.obsCartao) + '</p>' : '') +
        (pag.linkCartao ? '<a class="btn btn-ghost btn-sm" href="' + esc(pag.linkCartao) + '" target="_blank" rel="noopener">' + ICON.card + 'Pagar com cartão (link)</a>' : '') +
        (pag.sinal ? '<p class="aviso">' + esc(pag.sinal) + '</p>' : '') +
        pixBoxHtml(0) +
        (pag.transferencia && (pag.contas || []).length ? '<h3>' + ICON.bank + 'Dados bancários</h3><div class="contas">' + contasHtml() + '</div>' : '') +
        '</div></section>';
    }
    function enderecoTxt() {
      return [end.rua, end.bairro, [end.cidade, end.uf].filter(Boolean).join(' - '), end.cep].filter(Boolean).join(', ');
    }
    function localHtml() {
      if (!end.rua && !end.cidade) return '';
      var q = encodeURIComponent(enderecoTxt());
      var link = end.linkMapa || 'https://www.google.com/maps/search/?api=1&query=' + q;
      return '<section id="local" class="local"><div class="local-txt"><h2>Onde estamos</h2><address>' + ICON.pin + esc(enderecoTxt()) + '</address>' +
        (end.referencia ? '<p class="ref">' + esc(end.referencia) + '</p>' : '') +
        (pedidos.retirada ? '<p class="ref">Retirada combinada pelo WhatsApp.</p>' : '') +
        '<a class="btn btn-pri" target="_blank" rel="noopener" href="' + esc(link) + '">Como chegar</a></div>' +
        '<iframe title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + q + '&z=15&output=embed"></iframe></section>';
    }
    function contatoHtml() {
      var lista = [];
      if (contato.whatsapp) lista.push(['<a href="' + wa(contato.whatsapp, 'Olá, ' + C.nome + '!') + '" target="_blank" rel="noopener">', ICON.whatsapp, 'WhatsApp', contato.telefone || '']);
      if (contato.telefone) lista.push(['<a href="tel:+' + soDigitos(contato.whatsapp) + '">', ICON.phone, 'Telefone', contato.telefone]);
      if (contato.email) lista.push(['<a href="mailto:' + esc(contato.email) + '">', ICON.mail, 'E-mail', contato.email]);
      var sociais = REDES.filter(function (r) { return redes[r[0]]; }).map(function (r) {
        return '<a class="social social-' + r[0] + '" href="' + esc(r[2](redes[r[0]])) + '" target="_blank" rel="noopener">' + ICON[r[0]] +
          '<span><b>' + r[1] + '</b><small>' + esc(r[3](redes[r[0]])) + '</small></span></a>';
      }).join('');
      return '<section id="contato" class="contato"><h2>Fale com a gente</h2><div class="contact-list">' + lista.map(function (l) {
        return l[0] + l[1] + '<span><b>' + l[2] + '</b><small>' + esc(l[3]) + '</small></span></a>';
      }).join('') + '</div>' + (sociais ? '<h3>Siga nas redes</h3><div class="socials">' + sociais + '</div>' : '') + '</section>';
    }
    function rodapeHtml() {
      return '<footer class="rodape">' + logoHtml('logo logo-sm') + '<p><b>' + esc(C.nome) + '</b></p>' +
        '<button class="btn btn-ghost btn-sm" data-acao="qr">' + ICON.qr + 'QR Code do catálogo</button>' +
        '<p class="creditos">© ' + new Date().getFullYear() + ' ' + esc(C.nome) + ' · Catálogo digital' +
        (credito.nome ? ' por <a href="' + wa(credito.whatsapp, 'Olá! Vi o catálogo digital da ' + C.nome + ' e quero um para o meu negócio.') + '" target="_blank" rel="noopener">' + esc(credito.nome) + '</a>' : '') +
        '</p></footer>';
    }
    function previaHtml() {
      return params.get('previa') ? '<div class="previa-bar">Pré-visualização do rascunho · <a href="admin/">voltar ao painel</a></div>' : '';
    }
    function mesaHtml() {
      return MESA ? '<div class="mesa-bar">Você está na <b>mesa ' + esc(MESA) + '</b> · seu pedido vai direto para o atendimento</div>' : '';
    }

    /* ---------- montagem ---------- */
    var app = document.getElementById('app');
    app.innerHTML = previaHtml() + mesaHtml() + heroHtml() + '<main>' + promoHtml() + menuHtml() + sobreHtml() + depoimentosHtml() + infoHtml() + localHtml() + contatoHtml() + '</main>' +
      rodapeHtml() +
      '<a class="fab-wa" href="' + wa(contato.whatsapp, 'Olá, ' + C.nome + '!') + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + ICON.whatsapp + '</a>' +
      '<button class="cart-bar" data-acao="carrinho" hidden><span class="cart-count">0</span><span>Ver pedido</span><b class="cart-total"></b></button>' +
      '<div class="overlay" hidden></div><div class="modal" role="dialog" aria-modal="true" hidden></div>' +
      '<aside class="drawer" role="dialog" aria-modal="true" aria-label="Seu pedido" hidden></aside><div class="toast" hidden></div>';
    desenharQRs(app);

    /* ---------- carrinho ---------- */
    var KEY = 'lorrany:carrinho';
    var carrinho = store.get(KEY) || [];
    var form = store.get(KEY + ':cliente') || {};
    function salvar() { store.set(KEY, carrinho); }
    function subtotal() { return carrinho.reduce(function (s, l) { return s + l.preco * l.qtd; }, 0); }
    function taxaNum() { return entrega.taxa == null || entrega.taxa === '' ? null : +entrega.taxa; }
    function taxaAtual() {
      var tx = taxaNum();
      if (form.tipo !== 'entrega' || !tx) return 0;
      if (entrega.gratisAcima && subtotal() >= entrega.gratisAcima) return 0;
      return tx;
    }
    function atualizarBarra() {
      var n = carrinho.reduce(function (s, l) { return s + l.qtd; }, 0);
      var bar = $('.cart-bar');
      bar.hidden = !n;
      document.body.classList.toggle('tem-carrinho', !!n);
      $('.cart-count', bar).textContent = n;
      $('.cart-total', bar).textContent = brl(subtotal());
    }
    function adicionar(it, detalhe, preco, extras, obs, qtd) {
      var chave = [it.id, detalhe, extras.join(','), obs].join('|');
      var linha = carrinho.filter(function (l) { return l.chave === chave; })[0];
      if (linha) linha.qtd += qtd;
      else carrinho.push({ chave: chave, nome: it.nome, opcao: detalhe, adicionais: extras, obs: obs, preco: preco, qtd: qtd });
      salvar(); atualizarBarra();
      toast(qtd + 'x ' + it.nome + ' adicionado');
    }

    function $(s, el) { return (el || document).querySelector(s); }
    function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
    var overlay = $('.overlay'), modal = $('.modal'), drawer = $('.drawer');
    var ultimoFoco = null;
    function abrir(el) {
      ultimoFoco = document.activeElement;
      overlay.hidden = false; el.hidden = false; document.body.classList.add('travado');
      requestAnimationFrame(function () { el.classList.add('aberto'); overlay.classList.add('aberto'); });
      var f = $('button, input, select, textarea', el); if (f) f.focus({ preventScroll: true });
    }
    function fechar() {
      [modal, drawer].forEach(function (el) { el.classList.remove('aberto'); el.hidden = true; });
      overlay.classList.remove('aberto'); overlay.hidden = true; document.body.classList.remove('travado');
      if (ultimoFoco) ultimoFoco.focus({ preventScroll: true });
    }
    var toastTimer;
    function toast(msg) {
      var el = $('.toast'); el.textContent = msg; el.hidden = false; el.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); el.hidden = true; }, 2200);
    }

    function abrirItem(it) {
      var modoKg = ehKg(it);
      var temOp = !modoKg && it.opcoes && it.opcoes.length;
      var fatias = kg.fatiasPorKg || 0;
      var sabores = it.sabores && it.sabores.lista || [], maxSab = Math.max(1, +(it.sabores && it.sabores.max) || 1);
      modal.innerHTML =
        '<button class="close" data-acao="fechar" aria-label="Fechar">' + ICON.x + '</button>' +
        (it.img ? '<div class="modal-img">' + imgTag(it.img, 900, it.nome) + '</div>' : '') +
        '<div class="modal-body">' + tagsHtml(it) + '<h3>' + esc(it.nome) + '</h3>' + (it.desc ? '<p class="desc">' + esc(it.desc) + '</p>' : '') +
        (it.rendimento ? '<p class="rend">' + esc(it.rendimento) + '</p>' : '') +
        (modoKg ? '<p class="preco-kg">' + brl(it.precoKg) + ' <small>o kg</small></p>' +
          (MASSAS.length ? '<fieldset><legend>Escolha a massa <em>obrigatório</em></legend>' + MASSAS.map(function (m, i) {
            return '<label class="opt"><input type="radio" name="massa" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(m.nome) + '</span><b>' +
              (m.acrescimo ? '+ ' + brl(m.acrescimo) + (m.porKg ? '/kg' : '') : '') + '</b></label>';
          }).join('') + '</fieldset>' : '') +
          '<fieldset><legend>Peso do bolo <em>obrigatório</em></legend><div class="pesos">' + PESOS.map(function (p, i) {
            return '<label class="peso"><input type="radio" name="peso" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + kgTxt(p) + '</b>' +
              (fatias ? '<small>~' + Math.round(p * fatias) + ' fatias</small>' : '') + '<small>' + brl(it.precoKg * p) + '</small></span></label>';
          }).join('') + '</div></fieldset>' +
          (COBERTURAS.length ? '<fieldset><legend>Cobertura <em>obrigatório</em></legend>' + COBERTURAS.map(function (c, i) {
            return '<label class="opt"><input type="radio" name="cobertura" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(c) + '</span></label>';
          }).join('') + '</fieldset>' : '') +
          (TOPO ? '<fieldset><legend>Extras <em>opcional</em></legend><label class="opt"><input type="checkbox" name="topo"><span>Topo de bolo personalizado</span><b>' +
            (kg.topo.preco ? '+ ' + brl(kg.topo.preco) : '') + '</b></label></fieldset>' : '') +
          (kg.pedirNome ? '<label class="obs"><span>Nome e idade para escrever no bolo <em class="opc">opcional</em></span><input name="escrita" maxlength="60" placeholder="Ex.: Ana · 5 anos"></label>' : '') : '') +
        (temOp ? '<fieldset><legend>' + esc(it.opcoesTitulo || 'Escolha uma opção') + ' <em>obrigatório</em></legend>' + it.opcoes.map(function (o, i) {
          return '<label class="opt"><input type="radio" name="op" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(o.nome) + '</span><b>' + brl(o.preco) + '</b></label>';
        }).join('') + '</fieldset>' : '') +
        (sabores.length ? '<fieldset class="sabores"><legend>' + (maxSab > 1 ? 'Escolha até ' + maxSab + ' sabores' : 'Escolha o sabor') + ' <em>obrigatório</em></legend>' + sabores.map(function (sb, i) {
          return '<label class="opt"><input type="checkbox" name="sabor" value="' + i + '"><span>' + esc(sb) + '</span></label>';
        }).join('') + '</fieldset>' : '') +
        (it.adicionais && it.adicionais.length ? '<fieldset><legend>Adicionais <em>opcional</em></legend>' + it.adicionais.map(function (a, i) {
          return '<label class="opt"><input type="checkbox" name="ad" value="' + i + '"><span>' + esc(a.nome) + '</span><b>+ ' + brl(a.preco) + '</b></label>';
        }).join('') + '</fieldset>' : '') +
        '<label class="obs"><span>' + (modoKg ? 'Tema, cores ou frase do bolo' : 'Alguma observação?') + '</span><textarea rows="2" maxlength="200" placeholder="' +
        (modoKg ? 'Ex.: tema Frozen, tons de rosa, escrever &quot;Feliz 5 anos, Ana&quot;' : 'Ex.: sem coco, embalar para presente...') + '"></textarea></label>' +
        '</div><div class="modal-foot"><div class="qty"><button data-q="-1" aria-label="Diminuir">' + ICON.minus + '</button><span>1</span><button data-q="1" aria-label="Aumentar">' + ICON.plus + '</button></div>' +
        '<button class="btn btn-pri btn-add">Adicionar <b></b></button></div>';
      var qtd = 1;
      function calc() {
        var ads = $$('input[name=ad]:checked', modal).map(function (c) { return it.adicionais[+c.value]; });
        var extra = ads.reduce(function (s, a) { return s + a.preco; }, 0);
        var unit, detalhe, extras = [];
        var marcados = $$('input[name=sabor]:checked', modal);
        $$('input[name=sabor]', modal).forEach(function (c) { c.disabled = !c.checked && marcados.length >= maxSab; });
        if (marcados.length) extras.push('Sabores: ' + marcados.map(function (c) { return sabores[+c.value]; }).join(', '));
        if (modoKg) {
          var peso = PESOS[+$('input[name=peso]:checked', modal).value];
          var mi = $('input[name=massa]:checked', modal), massa = mi ? MASSAS[+mi.value] : null;
          unit = it.precoKg * peso + acrescimoMassa(massa, peso);
          detalhe = kgTxt(peso) + (massa ? ' · ' + massa.nome : '');
          var cob = $('input[name=cobertura]:checked', modal);
          if (cob) extras.push('Cobertura: ' + COBERTURAS[+cob.value]);
          if ($('input[name=topo]:checked', modal)) { extras.push('Topo de bolo personalizado'); extra += +kg.topo.preco || 0; }
          var escrita = $('input[name=escrita]', modal);
          if (escrita && escrita.value.trim()) extras.push('Escrever: ' + escrita.value.trim());
        } else {
          var op = temOp ? it.opcoes[+$('input[name=op]:checked', modal).value] : null;
          unit = op ? op.preco : it.preco;
          detalhe = op ? op.nome : (it.unidade ? '1 ' + it.unidade : '');
        }
        unit += extra;
        $('.btn-add b', modal).textContent = brl(unit * qtd);
        return { unit: unit, detalhe: detalhe, ads: extras.concat(ads.map(function (a) { return a.nome; })), sabores: marcados.length };
      }
      modal.oninput = calc;
      modal.onclick = function (e) {
        var q = e.target.closest('[data-q]');
        if (q) { qtd = Math.max(1, qtd + +q.dataset.q); $('.qty span', modal).textContent = qtd; calc(); }
        if (e.target.closest('.btn-add')) {
          var r = calc();
          if (sabores.length && !r.sabores) { toast('Escolha ' + (maxSab > 1 ? 'pelo menos um sabor' : 'o sabor')); return; }
          adicionar(it, r.detalhe, r.unit, r.ads, $('textarea', modal).value.trim(), qtd); fechar();
        }
      };
      calc(); abrir(modal);
    }

    function tiposPedido() {
      var tipos = [];
      if (pedidos.entrega) tipos.push(['entrega', 'Entrega']);
      if (pedidos.retirada) tipos.push(['retirada', 'Retirar']);
      if (pedidos.mesa) tipos.push(['mesa', 'Na mesa']);
      if (!tipos.length) tipos.push(['retirada', 'A combinar']);
      return tipos;
    }
    function renderCarrinho() {
      var tipos = tiposPedido();
      if (MESA) form.tipo = 'mesa';
      if (!tipos.some(function (tp) { return tp[0] === form.tipo; })) form.tipo = tipos[0][0];
      var formas = formasPagamento();
      if (formas.indexOf(form.pagamento) < 0) form.pagamento = formas[0];
      var sub = subtotal(), taxa = taxaAtual(), total = sub + taxa;
      var aCombinar = form.tipo === 'entrega' && taxaNum() == null;
      var minimoFalta = form.tipo === 'entrega' && entrega.pedidoMinimo && sub < entrega.pedidoMinimo;
      drawer.innerHTML =
        '<div class="drawer-head"><h3>' + ICON.cart + 'Seu pedido</h3><button class="close" data-acao="fechar" aria-label="Fechar">' + ICON.x + '</button></div>' +
        '<div class="drawer-body">' +
        (carrinho.length ? '<ul class="linhas">' + carrinho.map(function (l, i) {
          return '<li><div><b>' + esc(l.nome) + '</b>' + (l.opcao ? '<small>' + esc(l.opcao) + '</small>' : '') +
            (l.adicionais.length ? '<small>+ ' + esc(l.adicionais.join(', ')) + '</small>' : '') +
            (l.obs ? '<small>Obs.: ' + esc(l.obs) + '</small>' : '') + '<span class="lp">' + brl(l.preco * l.qtd) + '</span></div>' +
            '<div class="qty"><button data-l="' + i + '" data-d="-1" aria-label="Diminuir">' + (l.qtd === 1 ? ICON.trash : ICON.minus) + '</button><span>' + l.qtd +
            '</span><button data-l="' + i + '" data-d="1" aria-label="Aumentar">' + ICON.plus + '</button></div></li>';
        }).join('') + '</ul>' : '<p class="vazio">Seu carrinho está vazio.</p>') +
        '<form class="checkout" novalidate>' +
        (tipos.length > 1 ? '<div class="seg">' + tipos.map(function (tp) {
          return '<label><input type="radio" name="tipo" value="' + tp[0] + '"' + (form.tipo === tp[0] ? ' checked' : '') + '><span>' + tp[1] + '</span></label>';
        }).join('') + '</div>' : '') +
        '<label><span>Seu nome</span><input name="nome" required autocomplete="name" value="' + esc(form.nome) + '"></label>' +
        (form.tipo === 'entrega' ? '<label><span>Endereço completo</span><input name="endereco" required autocomplete="street-address" placeholder="Rua, número, quadra, lote, bairro" value="' + esc(form.endereco) + '"></label>' +
          '<label><span>Ponto de referência</span><input name="referencia" value="' + esc(form.referencia) + '"></label>' : '') +
        (form.tipo === 'mesa' ? '<label><span>Número da mesa</span><input name="mesa" required inputmode="numeric" value="' + esc(MESA || form.mesa) + '"></label>' : '') +
        encomendaHtml() +
        '<label><span>Forma de pagamento</span><select name="pagamento">' + formas.map(function (p) {
          return '<option' + (form.pagamento === p ? ' selected' : '') + '>' + esc(p) + '</option>';
        }).join('') + '</select></label>' +
        pagamentoDetalhe(total, aCombinar) +
        (/dinheiro/i.test(form.pagamento || '') ? '<label><span>Troco para quanto?</span><input name="troco" inputmode="decimal" placeholder="Ex.: 100" value="' + esc(form.troco) + '"></label>' : '') +
        '<label><span>Observações do pedido</span><textarea name="obs" rows="2">' + esc(form.obs) + '</textarea></label>' +
        '</form></div>' +
        '<div class="drawer-foot"><dl><div><dt>Subtotal</dt><dd>' + brl(sub) + '</dd></div>' +
        (form.tipo === 'entrega' ? '<div><dt>Entrega</dt><dd>' + (aCombinar ? 'A combinar' : taxa ? brl(taxa) : 'Grátis') + '</dd></div>' : '') +
        '<div class="total"><dt>Total</dt><dd>' + brl(total) + (aCombinar ? ' <small>+ entrega</small>' : '') + '</dd></div></dl>' +
        (minimoFalta ? '<p class="aviso">Pedido mínimo para entrega: ' + brl(entrega.pedidoMinimo) + '</p>' : '') +
        '<button class="btn btn-pri btn-enviar"' + (!carrinho.length || minimoFalta ? ' disabled' : '') + '>' + ICON.whatsapp + 'Enviar pedido pelo WhatsApp</button></div>';
      desenharQRs(drawer);
    }
    function pagamentoDetalhe(total, aCombinar) {
      var p = form.pagamento || '';
      if (p === 'Pix') return (aCombinar ? '<p class="aviso">O valor da entrega será somado depois, pelo WhatsApp.</p>' : '') + pixBoxHtml(aCombinar ? 0 : total);
      if (/cart/i.test(p)) return (pag.obsCartao ? '<p class="aviso">' + esc(pag.obsCartao) + '</p>' : '') +
        (pag.linkCartao ? '<a class="btn btn-ghost btn-sm" href="' + esc(pag.linkCartao) + '" target="_blank" rel="noopener">' + ICON.card + 'Pagar com cartão (link)</a>' : '');
      if (/transfer/i.test(p)) return '<div class="contas">' + contasHtml() + '</div>';
      return '';
    }
    function dataMinima() {
      var d = new Date(); d.setDate(d.getDate() + (+pedidos.antecedenciaDias || 0));
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    var SEM = pedidos.diasSemEncomenda || [];
    var PLURAL = ['aos domingos', 'às segundas-feiras', 'às terças-feiras', 'às quartas-feiras', 'às quintas-feiras', 'às sextas-feiras', 'aos sábados'];
    function bloqueadas() { var m = dataMinima(); return (pedidos.datasBloqueadas || []).filter(function (d) { return d >= m; }); }
    function dataIndisponivel(iso) {
      if (!iso) return '';
      if (iso < dataMinima()) return 'Escolha uma data a partir de ' + dataBR(dataMinima()) + '.';
      if (bloqueadas().indexOf(iso) > -1) return 'A agenda de ' + dataBR(iso) + ' já está completa. Escolha outra data.';
      var p = iso.split('-'), dia = new Date(+p[0], +p[1] - 1, +p[2]).getDay();
      if (SEM.indexOf(dia) > -1) return 'Não fazemos encomendas ' + PLURAL[dia] + '. Escolha outra data.';
      return '';
    }
    /* ---------- calendário de encomendas (o cliente toca na data, não digita) ---------- */
    var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    var DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    var LIMITE_DIAS = 120;
    var calMes = null; // primeiro dia do mês mostrado
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function dataMaxima() { var d = new Date(); d.setDate(d.getDate() + LIMITE_DIAS); return iso(d); }
    function horarioDoDia(s) {
      var H = C.horarios || [];
      if (!H.some(Boolean)) return { abre: '08:00', fecha: '18:00' };
      return H[deIso(s).getDay()] || null;
    }
    function dataLivre(s) { return s <= dataMaxima() && !dataIndisponivel(s) && !!horarioDoDia(s); }
    function sugestoes(n) {
      var r = [], d = deIso(dataMinima());
      for (var i = 0; i < LIMITE_DIAS && r.length < n; i++, d.setDate(d.getDate() + 1)) if (dataLivre(iso(d))) r.push(iso(d));
      return r;
    }
    function horariosDoDia(s) {
      var h = horarioDoDia(s); if (!h) return [];
      var a = toMin(h.abre), f = toMin(h.fecha), r = [];
      if (f <= a) f = 24 * 60;
      for (var m = a; m <= f - 30; m += 30) r.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
      return r;
    }
    function rotuloCurto(s) { var d = deIso(s); return DIAS_CURTOS[d.getDay()] + ', ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
    function calendarioHtml() {
      if (!calMes) { var base = deIso(form.data && dataLivre(form.data) ? form.data : (sugestoes(1)[0] || dataMinima())); calMes = new Date(base.getFullYear(), base.getMonth(), 1); }
      var ano = calMes.getFullYear(), mes = calMes.getMonth(), inicio = calMes.getDay(), total = new Date(ano, mes + 1, 0).getDate();
      var hoje = iso(new Date());
      var temAnterior = iso(new Date(ano, mes, 0)) >= dataMinima(), temProximo = iso(new Date(ano, mes + 1, 1)) <= dataMaxima();
      var cel = '';
      for (var v = 0; v < inicio; v++) cel += '<span></span>';
      for (var dia = 1; dia <= total; dia++) {
        var s = iso(new Date(ano, mes, dia)), livre = dataLivre(s);
        cel += '<button type="button" class="dia' + (s === form.data ? ' sel' : '') + (s === hoje ? ' hoje' : '') + '"' +
          (livre ? ' data-dia="' + s + '"' : ' disabled') + ' aria-label="' + dia + ' de ' + MESES[mes] + (livre ? '' : ', indisponível') + '">' + dia + '</button>';
      }
      return '<div class="cal"><div class="cal-topo"><button type="button" data-mes="-1" aria-label="Mês anterior"' + (temAnterior ? '' : ' disabled') + '>‹</button>' +
        '<b>' + MESES[mes] + ' ' + ano + '</b><button type="button" data-mes="1" aria-label="Próximo mês"' + (temProximo ? '' : ' disabled') + '>›</button></div>' +
        '<div class="cal-sem">' + DIAS_CURTOS.map(function (d) { return '<span>' + d.charAt(0) + '</span>'; }).join('') + '</div>' +
        '<div class="cal-dias">' + cel + '</div></div>';
    }
    function encomendaHtml() {
      if (!pedidos.encomenda || form.tipo === 'mesa') return '';
      var quando = form.tipo === 'entrega' ? 'entrega' : 'retirada';
      if (form.data && !dataLivre(form.data)) form.data = '';
      var horas = form.data ? horariosDoDia(form.data) : [];
      if (horas.indexOf(form.hora) < 0) form.hora = '';
      return (pedidos.avisoEncomenda ? '<p class="aviso">' + esc(pedidos.avisoEncomenda) + '</p>' : '') +
        '<div class="agenda"><span class="ag-tit">Data da ' + quando + '</span>' +
        '<div class="ag-sug">' + sugestoes(4).map(function (s) {
          return '<button type="button" class="chip-data' + (s === form.data ? ' sel' : '') + '" data-dia="' + s + '">' + rotuloCurto(s) + '</button>';
        }).join('') + '</div>' + calendarioHtml() +
        '<input type="hidden" name="data" required value="' + esc(form.data) + '">' +
        (form.data ? '<p class="ag-escolhida">' + ICON.cal + 'Escolhida: <b>' + esc(rotuloCurto(form.data)) + '/' + form.data.slice(0, 4) + '</b></p>' : '') + '</div>' +
        '<label><span>Horário da ' + quando + '</span><select name="hora" required' + (form.data ? '' : ' disabled') + '>' +
        '<option value="">' + (form.data ? 'Escolha o horário' : 'Escolha a data primeiro') + '</option>' + horas.map(function (h) {
          return '<option' + (h === form.hora ? ' selected' : '') + '>' + h + '</option>';
        }).join('') + '</select></label>';
    }
    // redesenha o pedido sem perder a posição da rolagem
    function redesenhar() {
      var corpo = $('.drawer-body', drawer), y = corpo ? corpo.scrollTop : 0;
      renderCarrinho();
      corpo = $('.drawer-body', drawer); if (corpo) corpo.scrollTop = y;
    }
    function dataBR(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
    function lerForm() {
      var f = $('.checkout', drawer); if (!f) return;
      $$('input, select, textarea', f).forEach(function (el) {
        if (el.type === 'radio') { if (el.checked) form[el.name] = el.value; } else form[el.name] = el.value;
      });
      store.set(KEY + ':cliente', { nome: form.nome, endereco: form.endereco, referencia: form.referencia, pagamento: form.pagamento, tipo: form.tipo });
    }
    drawer.addEventListener('change', function (e) {
      if (e.target.name === 'tipo' || e.target.name === 'pagamento') {
        lerForm(); redesenhar();
        var alvo = $('[name="' + e.target.name + '"]' + (e.target.type === 'radio' ? ':checked' : ''), drawer); if (alvo) alvo.focus();
      }
    });
    drawer.addEventListener('input', lerForm);
    drawer.addEventListener('click', function (e) {
      var dia = e.target.closest('[data-dia]');
      if (dia) {
        lerForm(); form.data = dia.dataset.dia;
        var d = deIso(form.data); calMes = new Date(d.getFullYear(), d.getMonth(), 1);
        redesenhar();
        var hora = $('[name=hora]', drawer); if (hora) hora.focus({ preventScroll: true });
        return;
      }
      var mes = e.target.closest('[data-mes]');
      if (mes) { lerForm(); calMes = new Date(calMes.getFullYear(), calMes.getMonth() + +mes.dataset.mes, 1); redesenhar(); return; }
      var b = e.target.closest('[data-l]');
      if (b) {
        lerForm();
        var l = carrinho[+b.dataset.l]; l.qtd += +b.dataset.d;
        if (l.qtd <= 0) carrinho.splice(+b.dataset.l, 1);
        salvar(); atualizarBarra(); renderCarrinho(); return;
      }
      if (e.target.closest('.btn-enviar')) { lerForm(); enviar(); }
    });
    function enviar() {
      var faltando = $$('[required]', drawer).filter(function (el) { return !el.value.trim(); });
      if (faltando.length) {
        var el = faltando[0];
        if (el.name === 'data') { var ag = $('.agenda', drawer); ag.classList.add('erro'); ag.scrollIntoView({ block: 'center', behavior: 'smooth' }); toast('Escolha a data no calendário'); return; }
        el.focus(); el.classList.add('erro'); toast(el.name === 'hora' ? 'Escolha o horário' : 'Preencha os campos obrigatórios'); return;
      }
      var campoData = $('[name=data]', drawer), msgData = campoData && dataIndisponivel(campoData.value);
      if (msgData) { toast(msgData); return; }
      var L = [];
      L.push('*Novo pedido — ' + C.nome + '*', '');
      carrinho.forEach(function (l) {
        L.push(l.qtd + 'x ' + l.nome + (l.opcao ? ' (' + l.opcao + ')' : '') + ' — ' + brl(l.preco * l.qtd));
        if (l.adicionais.length) L.push('   + ' + l.adicionais.join(', '));
        if (l.obs) L.push('   Obs.: ' + l.obs);
      });
      var sub = subtotal(), taxa = taxaAtual(), aCombinar = form.tipo === 'entrega' && taxaNum() == null;
      L.push('', 'Subtotal: ' + brl(sub));
      if (form.tipo === 'entrega') L.push('Entrega: ' + (aCombinar ? 'a combinar' : taxa ? brl(taxa) : 'Grátis'));
      L.push('*Total: ' + brl(sub + taxa) + (aCombinar ? ' + entrega' : '') + '*', '');
      L.push('*Cliente:* ' + form.nome);
      L.push('*Tipo:* ' + ({ entrega: 'Entrega', retirada: 'Retirada no local', mesa: 'Consumo na mesa' })[form.tipo]);
      if (form.tipo === 'entrega') { L.push('*Endereço:* ' + form.endereco); if (form.referencia) L.push('*Referência:* ' + form.referencia); }
      if (form.tipo === 'mesa') L.push('*Mesa:* ' + (form.mesa || MESA));
      if (pedidos.encomenda && form.tipo !== 'mesa' && form.data) L.push('*Encomenda para:* ' + dataBR(form.data) + (form.hora ? ' às ' + form.hora : ''));
      L.push('*Pagamento:* ' + form.pagamento + (/dinheiro/i.test(form.pagamento) && form.troco ? ' (troco para R$ ' + form.troco + ')' : ''));
      if (form.obs) L.push('*Obs.:* ' + form.obs);
      if (form.pagamento === 'Pix') L.push('', '_Vou enviar o comprovante do Pix por aqui._');
      window.open(wa(contato.whatsapp, L.join('\n')), '_blank', 'noopener');
      carrinho = []; salvar(); atualizarBarra(); fechar();
      toast('Pedido enviado! Finalize a conversa no WhatsApp.');
    }

    /* ---------- Pix copia e cola (BR Code estático) ---------- */
    function campo(id, v) { return id + String(v.length).padStart(2, '0') + v; }
    function crc16(s) {
      var c = 0xFFFF;
      for (var i = 0; i < s.length; i++) {
        c ^= s.charCodeAt(i) << 8;
        for (var j = 0; j < 8; j++) c = c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1;
        c &= 0xFFFF;
      }
      return c.toString(16).toUpperCase().padStart(4, '0');
    }
    function limpo(s, n) { return semAcento(s).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, n) || 'NA'; }
    function brcode(valor) {
      var p = campo('00', '01') + campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', pixChave())) +
        campo('52', '0000') + campo('53', '986') + (valor ? campo('54', valor.toFixed(2)) : '') + campo('58', 'BR') +
        campo('59', limpo(pix.titular || C.nome, 25)) + campo('60', limpo(pix.cidade || end.cidade || 'BRASIL', 15)) +
        campo('62', campo('05', '***')) + '6304';
      return p + crc16(p);
    }
    function desenharQRs(raiz) {
      $$('.pix-qr', raiz).forEach(function (el) {
        if (window.QRCode) new window.QRCode(el, { text: el.dataset.payload, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M });
      });
    }

    /* ---------- QR Code e compartilhar ---------- */
    function abrirQR() {
      var url = urlLimpa();
      modal.innerHTML = '<button class="close" data-acao="fechar" aria-label="Fechar">' + ICON.x + '</button>' +
        '<div class="modal-body qr-body"><h3>Aponte a câmera do celular</h3><p class="desc">Escaneie para abrir o catálogo da <b>' + esc(C.nome) + '</b>.</p>' +
        '<div class="qr-code"></div><p class="qr-url">' + esc(url) + '</p>' +
        '<div class="qr-actions"><button class="btn btn-pri" data-acao="baixar-qr">Baixar QR Code</button></div></div>';
      if (window.QRCode) {
        new window.QRCode($('.qr-code', modal), { text: url, width: 240, height: 240, colorDark: '#111111', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      } else {
        $('.qr-code', modal).innerHTML = '<img alt="QR Code" width="240" height="240" src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(url) + '">';
      }
      abrir(modal);
    }
    function baixarQR() {
      var c = $('.qr-code canvas', modal), im = $('.qr-code img', modal);
      var a = document.createElement('a');
      a.download = 'qrcode-docuras-da-lorrany.png';
      a.href = c ? c.toDataURL('image/png') : im.src;
      a.click();
    }
    function compartilhar() {
      var dados = { title: C.nome, text: C.nome + ' — ' + (C.slogan || ''), url: urlLimpa() };
      if (navigator.share) { navigator.share(dados).catch(function () {}); return; }
      copiar(dados.url, 'Link copiado!');
    }
    function copiar(txt, msg) {
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast(msg || 'Copiado!'); });
    }

    /* ---------- eventos gerais ---------- */
    document.addEventListener('click', function (e) {
      var cp = e.target.closest('[data-copiar]');
      if (cp) { e.preventDefault(); copiar(cp.dataset.copiar, 'Copiado! Cole no app do seu banco.'); return; }
      var add = e.target.closest('[data-add]');
      if (add) {
        var it = ITENS[add.dataset.add];
        if (ehKg(it) || (it.opcoes && it.opcoes.length > 1) || (it.adicionais && it.adicionais.length) || (it.sabores && it.sabores.lista && it.sabores.lista.length)) abrirItem(it);
        else adicionar(it, it.unidade ? '1 ' + it.unidade : '', it.opcoes && it.opcoes[0] ? it.opcoes[0].preco : it.preco, [], '', 1);
        return;
      }
      var card = e.target.closest('[data-item]');
      if (card && !e.target.closest('a') && !card.classList.contains('esgotado')) { abrirItem(ITENS[card.dataset.item]); return; }
      var ac = e.target.closest('[data-acao]');
      if (!ac) return;
      var acao = ac.dataset.acao;
      if (acao === 'fechar') fechar();
      else if (acao === 'carrinho') { renderCarrinho(); abrir(drawer); }
      else if (acao === 'qr') abrirQR();
      else if (acao === 'baixar-qr') baixarQR();
      else if (acao === 'share') compartilhar();
      else if (acao === 'cats') abrirCats();
    });
    overlay.addEventListener('click', fechar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !overlay.hidden) fechar();
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-item]')) { e.preventDefault(); abrirItem(ITENS[e.target.dataset.item]); }
    });
    $$('[data-item]').forEach(function (el) { el.tabIndex = 0; el.setAttribute('role', 'button'); });

    /* ---------- busca ---------- */
    var busca = $('.menu .search input');
    busca.addEventListener('input', function () {
      var q = semAcento(busca.value.trim().toLowerCase()), algum = false;
      $$('.cat').forEach(function (cat) {
        var vis = 0;
        $$('[data-item]', cat).forEach(function (el) { var ok = !q || el.dataset.busca.indexOf(q) > -1; el.hidden = !ok; if (ok) vis++; });
        cat.hidden = !vis; if (vis) algum = true;
      });
      $('.no-results').hidden = algum;
    });

    /* ---------- categoria ativa ---------- */
    var links = $$('.cat-grid a'), catBar = $('.cat-bar'), grade = $('.cat-grid'), menu = $('#cardapio');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle('ativo', a.getAttribute('href') === '#' + en.target.id); });
          var c = CATS[+en.target.id.replace('cat-', '')];
          if (c) $('.cat-atual', catBar).textContent = (c.icone ? c.icone + ' ' : '') + c.nome;
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      $$('.cat').forEach(function (c) { io.observe(c); });
    }
    // a barra fixa aparece quando a grade de categorias sai da tela e some depois do catálogo
    var barraPendente = false;
    function posicaoBarra() {
      barraPendente = false;
      var mostrar = grade.getBoundingClientRect().bottom < 0 && menu.getBoundingClientRect().bottom > 120;
      catBar.hidden = !mostrar;
    }
    window.addEventListener('scroll', function () { if (!barraPendente) { barraPendente = true; requestAnimationFrame(posicaoBarra); } }, { passive: true });
    function abrirCats() {
      modal.innerHTML = '<button class="close" data-acao="fechar" aria-label="Fechar">' + ICON.x + '</button>' +
        '<div class="modal-body"><h3>Categorias</h3><nav class="cat-grid cat-grid-modal">' + catCards(true) + '</nav></div>';
      abrir(modal);
    }

    atualizarBarra();
    document.title = C.nome + ' · Catálogo de bolos e doces';
    if (location.hash) { var alvo = document.getElementById(location.hash.slice(1)); if (alvo) alvo.scrollIntoView(); }
  }
})();
