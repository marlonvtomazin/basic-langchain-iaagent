import { config } from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { TavilySearch } from "@langchain/tavily";
import { StateGraph, END } from '@langchain/langgraph';
import * as readline from 'readline/promises';

// Configuração inicial
config();

// ----------------------------------------------------------------------
// 1. Configuração do Modelo e Ferramentas
// ----------------------------------------------------------------------
const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.2,
});

const searchTool = new TavilySearch({ maxResults: 3 });
const tools = [searchTool];

// ----------------------------------------------------------------------
// 2. Definição do Estado do Agente
// ----------------------------------------------------------------------
const graphState = {
    messages: {
        value: (x, y) => x.concat(y),
        default: () => []
    },
    next: { value: null }
};

// ----------------------------------------------------------------------
// 3. Nó do Agente Principal
// ----------------------------------------------------------------------
async function agentNode(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    
    // Prepara o prompt com histórico
    const messages = [
        {
            role: "system",
            content: `Você é um Assistente farmacêutico especializado em medicamentos e dosagens.
            Use a ferramenta de busca quando precisar de informações atualizadas.
            Seja claro e conciso nas respostas.`
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
// 4. Nó de Ferramentas
// ----------------------------------------------------------------------
async function toolsNode(state) {
    const lastMessage = state.messages[state.messages.length - 1];
    const toolCalls = lastMessage.tool_calls;
    
    const results = [];
    for (const toolCall of toolCalls) {
        const tool = tools.find(t => t.name === toolCall.name);
        if (tool) {
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
// 5. Construção do Graph (CORRIGIDO)
// ----------------------------------------------------------------------
const workflow = new StateGraph({ channels: graphState })
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge("tools", "agent")
    .addEdge("__start__", "agent") // Ponto de entrada correto
    .addConditionalEdges(
        "agent",
        (state) => state.next
    );

const app = workflow.compile();

// ----------------------------------------------------------------------
// 6. Interface com o Usuário
// ----------------------------------------------------------------------
async function iniciarAssistente() {
    console.log('💊 Assistente Farmacêutico Iniciado');
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