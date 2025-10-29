import { config } from 'dotenv';
// Para carregar variáveis de ambiente do .env

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
// O modelo Gemini (LLM)

import {
    ChatPromptTemplate,
    MessagesPlaceholder,
} from '@langchain/core/prompts'; // Componentes de Prompt

import {
    RunnableSequence,
    RunnablePassthrough, // <--- CORRETO: Classes de encadeamento
} from '@langchain/core/runnables'; // Componentes de Chain (Runnables)

import {
    AIMessage,
    HumanMessage,
    BaseMessage,
} from '@langchain/core/messages'; // Classes de Mensagem

import * as readline from 'readline/promises';
// Para criar uma interface de linha de comando assíncrona

// ----------------------------------------------------------------------
// 0. Configuração Inicial
// ----------------------------------------------------------------------
config(); // Carrega as variáveis de ambiente (incluindo GEMINI_API_KEY)

// ----------------------------------------------------------------------
// 1. Definição do Template e Prompt
// ----------------------------------------------------------------------

const systemTemplate = `Você é um Assistente farmacêutico que ajuda os usuários a encontrar informações sobre medicamentos e suas dosagens.
Forneça respostas claras e concisas com base nas informações disponíveis.`;

const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    new MessagesPlaceholder('history'), // Onde o histórico de mensagens será injetado
    ['human', '{input}'], // A nova entrada do usuário
]);


// ----------------------------------------------------------------------
// 2. Configuração do Modelo
// ----------------------------------------------------------------------
const llm = new ChatGoogleGenerativeAI({
    model: 'gemini-2.5-flash',
    temperature: 0.2, // Prioriza respostas factuais
});

// ----------------------------------------------------------------------
// 3. Gerenciamento de Histórico (Memória)
// ----------------------------------------------------------------------

// No LangChain JS, a abordagem mais comum para memória é gerenciar o array
// de mensagens manualmente em memória (ou usando um ChatMessageHistory específico).

/** @type {BaseMessage[]} */
let messageHistory = [];

/**
 * Função para obter o histórico atual (como no get_history do Python)
 * @returns {BaseMessage[]} O array de mensagens.
 */
function getHistory() {
    return messageHistory;
}

/**
 * Função para atualizar o histórico após uma rodada
 * @param {string} input - A mensagem do usuário
 * @param {string} output - A resposta do assistente
 */
function updateHistory(input, output) {
    messageHistory.push(new HumanMessage(input));
    messageHistory.push(new AIMessage(output));
}

// ----------------------------------------------------------------------
// 4. Criação da Chain (Simulando RunnableWithMessageHistory)
// ----------------------------------------------------------------------

const chain = RunnableSequence.from([
    // 1. Injeta o histórico no objeto de entrada
    RunnablePassthrough.assign({
        history: () => getHistory(), 
    }),
    // 2. Aplica o Prompt com o histórico e o novo input
    prompt,
    // 3. Passa para o LLM
    llm,
]);


// ----------------------------------------------------------------------
// 5. Loop de Execução e Interação com o Usuário
// ----------------------------------------------------------------------

async function iniciarAssistenteFarmaceutico() {
    console.log('Assistente Farmacêutico Iniciado (Node.js). Digite "sair" ou "exit" para encerrar.');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    while (true) {
        const userInput = await rl.question('Você: ');

        if (userInput.toLowerCase() === 'sair' || userInput.toLowerCase() === 'exit') {
            console.log('Encerrando o Assistente Farmacêutico. Até logo!');
            rl.close();
            break;
        }

        try {
            // Invoca a chain, passando o input do usuário
            const resposta = await chain.invoke({
                input: userInput
            });

            const respostaContent = resposta.content;
            console.log(`Assistente: ${respostaContent}`);
            
            // Atualiza o histórico para a próxima rodada
            updateHistory(userInput, respostaContent);

        } catch (error) {
            console.error('\n--- Erro ao chamar o LLM ---');
            console.error('Detalhes:', error);
            // Continua o loop
        }
    }
}

// Executa a função principal
iniciarAssistenteFarmaceutico();