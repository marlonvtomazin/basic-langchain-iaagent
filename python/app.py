import os
from dotenv import load_dotenv
# Importa a biblioteca 'os' para interagir com o sistema operacional (e variáveis de ambiente)
# Importa as funções do 'dotenv'
load_dotenv()
# Carrega as variáveis de ambiente (como a GEMINI_API_KEY) do arquivo .env para o ambiente Python.

from langchain_google_genai import ChatGoogleGenerativeAI
# Importa o modelo de Chat do Google Gemini (necessário para usar o LLM)
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
# Importa as classes para criar o template de prompt e gerenciar o histórico de mensagens
from langchain_core.runnables.history import RunnableWithMessageHistory
# Importa o wrapper que adiciona a funcionalidade de histórico (memória) à sua chain
from langchain_core.chat_history import BaseChatMessageHistory
# Importa a classe base para o histórico de chat
from langchain_community.chat_message_histories import ChatMessageHistory
# Importa a classe concreta para armazenar o histórico de mensagens na memória (RAM)

# ----------------------------------------------------------------------
# 1. Definição do Template e Prompt
# ----------------------------------------------------------------------
template = """Você é um Assistente farmacêutico que ajuda os usuários a encontrar informações sobre medicamentos e suas dosagens.
Forneça respostas claras e concisas com base nas informações disponíveis.

Histórico de conversa:
{history}

Entrada do usuário: 
{input}"""
# Define a 'persona' (role) do agente e a formatação básica da mensagem.
# {history} e {input} são placeholders que serão preenchidos pelo LangChain.

prompt = ChatPromptTemplate.from_messages([
  ("system", template),
# O "system" define as instruções e o comportamento do agente (a persona farmacêutica)
  MessagesPlaceholder(variable_name="history"),
# Este placeholder é essencial para o LangChain injetar o histórico de mensagens
  ("human", "{input}"),
# O "human" define o formato da entrada do usuário
])
# Cria o template de prompt no formato de mensagens de chat, ideal para LLMs como o Gemini.

# ----------------------------------------------------------------------
# 2. Configuração do Modelo e Criação da Chain
# ----------------------------------------------------------------------
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
# Inicializa o LLM (Gemini 2.5 Flash). Ele busca a chave GEMINI_API_KEY automaticamente.
# O 'temperature=0.2' garante respostas mais factuais e menos criativas.

chain = prompt | llm
# Cria a "Chain" (cadeia): o prompt é passado para o LLM.

# ----------------------------------------------------------------------
# 3. Gerenciamento de Histórico (Memória)
# ----------------------------------------------------------------------
store = {}
# Um dicionário simples usado para armazenar objetos ChatMessageHistory.

def get_history(session_id: str) -> BaseChatMessageHistory:
# Função que o LangChain usa para obter o objeto de histórico de uma sessão.
  if session_id not in store:
    store[session_id] = ChatMessageHistory()
# Se o ID da sessão não existir, cria um novo histórico na memória (RAM).
  return store[session_id]
# Retorna o objeto de histórico correspondente ao ID da sessão.

chain_with_history = RunnableWithMessageHistory(
  chain,
# A chain original (prompt + llm)
  get_history,
# A função de callback para carregar/salvar o histórico
  input_messages_key="input",
# Define qual chave do dicionário de entrada contém o texto do usuário
  history_messages_key="history"
# Define qual placeholder no prompt (o {history}) será preenchido
)
# Empacota a chain para que ela gerencie o histórico de mensagens automaticamente.

# ----------------------------------------------------------------------
# 4. Loop de Execução e Interação com o Usuário
# ----------------------------------------------------------------------
def iniciar_assistente_farmaceutico():
  print("Assistente Farmacêutico Iniciado. Digite 'sair' ou 'exit' para encerrar.")
  session_id = "sessao_unica" # ID fixo para esta execução simples; garante a persistência do histórico.

  while True:
    user_input = input("Você: ")
    if user_input.lower() in ["sair", "exit"]:
      print("Encerrando o Assistente Farmacêutico. Até logo!")
      break

    resposta = chain_with_history.invoke(
            {"input": user_input}, 
            {"configurable": {"session_id": session_id}}
        )
# Invoca a chain. O primeiro dicionário é o input, e o segundo (config)
# passa o ID da sessão para que o histórico seja carregado corretamente.

    print(f"Assistente: {resposta.content}")
# Imprime o conteúdo de texto da resposta (resposta.content é o texto puro).

if __name__ == "__main__":
  iniciar_assistente_farmaceutico()
# Garante que a função principal seja executada ao rodar o script diretamente.