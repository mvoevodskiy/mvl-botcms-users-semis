
class BotCMSUsersMiddleware {

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
            let localUser;
            let requestUserId = ctx.Message.sender.id === target.SELF_SEND ? 0 : ctx.Message.sender.id;
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
            if (target.MT.empty(localUser)) {
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
            if (!target.MT.empty(localUser)) {
                ctx.singleSession.mvlBotCMSUser = localUser;
            }
            return next(ctx);
        }
    };
}

module.exports = BotCMSUsersMiddleware;