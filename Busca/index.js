// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importa os módulos necessários
const express = require("express");
const mysql = require("mysql2");
const amqp = require("amqplib/callback_api");

// Cria uma instância do Express
const app = express();
app.use(express.json());
const port = 5000;


// Carrega as variáveis de ambiente para uso
const {DB_USER,DB_PASSWORD,DB_HOST,DB_DB,DB_PORT,RABBITMQ_URL,RABBITMQ_QUEUE} = process.env;

// Configura pool de conexões do MySQL
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





// Conectar ao RabbitMQ
let channel = null;
amqp.connect(RABBITMQ_URL, (err, connection) => {
    if (err) {
        console.error("Erro ao conectar RabbitMQ", err);
        process.exit(1);
    }

    // Cria um canal de comunicação
    connection.createChannel((err, ch) => {
        if (err) {
            console.error("Erro ao criar canal RabbitMQ", err);
            process.exit(1);
        }
        channel = ch;

        // Assegura que a fila exista
        channel.assertQueue(RABBITMQ_QUEUE, { durable: false });
        console.log(`Conectado ao RabbitMQ, fila: ${RABBITMQ_QUEUE}`);

        // Consome mensagens da fila
        channel.consume(
            RABBITMQ_QUEUE,
            (msg) => {
                if (msg !== null) {
                    console.log("\n Nova mensagem recebida:", msg.content.toString());
                    const event = JSON.parse(msg.content.toString());

                    // Processa diferentes tipos de eventos
                    if (event.eventType === "CompromissoCriado") {
                        const { ds_compromisso, dt_compromisso, hr_compromisso } = event.details;
                        criaCompromisso(ds_compromisso, dt_compromisso, hr_compromisso);
                    } else if (event.eventType === "CompromissoDeletado") {
                        const { id_compromisso } = event.details;
                        deletaDetalhesPorCompromisso(id_compromisso);
                    } else if (event.eventType === "DetalheCriado") {
                        const { id_compromisso, ds_detalhe, ia } = event.details;
                        criaDetalhe(id_compromisso, ds_detalhe, ia);
                    } else if (event.eventType === "DetalheDeletado") {
                        const { id_detalhe } = event.details;
                        deletaDetalhe(id_detalhe);
                    }

                    // Reconhece que a mensagem foi processada
                    channel.ack(msg);
                    console.log("Mensagem processada e reconhecida.");
                }
            },
            { noAck: false },
        );
    });

    // Fecha a conexão RabbitMQ ao encerrar a aplicação
    process.on("SIGINT", () => {
        connection.close();
        console.log("Conexão RabbitMQ fechada");
        process.exit(0);
    });
});

// Função para deletar detalhes e compromissos no banco de dados
const deletaDetalhesPorCompromisso = (id_compromisso) => {
    const sql1 = "DELETE FROM tb_detalhe WHERE id_compromisso = ?";
    pool.query(sql1, [id_compromisso], (err, results) => {
        if (err) return console.error("Erro ao apagar detalhes", err);
        console.log(`Detalhes deletados para id_compromisso: ${id_compromisso}`);
    });
    const sql2 = "DELETE FROM tb_compromisso WHERE id_compromisso = ?";
    pool.query(sql2, [id_compromisso], (err, results) => {
        if (err) return console.error("Erro ao apagar compromisso", err);
        console.log(`Compromisso deletado para id_compromisso: ${id_compromisso}`);
    });
};

// Função para criar um compromisso no banco de dados
const criaCompromisso = (ds_compromisso, dt_compromisso, hr_compromisso) => {
    const sql = "INSERT INTO tb_compromisso (ds_compromisso, dt_compromisso, hr_compromisso) VALUES (?, ?, ?)";
    pool.query(sql, [ds_compromisso, dt_compromisso, hr_compromisso], (err, results) => {
        if (err) return console.error("Erro ao criar compromisso", err);
        console.log(`Compromisso criado com sucesso`);
    });
};

// Função para criar um detalhe no banco de dados
const criaDetalhe = (id_compromisso, ds_detalhe, ia) => {
    const sql = "INSERT INTO tb_detalhe (id_compromisso, ds_detalhe, ia) VALUES (?, ?, ?)";
    pool.query(sql, [id_compromisso, ds_detalhe, ia], (err, results) => {
        if (err) return console.error("Erro ao criar detalhe", err);
        console.log(`Detalhe criado com sucesso`);
    });
};

// Função para deletar um detalhe no banco de dados
const deletaDetalhe = (id_detalhe) => {
    const sql = "DELETE FROM tb_detalhe WHERE id_detalhe = ?";
    pool.query(sql, [id_detalhe], (err, results) => {
        if (err) return console.error("Erro ao deletar detalhe", err);
        console.log(`Detalhe deletado com sucesso`);
    });
};

// Rota para obter compromisso por ID
app.get("/compromisso/:id", (req, res) => {
    const id_compromisso = req.params.id;
    const sql = "SELECT a.*, b.* FROM tb_compromisso AS a LEFT JOIN tb_detalhe AS b ON a.id_compromisso = b.id_compromisso WHERE a.id_compromisso = ?";

    pool.query(sql, [id_compromisso], (err, results) => {
        if (err) {
            console.error("Erro ao buscar compromisso", err);
            return res.status(500).send("Erro ao buscar compromisso");
        }
        if (results.length === 0) {
            return res.status(404).send("Compromisso não encontrado");
        }
        res.json(results);
    });
});

// Inicia o servidor Express na porta especificada
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
