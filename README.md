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
encomenda com antecedência, agenda com dias e datas bloqueados), taxa de entrega, Pix, cartão, dinheiro,
contas bancárias, sabores, personalização do bolo (cobertura, topo, nome no bolo) e depoimentos.

O rascunho fica salvo no aparelho. **Publicar** grava o `dados.json` e as fotos novas direto no repositório
(um commit), e o GitHub Pages atualiza o site em 1 a 2 minutos. O painel pode ser instalado como aplicativo
no celular (aba **Minha conta**).

### Acesso: usuário e senha

- **Primeiro acesso:** usuário `Admin`, senha `Admin`. O painel obriga a criar uma senha nova (mínimo 8
  caracteres), pede o e-mail de recuperação e o token do GitHub (abaixo). Depois disso `Admin / Admin` deixa de
  funcionar.
- O token fica em `admin/acesso.json`, **criptografado** (AES-GCM, chave derivada com PBKDF2 de 310 mil
  iterações). Só abre com a senha ou com o código de recuperação, então ela entra de qualquer aparelho só com
  usuário e senha.
- **Recuperar a senha:** ao criar a senha, o painel gera um código de recuperação e abre o e-mail dela com o código
  pronto para ela enviar para si mesma. Se esquecer a senha: **Esqueci minha senha** → digita o código do e-mail →
  cria senha nova (e recebe um código novo). Como o site não tem servidor, o e-mail é enviado nesse momento, não
  na hora do esquecimento.
- **Perdeu senha e código?** Apague `admin/acesso.json` no GitHub: o painel volta ao primeiro acesso
  (`Admin / Admin`) e é preciso colar o token de novo.
- Em **Minha conta** ela troca usuário, e-mail, senha, gera um novo código ou troca o token. O painel avisa 15
  dias antes de o token vencer.

### Criar o token do GitHub

1. Em <https://github.com/settings/personal-access-tokens/new> crie um **fine-grained token**:
   - *Repository access:* **Only select repositories** → `Tanattos18/Catalago_Lorrany`
   - *Permissions → Repository → Contents:* **Read and write**
   - *Expiration:* o maior prazo permitido (anote a data para renovar)
2. Cole no primeiro acesso do painel (ou em **Minha conta → Trocar token**).

O token só tem acesso a este repositório. Se precisar, revogue-o no GitHub e cadastre outro.

### Domínio próprio (opcional)

Registre o domínio (ex.: no registro.br), crie um registro `CNAME` apontando `www` para `tanattos18.github.io`
e informe o domínio em *Settings → Pages → Custom domain*. Depois troque as URLs de `og:url`, `og:image` e
`canonical` no `index.html`.

## Rodar localmente

```bash
python -m http.server 5531
```

Abra `http://localhost:5531/` (o `dados.json` é carregado via `fetch`, então não funciona abrindo o arquivo direto).
