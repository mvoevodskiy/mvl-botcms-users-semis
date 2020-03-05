#botcms-users
Сохранение в БД базовой информации о каждом пользователе, отправляющем сообщение боту.
Пакет экспортирует модель Sequelize, поэтому в проекте должно существовать подключение к БД.

## Установка
```npm i mvl-botcms-users-semis --save``` 

## Подключение к проекту MVLoader
```
const {mvlBotCMSUsers} = require('mvl-botcms-users-semis');

let config = {
    ext: {
        classes: {
            semis: {
                mvlBotCMSUsers: mvlBotCMSUsers,
            },
        },
    },
};

let app = new App(config);
```

## Использование
Пакет подключает к проекту модель **mvlBotCMSUser** и _middleware_ к **BotCMS**.  
Middleware при получении каждого сообщения создает в БД нового пользователя социальной сети или получает, 
если уже существует, и сохраняет его объект в ctx.singleSession.mvlBotCMSUser, что позволяет обращаться к нему
в дальнейшем из любого метода.

Желательно подключать **mvlBotCMSUsers** как можно раньше в объекте **semis** конфигурации проекта.