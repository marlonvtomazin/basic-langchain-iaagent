//App.js com funcao de data e hora - Aprendizado de como criar ferramenta personalizada

import { config } from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { TavilySearch } from "@langchain/tavily";
import { StateGraph, END } from '@langchain/langgraph';
import * as readline from 'readline/promises';
import { DynamicStructuredTool } from "@langchain/core/tools";

// Configuração inicial
config();

// ----------------------------------------------------------------------
// 1. Ferramenta Personalizada para Consultar a Hora
// ----------------------------------------------------------------------
const timeTool = new DynamicStructuredTool({
    name: "get_current_time",
    description: "Obtém a data e hora atual no fuso horário de São Paulo",
    schema: {},
    func: async () => {
        const now = new Date();
        const options = {
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('pt-BR', options);
        return `Data e hora atual: ${formatter.format(now)} (Horário de Brasília)`;
    }
});

// ----------------------------------------------------------------------
// 2. Configuração do Modelo e Ferramentas
// ----------------------------------------------------------------------
const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.2,
});

const searchTool = new TavilySearch({ maxResults: 2 });
const tools = [searchTool, timeTool]; // Agora com duas ferramentas!

// ----------------------------------------------------------------------
// 3. Definição do Estado do Agente
// ----------------------------------------------------------------------
const graphState = {
    messages: {
        value: (x, y) => x.concat(y),
        default: () => []
    },
    next: { value: null }
};

// ----------------------------------------------------------------------
// 4. Nó do Agente Principal
// ----------------------------------------------------------------------
async function agentNode(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    
    // Prepara o prompt com histórico
    const messages = [
        {
            role: "system",
            content: `Você é um Assistente farmacêutico especializado em medicamentos e dosagens.

FERRAMENTAS DISPONÍVEIS:
- get_current_time: Use para informar a data e hora atual quando o usuário perguntar
- tavily_search: Use para buscar informações sobre medicamentos, dosagens, interações medicamentosas

Seja claro e conciso nas respostas. Use as ferramentas quando necessário.`
        },
        ...state.messages
    ];

    // Chama o LLM com ferramentas
    const response = await llm.invoke(messages, { tools });
    
    return {
        messages: [response],
        next: response.tool_calls?.length > 0 ? "tools" : "end"
    };
}

// ----------------------------------------------------------------------
// 5. Nó de Ferramentas
// ----------------------------------------------------------------------
async function toolsNode(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = lastMessage.tool_calls;
    
    const results = [];
    for (const toolCall of toolCalls) {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
            console.log(`🛠️  Executando ferramenta: ${toolCall.name}`);
            const result = await tool.invoke(toolCall.args);
            results.push({
                ...toolCall,
                result
            });
        }
    }

    // Prepara mensagem com resultados
    const messages = [
        {
            role: "tool",
            content: JSON.stringify(results),
            tool_call_id: toolCalls[0].id
        }
    ];

    return {
        messages,
        next: "agent"
    };
}

// ----------------------------------------------------------------------
// 6. Construção do Graph
// ----------------------------------------------------------------------
const workflow = new StateGraph({ channels: graphState })
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge("tools", "agent")
    .addEdge("__start__", "agent")
    .addConditionalEdges(
        "agent",
        (state) => state.next
    )

const app = workflow.compile();

// ----------------------------------------------------------------------
// 7. Interface com o Usuário
// ----------------------------------------------------------------------
async function iniciarAssistente() {
    console.log('💊 Assistente Farmacêutico Iniciado');
    console.log('📋 Agora com capacidade de:');
    console.log('   • Informações sobre medicamentos');
    console.log('   • Consultar data e hora atual');
    console.log('   • Buscar informações atualizadas');
    console.log('Digite "sair" para encerrar\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    let chatHistory = [];

    while (true) {
        const userInput = await rl.question('👤 Você: ');

        if (userInput.toLowerCase() === 'sair') {
            console.log('👋 Até logo!');
            rl.close();
            break;
        }

        try {
            // Adiciona mensagem do usuário ao histórico
            chatHistory.push({ role: "human", content: userInput });

            console.log('🔄 Processando...');
            
            // Executa o graph
            const result = await app.invoke({
                messages: chatHistory
            });

            // Obtém a resposta final (última mensagem do assistente)
            const finalMessages = result.messages;
            const assistantResponse = finalMessages[finalMessages.length - 1].content;
            
            console.log(`💊 Assistente: ${assistantResponse}`);

            // Atualiza histórico
            chatHistory = finalMessages;

        } catch (error) {
            console.error('❌ Erro:', error.message);
        }
    }
}

// Executa o assistente
iniciarAssistente();