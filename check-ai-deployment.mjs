/**
 * Script de diagnóstico para verificar se o código de auto-reply da IA está deployado
 * 
 * Uso: node check-ai-deployment.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando deployment do código de auto-reply da IA...\n');

const checks = [];

// 1. Verificar se os arquivos existem
const filesToCheck = [
  'apps/api/src/services/ai-auto-reply-service.ts',
  'apps/api/src/services/ai/generate-reply.ts',
  'apps/api/src/features/whatsapp-inbound/services/inbound-lead/pipeline.ts',
];

console.log('📁 Verificando arquivos...');
filesToCheck.forEach(file => {
  const fullPath = path.join(__dirname, file);
  const exists = fs.existsSync(fullPath);
  checks.push({ check: `Arquivo ${file}`, status: exists });
  console.log(`  ${exists ? '✅' : '❌'} ${file}`);
});

// 2. Verificar se o import está no pipeline
console.log('\n📦 Verificando imports no pipeline...');
const pipelinePath = path.join(__dirname, 'apps/api/src/features/whatsapp-inbound/services/inbound-lead/pipeline.ts');
if (fs.existsSync(pipelinePath)) {
  const pipelineContent = fs.readFileSync(pipelinePath, 'utf8');
  
  const hasImport = pipelineContent.includes('processAiAutoReply');
  checks.push({ check: 'Import processAiAutoReply no pipeline', status: hasImport });
  console.log(`  ${hasImport ? '✅' : '❌'} Import de processAiAutoReply`);
  
  const hasCall = pipelineContent.includes('processAiAutoReply({');
  checks.push({ check: 'Chamada processAiAutoReply no pipeline', status: hasCall });
  console.log(`  ${hasCall ? '✅' : '❌'} Chamada de processAiAutoReply`);
  
  // Verificar se está dentro do bloco correto
  const hasInboundCheck = pipelineContent.includes("if (direction === 'INBOUND' && persistedMessage.content)");
  checks.push({ check: 'Verificação de direção INBOUND', status: hasInboundCheck });
  console.log(`  ${hasInboundCheck ? '✅' : '❌'} Verificação de direção INBOUND`);
} else {
  console.log('  ❌ Arquivo pipeline.ts não encontrado');
  checks.push({ check: 'Arquivo pipeline.ts', status: false });
}

// 3. Verificar se o serviço de auto-reply está correto
console.log('\n🤖 Verificando serviço de auto-reply...');
const autoReplyPath = path.join(__dirname, 'apps/api/src/services/ai-auto-reply-service.ts');
if (fs.existsSync(autoReplyPath)) {
  const autoReplyContent = fs.readFileSync(autoReplyPath, 'utf8');
  
  const hasGenerateImport = autoReplyContent.includes('generateAiReply');
  checks.push({ check: 'Import generateAiReply', status: hasGenerateImport });
  console.log(`  ${hasGenerateImport ? '✅' : '❌'} Import de generateAiReply`);
  
  const hasGetAiConfig = autoReplyContent.includes('getAiConfig');
  checks.push({ check: 'Import getAiConfig', status: hasGetAiConfig });
  console.log(`  ${hasGetAiConfig ? '✅' : '❌'} Import de getAiConfig`);
  
  const hasModeCheck = autoReplyContent.includes("aiMode !== 'IA_AUTO'");
  checks.push({ check: 'Verificação de modo IA_AUTO', status: hasModeCheck });
  console.log(`  ${hasModeCheck ? '✅' : '❌'} Verificação de modo IA_AUTO`);
  
  const hasSendMessage = autoReplyContent.includes('sendMessage');
  checks.push({ check: 'Chamada sendMessage', status: hasSendMessage });
  console.log(`  ${hasSendMessage ? '✅' : '❌'} Chamada de sendMessage`);
} else {
  console.log('  ❌ Arquivo ai-auto-reply-service.ts não encontrado');
  checks.push({ check: 'Arquivo ai-auto-reply-service.ts', status: false });
}

// 4. Verificar se generate-reply existe
console.log('\n⚡ Verificando função generate-reply...');
const generateReplyPath = path.join(__dirname, 'apps/api/src/services/ai/generate-reply.ts');
if (fs.existsSync(generateReplyPath)) {
  const generateReplyContent = fs.readFileSync(generateReplyPath, 'utf8');
  
  const hasExport = generateReplyContent.includes('export async function generateAiReply');
  checks.push({ check: 'Export generateAiReply', status: hasExport });
  console.log(`  ${hasExport ? '✅' : '❌'} Export de generateAiReply`);
  
  const hasOpenAI = generateReplyContent.includes('RESPONSES_API_URL');
  checks.push({ check: 'Configuração OpenAI', status: hasOpenAI });
  console.log(`  ${hasOpenAI ? '✅' : '❌'} Configuração da API OpenAI`);
} else {
  console.log('  ❌ Arquivo generate-reply.ts não encontrado');
  checks.push({ check: 'Arquivo generate-reply.ts', status: false });
}

// Resumo
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DO DIAGNÓSTICO\n');

const passed = checks.filter(c => c.status).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`✅ Checks passados: ${passed}/${total} (${percentage}%)\n`);

if (percentage === 100) {
  console.log('🎉 Todos os checks passaram! O código está correto no repositório.');
  console.log('\n⚠️  Se a IA ainda não está respondendo, o problema pode ser:');
  console.log('   1. Código não foi compilado/deployado no Railway');
  console.log('   2. OPENAI_API_KEY não está configurada');
  console.log('   3. Modo de IA não está em "IA_AUTO" no banco de dados');
  console.log('   4. Erro silencioso na execução (verificar logs do Railway)');
} else {
  console.log('❌ Alguns checks falharam. Verifique os itens marcados acima.');
}

console.log('\n' + '='.repeat(60));
console.log('\n📝 Próximos passos:');
console.log('   1. Verifique os logs do Railway para erros');
console.log('   2. Confirme que OPENAI_API_KEY está configurada');
console.log('   3. Verifique se o modo está em IA_AUTO no banco:');
console.log('      SELECT * FROM "AiConfig" WHERE "tenantId" = \'demo-tenant\';');
console.log('   4. Teste enviando uma mensagem via WhatsApp\n');
