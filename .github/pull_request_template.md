## O que muda

<!-- Uma ou duas frases. O título do PR (Conventional Commits) vira o commit na main. -->

## Por quê

<!-- Problema ou objetivo. Link da issue, se houver. -->

Closes #

## Como testar

1.
2.

## Migrations

- [ ] Este PR não tem migration
- [ ] Migration aditiva (nova tabela, coluna nullable ou com default, índice)
- [ ] Migration destrutiva ou rename — plano expand/contract descrito abaixo

<!-- Se marcou a última: quais releases, em que ordem, e como o código anterior continua funcionando com o schema novo. -->

## Checklist

- [ ] Testes cobrem a mudança (unit e/ou e2e)
- [ ] Nenhum segredo, credencial ou `.env` no diff
- [ ] Variáveis de ambiente novas documentadas e adicionadas na VPS antes do merge
- [ ] Mudanças em `deploy/` serão sincronizadas na VPS antes do merge

## Prints

<!-- Obrigatório se mexer na interface. Antes/depois quando fizer sentido. -->
