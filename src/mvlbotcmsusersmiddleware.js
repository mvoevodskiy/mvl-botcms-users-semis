
class mvlBotCMSUsersMiddleware {

    DB = null;

    constructor (BotCMS) {
        this.BotCMS = BotCMS;
    }

    successDB = (target) => {
        return next => () => {
            this.DB = target.DB;
            this.Model = this.DB.models.mvlBotCMSUser;
            return next();
        }
    };

    failDB = (target) => {
        return next => error => {
            console.error('BOTCMS USERS. DB FAIL. FATAL');
            console.error(error);
            process.exit(-1);
        }
    };

    handleUpdate = (target) => {
        return next => async ctx => {
            await this.__saveUser(ctx);
            await this.__saveChat(ctx);
            await this.__saveMember(ctx);
            return next(ctx);
        }
    };

    __saveUser = async ctx => {
        let localUser;
        let requestUserId = ctx.Message.sender.id === ctx.BC.SELF_SEND ? 0 : ctx.Message.sender.id;
        if (requestUserId === 0) {
            let selfUserInfo = await ctx.Bridge.fetchUserInfo();
            requestUserId = selfUserInfo.id;
        }
        localUser = await this.Model.findOne({
            where: {
                userId: requestUserId,
                driver: ctx.Bridge.driverName
            }
        });
        if (ctx.BC.MT.empty(localUser)) {
            let userInfo = await ctx.Bridge.fetchUserInfo(requestUserId, ctx.Message.chat.id);
            // console.log(userInfo);
            localUser = await this.Model.create({
                userId: userInfo.id,
                username: userInfo.username,
                fullname: userInfo.full_name,
                firstName: userInfo.first_name,
                lastName: userInfo.last_name,
                type: userInfo.type,
                bridge: ctx.Bridge.name,
                driver: ctx.Bridge.driverName,
                // createdon: Date.now() / 1000 | 0,
            });
        }
        if (!ctx.BC.MT.empty(localUser)) {
            ctx.singleSession.mvlBotCMSUser = localUser;
        }
    };

    __saveChat = async ctx => {
        let localChat;
        let requestChatId = ctx.Message.chat.id;
        if (requestChatId === 0) {
            let selfChatInfo = await ctx.Bridge.fetchChatInfo();
            requestChatId = selfChatInfo.id;
        }
        localChat = await this.DB.models.mvlBotCMSChat.findOne({
            where: {
                chatId: requestChatId,
                driver: ctx.Bridge.driverName
            }
        });
        if (ctx.BC.MT.empty(localChat)) {
            let chatInfo = await ctx.Bridge.fetchChatInfo(requestChatId, ctx.Message.chat.id);
            console.log(chatInfo);
            localChat = await this.DB.models.mvlBotCMSChat.create({
                chatId: chatInfo.id,
                username: ctx.BC.MT.extract('username', chatInfo, null),
                title: ctx.BC.MT.extract('title', chatInfo, null),
                fullname: ctx.BC.MT.extract('full_name', chatInfo, null),
                firstName: ctx.BC.MT.extract('first_name', chatInfo, null),
                lastName: ctx.BC.MT.extract('last_name', chatInfo, null),
                type: ctx.BC.MT.extract('type', chatInfo, null),
                description: ctx.BC.MT.extract('description', chatInfo, null),
                inviteLink: ctx.BC.MT.extract('invite_link', chatInfo, null),
                bridge: ctx.Bridge.name,
                driver: ctx.Bridge.driverName,
                // createdon: Date.now() / 1000 | 0,
            });
        }
        if (!ctx.BC.MT.empty(localChat)) {
            ctx.singleSession.mvlBotCMSChat = localChat;
        }
    };

    __saveMember  = async ctx => {
        if (!this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSUser) && !this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSChat)) {
            await this.DB.models.mvlBotCMSChatMember.findOrCreate({
                where: {
                    mvlBotCMSUserId: ctx.singleSession.mvlBotCMSUser.id,
                    mvlBotCMSChatId: ctx.singleSession.mvlBotCMSChat.id,
                },
            });
        }
    }
}

module.exports = mvlBotCMSUsersMiddleware;