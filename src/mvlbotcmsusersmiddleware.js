
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
        let senderId = ctx.BC.MT.extract('Message.sender.id', ctx, -1);
        if (senderId === -1 ) {
            localUser = this.Model.build({
                id: -1,
                fullname: '(anonymous)',
            });
            ctx.singleSession.mvlBotCMSUser = localUser;
            return;
        }
        let requestUserId = ctx.Message.sender.id === ctx.BC.SELF_SEND ? 0 : ctx.Message.sender.id;
        if (requestUserId === 0) {
            let selfUserInfo = await ctx.Bridge.fetchUserInfo();
            requestUserId = selfUserInfo.id;
        }
        if (requestUserId !== undefined) {
            localUser = await this.Model.findOne({
                where: {
                    userId: requestUserId,
                    bridge: ctx.Bridge.name
                }
            });
        }
        if (ctx.BC.MT.empty(localUser)) {
            let userInfo = await ctx.Bridge.fetchUserInfo(requestUserId, ctx);
            // console.log(userInfo);
            if (!ctx.BC.MT.empty(localUser) && localUser.id !== undefined) {
                localUser = await this.Model.findOrCreate({
                    where: {
                        userId: userInfo.id,
                        bridge: ctx.Bridge.name,
                        driver: ctx.Bridge.driverName,
                        // createdon: Date.now() / 1000 | 0,
                    },
                    defaults: {
                        username: userInfo.username,
                        fullname: userInfo.full_name,
                        firstName: userInfo.first_name,
                        lastName: userInfo.last_name,
                        type: userInfo.type,
                    }
                });
                localUser = localUser[0];
            }
        }
        if (!ctx.BC.MT.empty(localUser)) {
            // console.log('BOTCMS USER MW. SAVE USER. HASH L ', localUser.accessHash, ' T ', ctx.Message.sender.accessHash)
            let changed = false;
            if (ctx.Message.sender.accessHash !== '' && localUser.accessHash !== ctx.Message.sender.accessHash) {
                localUser.accessHash = ctx.Message.sender.accessHash;
                changed = true;
            }
            if (localUser.fullname === null) {
                let userInfo = await ctx.Bridge.fetchUserInfo(requestUserId, ctx);
                localUser.username = userInfo.username;
                localUser.fullname = userInfo.full_name;
                localUser.firstName = userInfo.first_name;
                localUser.lastName = userInfo.last_name;
                localUser.type = userInfo.type;
                changed = true;
            }
            if (changed) {
                await localUser.save();
            }
        } else {
            localUser = await this.Model.build({
                userId: -1,
                bridge: ctx.Bridge.name,
                driver: ctx.Bridge.driverName,
            });
        }
        ctx.singleSession.mvlBotCMSUser = localUser;
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
                bridge: ctx.Bridge.name
            },
            // raw: true,
        });
        if (ctx.BC.MT.empty(localChat)) {
            let chatInfo = await ctx.Bridge.fetchChatInfo(requestChatId, ctx);
            // console.log(chatInfo);
            localChat = await this.DB.models.mvlBotCMSChat.findOrCreate({
                where: {
                    chatId: chatInfo.id,
                    bridge: ctx.Bridge.name,
                    driver: ctx.Bridge.driverName,
                    // createdon: Date.now() / 1000 | 0,
                },
                defaults: {
                    username: ctx.BC.MT.extract('username', chatInfo, null),
                    title: ctx.BC.MT.extract('title', chatInfo, null),
                    fullname: ctx.BC.MT.extract('full_name', chatInfo, null),
                    firstName: ctx.BC.MT.extract('first_name', chatInfo, null),
                    lastName: ctx.BC.MT.extract('last_name', chatInfo, null),
                    type: ctx.BC.MT.extract('type', chatInfo, null),
                    description: ctx.BC.MT.extract('description', chatInfo, null),
                    inviteLink: ctx.BC.MT.extract('invite_link', chatInfo, null),
                }
            });
            localChat = localChat[0];
        }
        if (!ctx.BC.MT.empty(localChat)) {
            // console.log('BOTCMS USER MW. SAVE CHAT. HASH L ', localChat.accessHash, ' T ', ctx.Message.chat.accessHash)
            // if (ctx.Message.chat.accessHash !== '' && localChat.accessHash !== ctx.Message.chat.accessHash) {
            //     localChat.accessHash = ctx.Message.chat.accessHash;
            //     await localChat.save();
            // }
            ctx.singleSession.mvlBotCMSChat = localChat;
        }
    };

    __saveMember  = async ctx => {
        if (!this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSUser) && ctx.singleSession.mvlBotCMSUser.id !== -1 && !this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSChat)) {
            // console.log(ctx.singleSession.mvlBotCMSUser);
            await this.DB.models.mvlBotCMSChatMember.findOrCreate({
                where: {
                    mvlBotCMSUserId: ctx.singleSession.mvlBotCMSUser.id,
                    mvlBotCMSChatId: ctx.singleSession.mvlBotCMSChat.id,
                },
            })
                .then(result => {
                    ctx.singleSession.mvlBotCMSChatMember = result[0];
                })
                .catch(e => {
                    console.error(e, ctx.singleSession.mvlBotCMSUser.id, ctx.singleSession.mvlBotCMSUser);
                });
        }
    }
}

module.exports = mvlBotCMSUsersMiddleware;