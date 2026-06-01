const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initRemoteDB() {
    const host = process.env.DB_HOST;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME || 'defaultdb';

    if (!host || !user || !password) {
        console.error('Faltan variables de entorno. Asegúrate de tener DB_HOST, DB_USER y DB_PASSWORD.');
        console.error('Ejemplo: DB_HOST=mysql-xxxxx.aivencloud.com DB_USER=avnadmin DB_PASSWORD=xxx DB_NAME=defaultdb');
        process.exit(1);
    }

    console.log(`Conectando a ${host}...`);
    try {
        const connection = await mysql.createConnection({ host, user, password, database });

        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        const lines = schema.split('\n').filter(line => {
            const trimmed = line.trim().toUpperCase();
            return !trimmed.startsWith('CREATE DATABASE') &&
                   !trimmed.startsWith('USE ') &&
                   !trimmed.startsWith('DROP DATABASE');
        });
        const cleanSchema = lines.join('\n');

        const queries = cleanSchema.split(';').map(q => q.trim()).filter(q => q.length > 0);

        console.log('Ejecutando schema.sql en la base de datos remota...');
        for (let query of queries) {
            await connection.query(query);
        }

        console.log('Base de datos remota inicializada correctamente.');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Error al inicializar la base de datos remota:');
        console.error(error);
        process.exit(1);
    }
}

initRemoteDB();
