//Подключение библиотек
const TelegramApi = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

//Подключение бота
const token = '7108787449:AAELIrnlx6bFpJwEdvksOJSwTWGziv1jLWA';
const bot = new TelegramApi(token, { polling: true });

//База данных пользователей.
const users = new sqlite3.Database('users.db');
users.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, telegram_id INTEGER)');

//База данных для хранения графика дежурств.
const report = new sqlite3.Database('report.db');
report.run('CREATE TABLE IF NOT EXISTS report (id INTEGER PRIMARY KEY, text TEXT, date TEXT)');

//Меню команд.
bot.setMyCommands([
    {command: '/help', description: 'Помощь'},
    {command: '/report', description: 'Сдать отчет в этот день'},
    {command: '/check', description: 'Проверить наличие отчета'},
    {command: '/update', description: 'Обновляет БД'},
    {command: '/add', description: 'Добавить пользователя в БД'},
    {command: '/del', description: 'Удаление пользователя'},
    {command: '/users', description: 'Посмотреть пользователей'}
])

//Обработчик событий
bot.onText(/\/report/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.first_name;
    const currentDate = new Date().toISOString();

    // Проверяем наличие пользователя в базе данных
    users.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, userRow) => {
        if (err) {
            console.error('Ошибка при проверке наличия пользователя в базе данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при проверке наличия пользователя в базе данных.');
        }

        // Если пользователя нет в базе данных, то выходим из функции и отправляем сообщение о доступе
        if (!userRow) {
            return bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }

        // Проверяем наличие отчета пользователя в базе данных
        report.get('SELECT * FROM report WHERE text = ?', [username], (err, row) => {
            if (err) {
                console.error('Ошибка при проверке наличия отчета в базе данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при проверке наличия отчета в базе данных.');
            }

            if (row) {
                return bot.sendMessage(chatId, 'Вы уже сдали сегодня отчет.');
            }

            // Добавляем отчет пользователя в базу данных
            report.run('INSERT INTO report (text, date) VALUES (?, ?)', [username, currentDate], (err) => {
                if (err) {
                    console.error('Ошибка при добавлении записи в базу данных:', err);
                    return bot.sendMessage(chatId, 'Произошла ошибка при добавлении отчета в базу данных.', err);
                }
                return bot.sendMessage(chatId, 'Отчет успешно добавлен в базу данных.');
            });
        });
    });
});

