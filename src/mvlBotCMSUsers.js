const {MVLoaderBase} = require('mvloader');
const mvlBotCMSUsersMiddleware = require('./mvlbotcmsusersmiddleware');

class mvlBotCMSUsers extends MVLoaderBase {

    static exportConfig = {
        ext: {
            configs: {
                handlers: {
                    BotHandler: {
                        botcms: {
                            middlewares: [
                                mvlBotCMSUsersMiddleware,
                            ],
                        },
                    },
                    DBHandler: {
                        models: {
                            mvlBotCMSUser: require('./model/botcmsuser'),
                            mvlBotCMSChat: require('./model/botcmschat'),
                            mvlBotCMSChatMember: require('./model/botcmschatmember'),
                        }
                    }
                }
            },
        }
    };
}

module.exports = {mvlBotCMSUsers, mvlBotCMSUsersMiddleware};