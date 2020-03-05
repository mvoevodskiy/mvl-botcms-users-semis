const {MVLoaderBase} = require('mvloader');
const BotCMSUsersMiddleware = require('./botcmsusersmiddleware');

class BotCMSUsers extends MVLoaderBase{

    static exportConfig = {
        ext: {
            configs: {
                handlers: {
                    BotHandler: {
                        botcms: {
                            middlewares: [
                                BotCMSUsersMiddleware,
                            ],
                        },
                    },
                    DBHandler: {
                        models: {
                            mvlBotCMSUser: require('./model/botcmsuser')
                        }
                    }
                }
            },
        }
    };
}

module.exports = {BotCMSUsers, BotCMSUsersMiddleware};