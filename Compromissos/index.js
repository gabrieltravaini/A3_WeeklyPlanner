// Carrega as variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa os módulos necessários
const express = require('express');
const mysql = require('mysql2');
const amqp = require('amqplib/callback_api');

// Cria uma instância do Express
const app = express();
app.use(express.json());
const port = 3000;

// Carrega as variáveis de ambiente para uso
const { DB_USER, DB_PASSWORD, DB_HOST, DB_DB, DB_PORT, RABBITMQ_URL, RABBITMQ_QUEUE, RABBITMQ_EXCHANGE } = process.env;

// Cria um pool de conexões com o MySQL
const pool = mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    database: DB_DB,
    password: DB_PASSWORD,
    port: DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});



// Conecta ao RabbitMQ
let channel = null;
amqp.connect(RABBITMQ_URL, (err, connection) => {
    if (err) throw err;  // Lança um erro se a conexão falhar

    connection.createChannel((err, ch) => {
        if (err) throw err;  // Lança um erro se a criação do canal falhar
        channel = ch;
        channel.assertExchange(RABBITMQ_EXCHANGE, 'fanout', { durable: true });
        channel.assertQueue(RABBITMQ_QUEUE, { durable: false }, (err, q) => {
            if (err) throw err;  // Lança um erro se a criação da fila falhar
            channel.bindQueue(q.queue, RABBITMQ_EXCHANGE, '');
            console.log(`Conectado ao RabbitMQ, exchange: ${RABBITMQ_EXCHANGE}, fila: ${RABBITMQ_QUEUE}`);
        });
    });
});

// Função para enviar eventos ao RabbitMQ
const sendEvent = (eventType, details) => {
    const event = JSON.stringify({ eventType, details });
    channel.publish(RABBITMQ_EXCHANGE, '', Buffer.from(event));
    console.log("Evento enviado:", event);
};

// Rota para adicionar um novo compromisso
app.post('/compromisso', (req, res) => {
    const { ds_compromisso, dt_compromisso, hr_compromisso } = req.body;
    const sql = "INSERT INTO tb_compromisso (ds_compromisso, dt_compromisso, hr_compromisso) VALUES (?,?,?)";

    pool.query(sql, [ds_compromisso, dt_compromisso, hr_compromisso], (err) => {
        if (err) return res.status(500).send('Erro ao criar compromisso');  // Lida com erro de inserção

        pool.query("SELECT MAX(id_compromisso) as max_id FROM tb_compromisso", (err, results) => {
            if (err) return res.status(500).send('Erro ao recuperar o ID do compromisso');  // Lida com erro de seleção

            // Envia um evento de compromisso criado
            sendEvent("CompromissoCriado", { 
                id_compromisso: results[0].max_id, 
                ds_compromisso, 
                dt_compromisso, 
                hr_compromisso 
            });

            res.status(201).send("Compromisso criado e evento enviado");
        });
    });
});

// Rota para deletar um compromisso
app.post('/compromisso/delete', (req, res) => {
    const { id_compromisso } = req.body;
    const sql = "DELETE FROM tb_compromisso WHERE id_compromisso = ?";

    pool.query(sql, [id_compromisso], (err) => {
        if (err) return res.status(500).send('Erro ao apagar compromisso');  // Lida com erro de exclusão

        // Envia um evento de compromisso deletado
        sendEvent("CompromissoDeletado", { id_compromisso });
        res.status(200).send("Compromisso deletado e evento enviado");
    });
});

// Inicia o servidor na porta definida
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
