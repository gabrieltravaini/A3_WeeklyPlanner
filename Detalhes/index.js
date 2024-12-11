// Carrega as variáveis de ambiente a partir de um arquivo .env
require("dotenv").config();

// Importa as bibliotecas necessárias
const express = require("express");
const mysql = require("mysql2");
const amqp = require("amqplib/callback_api");
const { OpenAI } = require("openai");

// Cria uma instância do Express, define a porta do servidor e configura o middleware para JSON
const app = express();
const port = 4000;
app.use(express.json());


// Definição das variáveis de ambiente
const {
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_DB,
    DB_PORT,
    RABBITMQ_URL,
    RABBITMQ_EXCHANGE,
    OPENAI_KEY,
} = process.env;

// Conexão com o banco de dados
const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    database: DB_DB,
    password: DB_PASSWORD,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
// Cria uma pool de conexões para o banco de dados MySQL

// Conexão com o OpenAI
const openai = new OpenAI({
    apiKey: OPENAI_KEY
});
// Configura a conexão com a API do OpenAI usando a chave fornecida

let channel = null;
amqp.connect(RABBITMQ_URL, (err, connection) => {
    if (err) throw err;

    connection.createChannel((err, ch) => {
        if (err) throw err;
        channel = ch;
        channel.assertExchange(RABBITMQ_EXCHANGE, "fanout", { durable: true });
        console.log(`Conectado ao RabbitMQ, exchange: ${RABBITMQ_EXCHANGE}`);
        // Conecta ao RabbitMQ e cria um canal, assegurando que o exchange é durável

        channel.assertQueue("", { exclusive: true }, (err, q) => {
            if (err) throw err;
            channel.bindQueue(q.queue, RABBITMQ_EXCHANGE, "");
            // Cria uma fila temporária exclusiva e a vincula ao exchange

            channel.consume(q.queue, (msg) => {
                if (msg !== null) {
                    const event = JSON.parse(msg.content.toString());
                    if (event.eventType === "CompromissoDeletado") {
                        const { id_compromisso } = event.details;
                        deleteDetailsByCompromisso(id_compromisso);
                    } else if (event.eventType === "CompromissoCriado") {
                        const { id_compromisso, ds_compromisso } = event.details;
                        CriaDetalhePorIa(id_compromisso, ds_compromisso);
                    }
                    channel.ack(msg);
                }
            });
            // Consome mensagens da fila e executa ações baseadas no tipo do evento

            console.log(`Fila conectada e vinculada ao exchange: ${q.queue}`);
        });
    });
});

// Função que envia eventos para o exchange do RabbitMQ
const sendEvent = (eventType, details) => {
    const event = JSON.stringify({ eventType, details });
    channel.publish(RABBITMQ_EXCHANGE, "", Buffer.from(event));
    console.log("Evento enviado:", event);
};

// Função que deleta detalhes de um compromisso no banco de dados
const deleteDetailsByCompromisso = (id_compromisso) => {
    const sql = "DELETE FROM tb_detalhe WHERE id_compromisso = ?";
    pool.query(sql, [id_compromisso], (err, results) => {
        if (err) return console.error("Erro ao apagar detalhes", err);
        console.log(`Detalhes deletados para id_compromisso: ${id_compromisso}`);
    });
};

// Função assíncrona que cria um detalhe usando a API do OpenAI e salva no banco de dados
async function CriaDetalhePorIa(id_compromisso, ds_compromisso) {
    const prompt = `preciso incluir um compromisso na minha agenda. Em até 10 palavras, recomende uma única dica pra me ajudar no seguinte compromisso: '${ds_compromisso}'`;
    const model = 'gpt-4o-mini';
    const role = 'user';
    const max_tokens = 40;

    const completion = await openai.chat.completions.create({
        messages: [{ role: role, content: prompt }],
        model: model,
        max_tokens: max_tokens
    });

    const ds_detalhe = completion.choices[0].message.content;

    console.log(ds_detalhe);
    const ia = true;
    const sql = "INSERT INTO tb_detalhe (id_compromisso, ds_detalhe, ia) VALUES (?, ?, ?)";

    pool.query(sql, [id_compromisso, ds_detalhe, ia], (err) => {
        if (err) return console.error("Erro ao criar detalhe", err);

        sendEvent("DetalheCriado", { id_compromisso, ds_detalhe, ia });
        console.log('Detalhe automático gerado e evento enviado');
    });
}

// Rota POST para adicionar um novo detalhe ao banco de dados e enviar um evento
app.post("/detalhe", (req, res) => {
    const ia = false;
    const { id_compromisso, ds_detalhe } = req.body;
    const sql = "INSERT INTO tb_detalhe (id_compromisso, ds_detalhe, ia) VALUES (?, ?, ?)";

    pool.query(sql, [id_compromisso, ds_detalhe, ia], (err) => {
        if (err) return res.status(500).send("Erro ao criar detalhe");

        sendEvent("DetalheCriado", { id_compromisso, ds_detalhe, ia });
        res.status(201).send("Detalhe criado e evento enviado");
    });
});

// Rota POST para deletar um detalhe do banco de dados e enviar um evento
app.post("/detalhe/delete", (req, res) => {
    const { id_detalhe } = req.body;
    const sql = "DELETE FROM tb_detalhe WHERE id_detalhe = ?";

    pool.query(sql, [id_detalhe], (err) => {
        if (err) return res.status(500).send("Erro ao apagar detalhe");

        sendEvent("DetalheDeletado", { id_detalhe });
        res.status(200).send("Detalhe deletado e evento enviado");
    });
});

// Inicia o servidor Express na porta definida
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
