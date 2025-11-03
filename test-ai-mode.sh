#!/bin/bash

# Script para testar as correções do modo de IA

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Usar Node 20.19.5
nvm use 20.19.5

# Executar apenas os testes relacionados ao modo de IA
cd /home/ubuntu/leadengine-corban
pnpm --filter @ticketz/api test -- ai.spec.ts
