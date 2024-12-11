# A3_WeeklyPlanner
Projeto de A3 de um sistema de planejador semanal ao estilo tweek, baseado em microsserviços e com integração ao chat GPT para sugerir observações nos compromissos criados.

## Conteúdos
* [Como subir os serviços?](#como-subir-os-serviços)
    * [Avaliação A3](#avaliação-a3)
    * [Outros casos / uso geral](#outros-casos--uso-geral)
        * [Passo 1: Configurar serviço  de banco de dados](#passo-1-configurar-serviço--de-banco-de-dados)
        * [Passo 2: Configurar serviço de barramento de eventos RabbitMQ](#passo-2-configurar-serviço-de-barramento-de-eventos-rabbitmq)
        * [Passo 3: Criar uma conta para utilizar a api do chatGPT](#passo-3-criar-uma-conta-para-utilizar-a-api-do-chatgpt)
        * [Passo 4: criar arquivos ".env" e declarar variáveis de ambiente](#passo-4-criar-arquivos-env-e-declarar-variáveis-de-ambiente)
        * [Passo 5: Instalar dependências e executar os serviços](#passo-5-instalar-dependências-e-executar-os-serviços)

* [Como Fazer chamadas aos serviços?](#como-fazer-chamadas-aos-serviços)
    * [Criar um compromisso](#criar-um-compromisso)
    * [Deletar um compromisso](#deletar-um-compromisso)
    * [Criar um detalhe](#criar-um-detalhe)
    * [Deletar um detalhe](#deletar-um-detalhe)
    * [Realizar uma busca](#realizar-uma-busca)


## Como subir os serviços?


### Avaliação A3
<b>Para efeitos de avaliação da A3, será enviado por email o arquivo `.env` dos três serviços, tornando necessário seguir apenas do [Passo 5](#passo-5-instalar-dependencias-e-executar-os-serviços) em diante.

Os detalhes de como fazer as requisições e exemplos do JSON do body da chamada podem ser encontrados a partir [desta sessão](#como-fazer-chamadas-aos-serviços).
</b>


### Outros casos / uso geral
Para subir os serviços do zero, sem o arquivo `.env`, siga os seguintes passos:

### Passo 1: Configurar serviço  de banco de dados
Criar um banco de dados mySQL e rodar o seguinte script para criação dos Schemas:

```SQL
-- cria os schemas necessários para os microsserviços
CREATE DATABASE IF NOT EXISTS Compromissos;
CREATE DATABASE IF NOT EXISTS Detalhes;
CREATE DATABASE IF NOT EXISTS Busca;

-- cria as tabelas 
USE Compromissos;
Create table tb_compromisso (
    id_compromisso int auto_increment primary key,
    ds_compromisso Varchar(100) NOT NULL,
    dt_compromisso date Not NULL,
    hr_compromisso time NOT NULL
);

USE Detalhes;
Create table tb_detalhe (
    id_detalhe int auto_increment primary key,
    id_compromisso int NOT NULL,
    ds_detalhe text NOT NULL,
    ia Bool NOT NULL
);

USE Busca;
Create table tb_detalhe (
    id_detalhe int auto_increment primary key,
    id_compromisso int NOT NULL,
    ds_detalhe Varchar(100) NOT NULL,
    ia Bool NOT NULL
);
Create table tb_compromisso (
    id_compromisso int auto_increment primary key,
    ds_compromisso Varchar(100) NOT NULL,
    dt_compromisso date Not NULL,
    hr_compromisso time NOT NULL
);
```
### Passo 2: Configurar serviço de barramento de eventos RabbitMQ
No desenvolvimento deste projeto, utilizamos o serviço <a href='https://www.cloudamqp.com/'><b><i>cloudamqp</i></b></a> para hospedar o nosso barramento de eventos gratuitamente, entretanto, pode ser utilizado qualquer forma de hospedagem, desde que o serviço seja o RabbitMQ. Uma vez criado o serviço, configure uma fila e uma exchange para o modo <i>"fanout"</i> de entrega de mensagens.

### Passo 3: Criar uma conta para utilizar a api do chatGPT
Para executar o microsserviço de detalhes será necessário se comunicar e enviar requests à api do chatGPT, para tal, é necessário se cadastrar no site da <a href='https://openai.com/api/'><b><i>OpenAI </i></b></a> e gerar uma api Key e, caso não possua, é necessario adicionar créditos à sua conta da OpenAI.

### Passo 4: criar arquivos ".env" e declarar variáveis de ambiente
Em cada uma das pastas onde se encontram os microsserviços, criar um arquivo ".env" e populá-los da seguinte forma:

#### Compromissos:
```.env
DB_USER={seu usuário do banco de dados}
DB_PASSWORD={sua senha do banco de dados}
DB_HOST={o endereço do seu banco de dados}
DB_DB=Compromissos
DB_PORT={a porta onde seu banco de dados está ouvindo}
RABBITMQ_URL={O endereço do RabbitMQ}
RABBITMQ_QUEUE ={A fila do rabbit MQ}
RABBITMQ_EXCHANGE={O exchange de fanout do RabbitMQ}
```

#### Detalhes:
```.env
DB_USER={seu usuário do banco de dados}
DB_PASSWORD={sua senha do banco de dados}
DB_HOST={o endereço do seu banco de dados}
DB_DB=Detalhes
DB_PORT={a porta onde seu banco de dados está ouvindo}
RABBITMQ_URL={O endereço do RabbitMQ}
RABBITMQ_QUEUE ={A fila do rabbit MQ}
RABBITMQ_EXCHANGE={O exchange de fanout do RabbitMQ}
OPENAI_KEY={sua api key da openai}
```

#### Busca:
```.env
DB_USER={seu usuário do banco de dados}
DB_PASSWORD={sua senha do banco de dados}
DB_HOST={o endereço do seu banco de dados}
DB_DB=Busca
DB_PORT={a porta onde seu banco de dados está ouvindo}
RABBITMQ_URL={O endereço do RabbitMQ}
RABBITMQ_QUEUE ={A fila do rabbit MQ}
RABBITMQ_EXCHANGE={O exchange de fanout do RabbitMQ}
```
### Passo 5: Instalar dependências e executar os serviços
Uma vez adicionados os arquivos `.env` nas pastas de cada um dos serviços basta executar no terminal (em cada uma das paginas):

```shell
$ npm install
$ node index.js
```

alternativamente é possível executá-los com o nodemon para efeitos de testes e alterações com:

```shell
$ npm install
$ npm start
```

## Como Fazer chamadas aos serviços?

### Criar um compromisso:

Para criar um compromisso, utiliza-se a rota `/compromisso` do endereço do serviço de compromissos e o corpo da requisição deve seguir o exemplo a seguir:
```JSON
{
    "ds_compromisso":"Passar o ano novo com a Familia",//Descrição do compromisso
    "dt_compromisso":"2024-12-31",//Data do compromisso no formato "AAAA-MM-DD"
    "hr_compromisso":"23:59:59"//Hora do compromisso no formato "HH:MM:SS"
}
```
<i>Obs: criar um compromisso gera automaticamente um detalhe por IA atrelado a ele.</i>

### Deletar um compromisso:
Para deletar um compromisso, utiliza-se a rota `/compromisso/delete` do endereço do serviço de compromissos e o corpo da requisição deve seguir o exemplo a seguir:

```JSON
{"id_compromisso":"1"}//id do compromisso a ser deletado
```
<i>Obs: deletar um compromisso deleta todos os detalhes atrelados a ele.</i>

### Criar um detalhe:
Para criar um detalhe, utiliza-se a rota `/detalhe` do endereço do serviço de detalhes e o corpo da requisição deve seguir o exemplo a seguir:
```JSON
{
    "id_compromisso":"1",//id do compromisso ao qual este detalhe se refere
    "ds_detalhe":"Levar Champagne"//Descrição do detalhe
}
```
### Deletar um detalhe:
Para deletar um detalhe, utiliza-se a rota `/detalhe/delete` do endereço do serviço de detalhes e o corpo da requisição deve seguir o exemplo a seguir:
```JSON
{
    "id_detalhe":"1",//id do detalhe a ser deletado
}
```
### Realizar uma busca:
Para realizar uma busca basta fazer uma requisição do tipo <i>GET</i> na rota `/compromisso/:id` no endereço do serviço de busca, onde o id é o id do compromisso sendo buscado, a busca retornará um JSON contendo todos os detalhes atrelados à aquele compromisso. no caso dos exemplos acima, o retorno é o seguinte:

```JSON
[
  {
    "id_compromisso": 1,
    "ds_compromisso": "Passar o ano novo com a Familia",
    "dt_compromisso": "2024-12-31T03:00:00.000Z",
    "hr_compromisso": "23:59:59",
    "id_detalhe": 1,
    "ds_detalhe": "Defina um lembrete antecipado para organizar a celebração.",
    "ia": 1 //indica que este detalhe foi gerado por IA
  },
  {
    "id_compromisso": 1,
    "ds_compromisso": "Passar o ano novo com a Familia",
    "dt_compromisso": "2024-12-31T03:00:00.000Z",
    "hr_compromisso": "23:59:59",
    "id_detalhe": 2,
    "ds_detalhe": "Levar Champagne",
    "ia": 0 // indica que este detalhe foi gerado manualmente
  }
]
``` 

