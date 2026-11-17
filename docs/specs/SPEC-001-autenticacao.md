# SPEC-001 — Autenticação e contas

**Status:** implementado · **Código:** `js/core/auth.js`, `js/screens/loginScreen.js` · **ADRs:** 003, 004

## Requisitos (EARS)
- **R1** O sistema deve exibir login e registro na mesma tela, alternados por abas.
- **R2** Quando o jogador se registrar, o sistema deve validar usuário (`^[a-zA-Z0-9_.-]{3,20}$`, único sem diferenciar maiúsculas) e senha (≥ 6) e confirmar a senha.
- **R3** O sistema deve guardar só `salt` + hash PBKDF2-SHA256 (120k iterações), nunca a senha.
- **R4** Quando o login falhar, o sistema deve mostrar mensagem genérica ("Usuário ou senha inválidos").
- **R5** Enquanto houver sessão salva, o sistema deve abrir direto no Menu.
- **R6** A tela de login deve ter, no rodapé, o link discreto "Painel Admin".
- **R7** No primeiro acesso ao admin, o sistema deve pedir a criação da senha de admin (≥ 8); depois, só pedir a senha.
- **R8** A sessão de admin deve durar só enquanto a aba existir (`sessionStorage`).

## Modelo de conta (`etd.v1.accounts[username_lower]`)
```json
{
  "username": "Igor", "salt": "b64", "hash": "b64", "createdAt": "ISO",
  "progress": {
    "unlocked": ["nanuk", "aput"],
    "eskimos": { "nanuk": { "xp": 130, "skills": ["nanuk_b1t1"], "equip": { "arma": null, "armadura": "it_x", "amuleto": null } } },
    "inventory": [{ "uid": "it_x", "itemId": "luva_gelo", "foundAt": "ISO" }],
    "phases": { "fase1": { "completed": true, "bestRound": 8 } },
    "stats": { "wins": 1, "losses": 0, "roundsTotal": 8 }
  }
}
```

## Critérios de aceite
- Registrar → cai no Menu já logado. Recarregar a página mantém a sessão.
- Usuário duplicado (mesmo com outra caixa) é rejeitado.
- `localStorage` não contém a senha em texto.
