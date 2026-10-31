# Doçuras da Lorrany · Catálogo digital

Catálogo de bolos confeitados (por kg), bolos caseiros e docinhos, com pedido pelo WhatsApp,
encomenda com data/horário e Pix copia e cola. Site estático publicado no GitHub Pages.

- **Site:** `https://tanattos18.github.io/Catalago_Lorrany/`
- **Painel da cliente:** `https://tanattos18.github.io/Catalago_Lorrany/admin/`

## Estrutura

| Arquivo | O que é |
|---|---|
| `index.html` | Página do catálogo |
| `dados.json` | **Todos os dados da loja** (editado pelo painel) |
| `assets/js/cardapio.js` | Motor que monta a página a partir do `dados.json` |
| `assets/css/base.css`, `confeitaria.css` | Estilos (base do modelo Hamburgueria 1 + tema rosa) |
| `admin/` | Painel administrativo |
| `img/produtos/` | Fotos enviadas pelo painel |

As fotos iniciais são do [Unsplash](https://unsplash.com/license) (uso comercial gratuito). A cliente pode trocar
cada uma pela foto real do produto no painel.

## Painel admin

No painel a cliente ajusta logo, capa, cores, catálogo (categorias, produtos, fotos, preços por unidade/cento/kg,
massas e pesos, esgotado/oculto), contato, endereço e mapa, horários, formas de pedido (entrega, retirada, mesa,
encomenda com antecedência), taxa de entrega, Pix, cartão, dinheiro e contas bancárias.

O rascunho fica salvo no aparelho. **Publicar** grava o `dados.json` e as fotos novas direto no repositório
(um commit), e o GitHub Pages atualiza o site em 1 a 2 minutos.

### Conectar o painel (uma vez por aparelho)

1. Em <https://github.com/settings/personal-access-tokens/new> crie um **fine-grained token**:
   - *Repository access:* **Only select repositories** → `Tanattos18/Catalago_Lorrany`
   - *Permissions → Repository → Contents:* **Read and write**
   - *Expiration:* o maior prazo permitido (anote a data para renovar)
2. Abra `/admin/` no celular da cliente → aba **Publicar** → cole o token → **Conectar**.

O token só tem acesso a este repositório. Se o aparelho for perdido, revogue o token no GitHub.

## Rodar localmente

```bash
python -m http.server 5531
```

Abra `http://localhost:5531/` (o `dados.json` é carregado via `fetch`, então não funciona abrindo o arquivo direto).