bot.onText(/\/check/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    users.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, userRow) => {
        if (err) {
            console.error('Ошибка при проверке наличия пользователя в базе данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при проверке наличия пользователя в базе данных.');
        }

        // Если пользователя нет в базе данных, то выходим из функции и отправляем сообщение о доступе
        if (!userRow) {
            return bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }

        report.all('SELECT id, text, date FROM report', (err, rows) => {
            if (err) {
                console.error('Ошибка при получении отчетов из базы данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при получении отчетов из базы данных.', err);
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
});

//Удаление всей базы данных
bot.onText(/\/update/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // Проверяем наличие второго пользователя в базе данных
    users.get('SELECT telegram_id FROM users ORDER BY id LIMIT 1 OFFSET 0', (err, row) => {
        if (err) {
            console.error('Ошибка при получении второго пользователя из базы данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при получении данных из базы данных.');
        }

        if (row && row.telegram_id === userId) { // Проверяем, является ли пользователь вторым в базе данных
            report.run('DELETE FROM report', (err) => {
                if (err) {
                    console.error('Ошибка при удалении записей из базы данных:', err);
                    return bot.sendMessage(chatId, 'Произошла ошибка при удалении базы данных.', err);
                }
                return bot.sendMessage(chatId, 'База данных успешно удалена.');
            });
        } else {
            bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }
    });
});


bot.onText(/^\/add (.+) (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = match[1]; // Получаем имя пользователя из сообщения
    const id = match[2]; // Получаем идентификатор пользователя из сообщения
    const userId = msg.from.id;

    users.get('SELECT telegram_id FROM users ORDER BY id LIMIT 1 OFFSET 0', (err, row) => {
        if (err) {
            console.error('Ошибка при получении второго пользователя из базы данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при получении данных из базы данных.');
        }
        if (row && row.telegram_id === userId) { // Проверяем, является ли пользователь вторым в базе данных
        // Добавляем пользователя в базу данных
        users.run('INSERT INTO users (username, telegram_id) VALUES (?, ?)', [name, id], (err) => {
            if (err) {
                console.error('Ошибка при добавлении пользователя в базу данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при добавлении пользователя в базу данных.');
            }
            return bot.sendMessage(chatId, `Пользователь ${name} успешно добавлен в базу данных.`);
        }); } else {
            bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }
    });
});

bot.onText(/^\/del (.+) (\d+)$/, (msg, match) => {
    const chatId = msg.chat.id;
    const name = match[1]; // Получаем имя пользователя из сообщения
    const id = match[2]; // Получаем идентификатор пользователя из сообщения
    const userId = msg.from.id;

    // Проверяем наличие второго пользователя в базе данных
    users.get('SELECT telegram_id FROM users ORDER BY id LIMIT 1 OFFSET 0', (err, row) => {
        if (err) {
            console.error('Ошибка при получении второго пользователя из базы данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при получении данных из базы данных.');
        }
        if (row && row.telegram_id === userId) { // Проверяем, является ли пользователь вторым в базе данных
        // Удаляем пользователя из базы данных по имени и ID
        users.run('DELETE FROM users WHERE username = ? AND telegram_id = ?', [name, id], (err) => {
            if (err) {
                console.error('Ошибка при удалении пользователя из базы данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при удалении пользователя из базы данных.');
            }
            return bot.sendMessage(chatId, `Пользователь ${name} с ID ${id} успешно удален из базы данных.`);
        });
        } else {
            bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }
    });
});

bot.onText(/^\/users$/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    users.get('SELECT * FROM users WHERE telegram_id = ?', [userId], (err, userRow) => {
        if (err) {
            console.error('Ошибка при проверке наличия пользователя в базе данных:', err);
            return bot.sendMessage(chatId, 'Произошла ошибка при проверке наличия пользователя в базе данных.', err);
        }

        // Если пользователя нет в базе данных, то выходим из функции и отправляем сообщение о доступе
        if (!userRow) {
            return bot.sendMessage(chatId, 'У вас нет доступа к этой команде.');
        }

        // Запрос к базе данных для получения списка пользователей
        users.all('SELECT * FROM users', (err, rows) => {
            if (err) {
                console.error('Ошибка при получении списка пользователей из базы данных:', err);
                return bot.sendMessage(chatId, 'Произошла ошибка при получении списка пользователей из базы данных.');
            }

            // Формируем сообщение со списком пользователей
            let userList = 'Список пользователей:\n';
            rows.forEach(row => {
                userList += `Имя: ${row.username}, ID: ${row.telegram_id}\n`;
            });

            // Отправляем сообщение с списком пользователей
            bot.sendMessage(chatId, userList);
        });
    });
});


bot.onText(/^\/help$/, (msg) => {
    const chatId = msg.chat.id;
 bot.sendMessage(chatId, 'Бот работает только для тех, кто находится в базе данных. ' +
     'Базу данных пользователей может обновлять только старший куратор (в целях безопасности).' +
 '\n\nТеперь немного по функциям, которые есть:' +
 '\n/report - Сдаешь отчет после выполненной работы.' +
 '\n/check - Посмотреть список отчетов.' +
     '\n\nТолько СтК имеет доступ к следующим функциям:' +
     '\n/update - Для очищения отчетов после проверки. Необходимо делать каждое утро, чтобы была возможность сдать работу за день.' +
     '\n/add - Добавить пользователя для использования бота.' +
     '\nПример - "/add user userID"' +
     '\n/del - Удаление пользователя из бота.' +
     '\nПример - "/del user userID"' +
     '\n/users - Посмотреть весь список пользователей.' +
     '\n\nБот все еще не умеет готовить еду. Потерпите!');
});