# discord-jabber-transport-bot

Простой транспортный бот между каналом в Discord и Jabber-конференцией (XMPP MUC).
На одном экземпляре бота вы можете присоединиться к нескольким конференциям.

# Как начать

 - Вам нужна рабочая установка [Node.js](https://nodejs.org) (версия> = 7.7.1) на машине, на которой будет запускаться этот бот. `npm` устанавливается вместе с Node.js.
 - `npm install` - установить зависимости.
 - `cp local.json.sample local.json` - создать файл конфигурации. Создайте `production.json` для развертывания.
 - Редактировать файлы конфигурации. Смотрите раздел [Добавление бота в Discord Guild](https://github.com/shtrih/discord-xmpp-transport-bot#adding-bot-to-discord-guild) ниже.
 - `nodejs ./app.js` или` npm start` - запустить приложение.
 - Введите `!ping` в канале Discord, чтобы проверить ответ "pong".

# Добавление бота в Discord Guild

 1. Вам необходимо [создать приложение](https://discordapp.com/developers/docs/topics/oauth2#bots) на странице [Мои приложения](https://discordapp.com/developers/applications/me).
 2. Создайте URL-адрес приглашения, как описано на [этой странице](https://discordapp.com/developers/docs/topics/oauth2#bot-authorization-flow).
 Для простоты использования рекомендуется использовать [этот веб-сайт](https://discordapi.com/permissions.html#536890368).
 
 Бот требует 3 [права доступа](https://discordapp.com/developers/docs/topics/permissions): `READ_MESSAGES`, `SEND_MESSAGES`, `EMBED_LINKS`. На данный момент для этой роли десятичное значение равно `19456`.

 Также необязательное разрешение - `MANAGE_WEBHOOKS` (требуется 2FA). Установите его, если хотите, чтобы бот отправлял сообщения на Dicsord от имени Jabber-пользователя.

# Отладка

Установите для переменной среды `DEBUG` значения в соответствии с [документацией](https://github.com/visionmedia/debug/blob/master/README.md):
 - `info`
 - `error`
 - `debug:jabber`
 - `debug:discord`

Например, запустите в терминале Linux:
 - `$> export DEBUG=info,error,debug:discord,debug:discord,-xmpp:client`
 - `$> nodejs app.js`

# Докер

Также вы можете запустить его в [докер-контейнере](https://docs.docker.com/):
 1. `cd ~/projects/discord-xmpp-transport-bot`
 2. `sudo docker run --rm -it -v $(pwd):/src:rw mkenney/npm:node-7.7-alpine "npm install"`
 3. `sudo docker run --rm -it -v $(pwd):/src:ro mkenney/npm:node-7.7-alpine "npm run start-debug"`

# Команды бота

Все команды работают только со стороны Discord. Ответы бота видны только в Discord.

| Команда | Описание | Где работает |
| --- | --- | --- |
| `!ping` | Отвечает "pong" | Личное сообщение, Комната |
| `!say <комната> Текст` | Говорит что-нибудь от имени бота. В качестве параметра <комната> вы можете использовать ID Jabber-конференции или комнаты в Discord (см. команду `!rooms`). Эта команда работает только для бот-администратора (adminId в конфигурационном файле) | Личное сообщение, Комната |
| `!rooms` | Показать связанные Jabber-конференции | Личное сообщение, Комната |
| `!users` | Показать пользователей из связанной Jabber-конференции. Также показывает, кто игнорируется командой `!ignore` | Комната |
| `!ignore Jabber-ник` | Игнорировать Jabber-пользователя по псевдониму. Если он сменит псевдоним → будет игнорироваться под новым псевдонимом | Комната |
| `!unignore Jabber-ник` | Прекратить игнорировать Jabber-пользователя | Комната |
