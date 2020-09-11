
class mvlBotCMSUsersMiddleware {

    DB = null;

    config = {
        dataTimeout: 5 * 60 * 1000
    }

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
        // console.log(ctx.Message);
        if (senderId === -1 || senderId === null) {
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
                    bridge: ctx.Bridge.name,
                    driver: ctx.Bridge.driverName,
                }
            });
        }
        if (ctx.BC.MT.empty(localUser) || this.__isOld(localUser.updatedAt) || localUser.fullname === null) {
            let userInfo = await ctx.Bridge.fetchUserInfo(requestUserId, ctx);
            // console.log(userInfo);
            if (!ctx.BC.MT.empty(userInfo) && userInfo.id !== undefined) {

                localUser = await this.DB.models.mvlBotCMSUser.findOne({
                    where: {
                        userId: requestUserId,
                        bridge: ctx.Bridge.name
                    },
                    // raw: true,
                })
                if (!localUser) {
                    localUser = await this.DB.models.mvlBotCMSUser.build()
                }
                await localUser.set({
                    userId: userInfo.id,
                    bridge: ctx.Bridge.name,
                    driver: ctx.Bridge.driverName,
                    username: userInfo.username,
                    fullname: userInfo.full_name,
                    firstName: userInfo.first_name,
                    lastName: userInfo.last_name,
                    type: userInfo.type,
                })
                await localUser.save().catch((e) => console.error('ERROR WHILE SAVING BOTCMS USER:', e))
            }
        }
        if (!ctx.BC.MT.empty(localUser)) {
            // console.log('BOTCMS USER MW. SAVE USER. HASH L ', localUser.accessHash, ' T ', ctx.Message.sender.accessHash)
            let changed = false;
            if (ctx.Message.sender.accessHash !== '' && localUser.accessHash !== ctx.Message.sender.accessHash) {
                localUser.accessHash = ctx.Message.sender.accessHash;
                localUser.changed('updatedAt', true)
            }
            if (this.__isOld(localUser.updatedAt)) {
                localUser.changed('updatedAt', true)
            }
            await localUser.save().catch((e) => console.error('ERROR WHILE LOCAL USER SAVE:', e))
        } else {
            localUser = await this.Model.build({
                id: -1,
                bridge: ctx.Bridge.name,
                driver: ctx.Bridge.driverName,
            });
        }
        ctx.singleSession.mvlBotCMSUser = localUser;
    };

    __saveChat = async ctx => {
        console.log('SAVE CHAT. CHAT', ctx.Message.chat)
        let defaultData = {
            id: -1,
            chatId: -1,
            bridge: ctx.Bridge.name,
            driver: ctx.Bridge.driverName,
        }
        let fetchChatInfo = async (chatId, context) => {
            let chatInfo = await ctx.Bridge.fetchChatInfo(chatId, context).catch(e => { return {id: null}});
            return {
                chatId: chatInfo.id,
                username: ctx.BC.MT.extract('username', chatInfo, null),
                title: ctx.BC.MT.extract('title', chatInfo, null),
                fullname: ctx.BC.MT.extract('full_name', chatInfo, null),
                firstName: ctx.BC.MT.extract('first_name', chatInfo, null),
                lastName: ctx.BC.MT.extract('last_name', chatInfo, null),
                type: ctx.BC.MT.extract('type', chatInfo, null),
                description: ctx.BC.MT.extract('description', chatInfo, null),
                inviteLink: ctx.BC.MT.extract('invite_link', chatInfo, null)
            }
        }
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
        })
          .catch((e) => console.error('ERROR WHILE FIND mvlBotCMSChat: ', e));
        if (ctx.BC.MT.empty(localChat) || this.__isOld(localChat.updatedAt)) {
            let chatInfo = await fetchChatInfo(requestChatId, ctx);
            // console.log(chatInfo);
            if (chatInfo.chatId) {
                chatInfo.bridge = ctx.Bridge.name
                chatInfo.driver = ctx.Bridge.driverName

                localChat = await this.DB.models.mvlBotCMSChat.findOne({
                    where: {
                        chatId: requestChatId,
                        bridge: ctx.Bridge.name
                    },
                    // raw: true,
                })
                if (!localChat) {
                    localChat = await this.DB.models.mvlBotCMSChat.build()
                }
                await localChat.set(chatInfo)
                await localChat.save()
            }
        }
        if (!ctx.BC.MT.empty(localChat)) {
            if (this.__isOld(localChat.updatedAt)) {
                localChat.changed('updatedAt', true)
                await localChat.save().catch((e) => console.error('ERROR WHILE SAVE mvlBotCMSChat: ', e))
            }
        } else {
            localChat = await this.DB.models.mvlBotCMSChat.build(defaultData);
        }
        ctx.singleSession.mvlBotCMSChat = localChat;
    };

    __saveMember  = async ctx => {
        if (!this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSUser)
          && ctx.singleSession.mvlBotCMSUser.id !== -1
          && !this.BotCMS.MT.empty(ctx.singleSession.mvlBotCMSChat)
          && ctx.singleSession.mvlBotCMSChat.id !== -1
        ) {
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

    __isOld = (checkDate) => {
        let oldDate = new Date(checkDate);
        let now = new Date();
        return now.getTime() - oldDate.getTime() > this.config.dataTimeout;
    }
}

module.exports = mvlBotCMSUsersMiddleware;