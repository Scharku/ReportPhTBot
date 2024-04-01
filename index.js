//Подключение библиотек
const TelegramApi = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

//Подключение бота
const token = '7108787449:AAELIrnlx6bFpJwEdvksOJSwTWGziv1jLWA';
const bot = new TelegramApi(token, { polling: true });
const allowedUserId = 469679427

//База данных для хранения графика дежурств
const report = new sqlite3.Database('report.db');
report.run('CREATE TABLE IF NOT EXISTS report (id INTEGER PRIMARY KEY, text TEXT, date TEXT)');

//Меню команд.
bot.setMyCommands([
    {command: '/report', description: 'Сдать отчет в этот день'},
    {command: '/check', description: 'Проверить все отчеты'},
    {command: '/update', description: 'Обновляет БД'},
])

//Обработчик событий

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username;
    let response = `Привет, ${username}! Я бот.`;
    bot.sendMessage(chatId, response);
});

bot.onText(/\/report/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.first_name;
    const currentDate = new Date().toISOString();

    report.get('SELECT * FROM report WHERE text = ?', [username], (err, row) => {
        if (err) {
            console.error('Ошибка при проверке наличия отчета в базе данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при проверке наличия отчета в базе данных.');
        }
        if (row) {
            return bot.sendMessage(chatId, 'Вы уже сдали сегодня отчет.');
        }
        report.run('INSERT INTO report (text, date) VALUES (?, ?)', [username, currentDate], (err) => {
            if (err) {
                console.error('Ошибка при добавлении записи в базу данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при добавлении отчета в базу данных.');
            }
            return bot.sendMessage(chatId, 'Отчет успешно добавлен в базу данных.');
        });
    });
});

bot.onText(/\/check/, (msg) => {
    const chatId = msg.chat.id;

    report.all('SELECT id, text, date FROM report', (err, rows) => {
        if (err) {
            console.error('Ошибка при получении отчетов из базы данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при получении отчетов из базы данных.');
        }
        if (rows.length === 0) {
            return bot.sendMessage(chatId, 'В базе данных нет отчетов.');
        }
        let response = 'Отчеты:\n';
        rows.forEach(row => {
            const date = new Date(row.date);
            const formattedDate = `${("0" + date.getDate()).slice(-2)}/${("0" + (date.getMonth() + 1)).slice(-2)}`;
            response += `${row.id}: ${row.text} - ${formattedDate}\n`;
        });
        return bot.sendMessage(chatId, response);
    });
});

bot.onText(/\/update/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (userId === allowedUserId) {
        report.run('DELETE FROM report', (err) => {
            if (err) {
                console.error('Ошибка при удалении записей из базы данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при удалении базы данных.');
            }
            return bot.sendMessage(chatId, 'База данных успешно удалена.');
        });
    } else {
        bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
    }
});