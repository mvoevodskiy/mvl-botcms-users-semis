const mt = require('mvtools')

/**
 * @class Middleware for BotCMS to control users
 * @property {Object<import('botcms')>} BotCMS
 * @property {Object<import('mvl-db-handler').Sequelize>} DB
 * @property {Object<string,*>}
 */
class mvlBotCMSUsersMiddleware {
  constructor (BotCMS) {
    this.BotCMS = BotCMS
    this.DB = null
    this.STATES = {
      NOT_FOUND: 'notFound',
      BLOCKED: 'blocked',
      BOT_KICKED: 'botKicked',
      MIGRATED: 'migrated'
    }
    const defaults = {
      dataTimeout: 5 * 60 * 1000,
      state: 'member',
      userMethods: ['send'],
      exclude: {
        drivers: [],
        bridges: []
      }
    }

    this.config = mt.mergeRecursive(defaults, mt.extract('mvlBotCMSUsersMiddleware', BotCMS.config, {}))

    /**
     * @function
     * @param {Object<import('botcms')>}target
     * @property {callback} next}
     * @returns {function(*): function(): *}
     */
    this.successDB = (target) => {
      return next => () => {
        this.DB = target.DB
        return next()
      }
    }

    /**
     * @function
     * @property {Error} error}
     * @returns {function(*): function(): *}
     */
    this.failDB = () => {
      return () => error => {
        console.error('BOTCMS USERS. DB FAIL. FATAL')
        console.error(error)
        process.exit(-1)
      }
    }

    /**
     * @function
     * @property {callback} next}
     * @property {Object<import('botcms').Context>} ctx
     * @returns {function(*): function(*=): Promise<*>}
     */
    this.handleUpdate = (BC) => {
      return next => async ctx => {
        // console.log('USERS', ctx.Message.users)
        if (this.__excluded(ctx.Bridge.name, ctx.Bridge.driverName)) return next(ctx)
        let state
        const users = []
        const senderId = mt.extract('Message.sender.id', ctx, -1)
        const selfAction = ctx.Message.users.length && ctx.Message.users[0].id === senderId
        const userIds = [senderId]

        if (ctx.Message.event === 'chatMemberNew' && selfAction) state = 'member'
        if (ctx.Message.event === 'chatMemberLeft' && selfAction) state = 'left'

        const { userMember, chat, member } = await this.__saveAll(ctx, senderId, true, true, state)
        const senderMember = userMember

        if (mt.extract('mvlBotCMSChat.id', ctx.state, -1) === -1) ctx.state.mvlBotCMSChat = chat
        if (mt.extract('mvlBotCMSUser.id', ctx.state, -1) === -1) {
          ctx.state.mvlBotCMSUser = senderMember.user
          ctx.state.mvlBotCMSUsers = [senderMember.user]
          ctx.state.mvlBotCMSChatMember = member
        }

        if (ctx.Message.event === 'chatMemberNew') state = 'member'
        if (ctx.Message.event === 'chatMemberLeft') state = 'left'

        for (const botUser of ctx.Message.users) {
          if (botUser.id === senderMember.id || userIds.indexOf(botUser.id) > -1) continue
          userIds.push(botUser.id)
          users.push(
            (async () => {
              const { userMember } = await this.__saveAll(ctx, botUser.id, false, true, state)
              ctx.state.mvlBotCMSUsers.push(userMember.user)
            })()
          )
        }
        for (const mentionUser of ctx.Message.elements.mentionId()) {
          if (mentionUser.id === senderMember.id || userIds.indexOf(mentionUser.id) > -1) continue
          userIds.push(mentionUser.id)
          users.push(
            (async () => {
              const { userMember } = await this.__saveAll(ctx, mentionUser.id, false, false)
              const username = userMember.user.username
              if (typeof username === 'string' && username.length) mentionUser.username = username.length
              ctx.state.mvlBotCMSUsers.push(userMember.user)
            })()
          )
        }
        await Promise.allSettled(users)
        return next(ctx)
      }
    }

    this.bridgeExec = (target) => {
      return next => async (execParams, logParams = {}) => {
        console.log('BOT USERS MW. BRIDGE EXEC.')
        // console.log('BOT USERS MW. BRIDGE:', execParams.bridge)
        // console.log('BOT USERS MW. BRIDGE EXEC. EXEC PARAMS:', execParams)
        if (this.__excluded(execParams.bridge)) {
          console.log('BOT USERS MW. BRIDGE EXCLUDED.')
          return next(execParams, logParams)
        }
        if (this.config.userMethods.indexOf(execParams.method) !== -1) {
          if (await target.DB.models.mvlBotCMSChat.count({ where: { chatId: String(execParams.params.peerId), state: 'active' } })) {
            return next(execParams, logParams)
          }
          console.error('BOTCMS USERS MW. BOT CHAT', execParams.params.peerId, 'IS NOT ACTIVE. BREAK SENDING. MESSAGE:\n', execParams.params.message)
          return
        }
        return await next(execParams, logParams)
      }
    }

    this.__saveAll = async (ctx, userId, saveChat = true, saveMember = true, defMemberState = 'active') => {
      const userMember = await this.__saveUser(ctx, userId)
        .catch(e => console.error('SAVE BOTCMS USER FAILURE:', e))
      const chat = saveChat
        ? await this.__saveChat(ctx)
          .catch(e => console.error('SAVE BOTCMS CHAT FAILURE:', e))
        : { id: null, chatId: ctx.Message.chat.id }
      const member = saveMember
        ? await this.__saveMember(ctx, chat, userMember.user, userMember.memberState || defMemberState)
        : {}
      return { userMember, chat, member }
    }

    /**
     * Save BotCMS User to DB
     * @function
     * @property {import('botcms').Context} ctx
     * @returns {Promise<void>}
     * @private
     */
    this.__saveUser = async (ctx, userId = -1) => {
      /* @param {import('mvl-db-handler').Model} localUser */
      let localUser
      let memberState
      // const userId = mt.extract('Message.sender.id', ctx, -1)
      // console.log(ctx.Message);
      if (userId === -1 || userId === null) {
        localUser = this.DB.models.mvlBotCMSUser.build({
          id: -1,
          fullname: '(anonymous)'
        })
        return localUser
      }
      let requestUserId = userId === ctx.BC.SELF_SEND ? 0 : userId
      if (requestUserId === 0) {
        const selfUserInfo = await ctx.Bridge.fetchUserInfo()
        requestUserId = selfUserInfo.id
      }
      if (requestUserId !== undefined) {
        localUser = await this.DB.models.mvlBotCMSUser.findOne({
          where: {
            userId: String(requestUserId),
            bridge: ctx.Bridge.name
            // driver: ctx.Bridge.driverName
          }
        })
      }
      if (!mt.empty(localUser)) {
        if (ctx.Message.event === ctx.Message.EVENTS.USER_NOT_FOUND ||
          (ctx.Message.event === ctx.Message.EVENTS.CHAT_NOT_FOUND && String(localUser.userId === String(ctx.Message.chat.id)))
        ) {
          localUser.state = 'notFound'
          await localUser.save()
          return { user: localUser, memberState: 'notFound' }
        }
      }
      if (mt.empty(localUser) || this.__isOld(localUser.updatedAt) || localUser.fullname === null) {
        const userInfo = await ctx.Bridge.fetchUserInfo(requestUserId, ctx)
        // console.log(userInfo)
        if (!mt.empty(userInfo) && userInfo.id !== undefined) {
          localUser = await this.DB.models.mvlBotCMSUser.findOne({
            where: {
              userId: String(requestUserId),
              bridge: ctx.Bridge.name
            }
            // raw: true,
          })
          if (!localUser) {
            localUser = await this.DB.models.mvlBotCMSUser.build()
          }
          await localUser.set({
            userId: String(userInfo.id),
            bridge: ctx.Bridge.name,
            driver: ctx.Bridge.driverName,
            username: userInfo.username,
            fullname: userInfo.full_name,
            firstName: userInfo.first_name,
            lastName: userInfo.last_name,
            type: userInfo.type
          })
          await localUser.save().catch((e) => console.error('ERROR WHILE SAVING BOTCMS USER:', e))
          memberState = userInfo.memberState
        }
      }
      if (!mt.empty(localUser)) {
        if (this.__isOld(localUser.updatedAt)) {
          localUser.changed('updatedAt', true)
        }
        localUser.set('state', this.__getChatUserState(ctx))
        await localUser.save().catch((e) => console.error('ERROR WHILE LOCAL USER SAVE:', e))
      } else {
        localUser = await this.DB.models.mvlBotCMSUser.build({
          id: -1,
          bridge: ctx.Bridge.name,
          driver: ctx.Bridge.driverName
        })
      }
      return { user: localUser, memberState }
    }

    /**
     * Save BotCMS Chat to DB
     * @function
     * @property {Object<import('botcms').Context>} ctx
     * @returns {Promise<void>}
     * @private
     */
    this.__saveChat = async ctx => {
      // console.log('SAVE CHAT. CHAT', ctx.Message.chat)
      const defaultData = {
        id: -1,
        chatId: -1,
        bridge: ctx.Bridge.name,
        driver: ctx.Bridge.driverName
      }
      const fetchChatInfo = async (chatId, context) => {
        // console.log('SAVE CHAT. CHAT ID', chatId)
        const chatInfo = await ctx.Bridge.fetchChatInfo(chatId, context)
        //   .catch((e) => {
        //   console.error('BC USERS MW. FETCH CHAT INFO ERROR', e)
        //   return { id: null }
        // })
        return {
          chatId: chatInfo.id,
          username: mt.extract('username', chatInfo, null),
          title: mt.extract('title', chatInfo, null),
          fullname: mt.extract('full_name', chatInfo, null),
          firstName: mt.extract('first_name', chatInfo, null),
          lastName: mt.extract('last_name', chatInfo, null),
          type: mt.extract('type', chatInfo, null),
          description: mt.extract('description', chatInfo, null),
          inviteLink: mt.extract('invite_link', chatInfo, null),
          state: mt.extract('state', chatInfo, 'active')
        }
      }
      const chatProps = {
        changeId: ctx.Message.event === ctx.Message.EVENTS.CHAT_CHANGED_ID,
        exists: ctx.Message.event !== ctx.Message.EVENTS.CHAT_NOT_FOUND,
        id: mt.extract('changeId.old', ctx.Message, ctx.Message.chat.id),
        oldId: mt.extract('changeId.old', ctx.Message, ctx.Message.chat.id),
        newId: mt.extract('changeId.new', ctx.Message, ctx.Message.chat.id)
      }
      // console.log('DELETED CHAT -575096725: ', await fetchChatInfo('-575096725', ctx))
      // console.log('SAVE CHAT. CHAT PROPS', chatProps)
      let localChat
      let requestChatId = chatProps.id
      if (requestChatId === 0 || requestChatId === '0') {
        const selfChatInfo = await ctx.Bridge.fetchChatInfo()
        requestChatId = selfChatInfo.id
      }
      localChat = await this.DB.models.mvlBotCMSChat.findOne({
        where: {
          chatId: chatProps.changeId ? [String(chatProps.oldId), String(chatProps.newId)] : String(chatProps.id),
          bridge: ctx.Bridge.name
        }
        // raw: true,
      })
        .catch((e) => console.error('ERROR WHILE FIND mvlBotCMSChat: ', e))
      if (!mt.empty(localChat)) {
        if (ctx.Message.event === ctx.Message.EVENTS.CHAT_NOT_FOUND ||
          (ctx.Message.event === ctx.Message.EVENTS.USER_NOT_FOUND && String(localChat.userId === String(ctx.Message.sender.id)))
        ) {
          localChat.state = 'notFound'
          await localChat.save()
          return localChat
        }
      }
      let chatInfo = {}
      if (mt.empty(localChat) || this.__isOld(localChat.updatedAt) || ctx.Message.event === ctx.Message.EVENTS.CHAT_MEMBER_LEFT) {
        chatInfo = await fetchChatInfo(chatProps.changeId ? requestChatId : chatProps.newId, ctx)
        // console.log(chatInfo)
        if (chatInfo.chatId) {
          chatInfo.chatId = String(chatInfo.chatId)
          chatInfo.bridge = ctx.Bridge.name
          chatInfo.driver = ctx.Bridge.driverName

          localChat = await this.DB.models.mvlBotCMSChat.findOne({
            where: {
              chatId: String(requestChatId),
              bridge: ctx.Bridge.name
            }
            // raw: true,
          })
          if (!localChat) {
            localChat = await this.DB.models.mvlBotCMSChat.build()
          }
          await localChat.set(chatInfo)
          await localChat.save()
          // console.log('SAVE CHAT. LOCAL CHAT', localChat.get())
        }
      }
      if (!mt.empty(localChat)) {
        if (String(localChat.chatId) !== String(chatProps.newId)) {
          // console.log('SAVE CHAT. CHAT ID NOT MATCH')
          localChat.set('chatId', String(chatProps.newId))
        }
        localChat.set('state', this.__getChatUserState(ctx, chatInfo))
        if (this.__isOld(localChat.updatedAt)) {
          localChat.changed('updatedAt', true)
        }
        await localChat.save().catch((e) => console.error('ERROR WHILE SAVE mvlBotCMSChat: ', e))
      } else {
        localChat = await this.DB.models.mvlBotCMSChat.build(defaultData)
      }
      return localChat
    }

    /**
     * Save BotCMS Chat Member to DB
     * @function
     * @property {import('botcms').Context} ctx
     * @returns {Promise<void>}
     * @private
     */
    this.__saveMember = async (ctx, chat, user, state) => {
      if (!mt.empty(user) && user.id !== -1 && !mt.empty(chat) && chat.id !== -1) {
        // console.log(ctx.state.mvlBotCMSUser);
        const finder = {
          where: {
            mvlBotCMSUserId: user.id
          }
        }
        if (chat.id !== null) finder.where.mvlBotCMSChatId = chat.id
        else if (!mt.empty(chat.chatId)) {
          finder.include = [
            {
              model: this.DB.models.mvlBotCMSChat,
              where: { chatId: String(chat.chatId) }
            }
          ]
        }
        const result = await this.DB.models.mvlBotCMSChatMember.findOrCreate(finder).catch(e => {
          console.error('ERROR WHILE UPDATE CHAT MEMBER', e, user.get())
          return [null]
        })
        const member = result[0]
        if (member !== null && state !== undefined && member.state !== state) {
          member.set('state', state)
          await member.save({ logging: console.log })
        }
        return member
      }
    }

    /**
     * Check if date is too old
     * @function
     * @param checkDate
     * @returns {boolean}
     * @private
     */
    this.__isOld = (checkDate) => {
      const oldDate = new Date(checkDate)
      const now = new Date()
      return now.getTime() - oldDate.getTime() > this.config.dataTimeout
    }

    this.__getChatUserState = (ctx, userOrChat = {}) => {
      let state = userOrChat.state || 'active'
      if ([ctx.Message.EVENTS.CHAT_NOT_FOUND, ctx.Message.EVENTS.USER_NOT_FOUND].indexOf(ctx.Message.event) !== -1) {
        state = this.STATES.NOT_FOUND
      }
      if ([ctx.Message.EVENTS.BOT_KICKED_FROM_CHAT, ctx.Message.EVENTS.BOT_BLOCKED_BY_USER].indexOf(ctx.Message.event) !== -1) {
        state = this.STATES.BOT_KICKED
      }
      if (ctx.Message.event === ctx.Message.EVENTS.USER_BLOCKED) {
        state = this.STATES.BLOCKED
      }
      if (ctx.Message.event === ctx.Message.EVENTS.CHAT_CHANGED_ID) {
        state = this.STATES.MIGRATED
      }
      return state
    }

    this.__excluded = (bridge, driver = undefined) => {
      // console.log('MVL BOTCMS USERS. EXCLUDED? DRIVER: ', driver, '(conf:', this.config.exclude.drivers, ') BRIDGE:', bridge, '(conf:', this.config.exclude.bridges, ')')
      if (driver !== undefined && this.config.exclude.drivers.indexOf(driver) !== -1) return true
      if (bridge === null || bridge === undefined) {
        const botBridge = this.BotCMS.getBridge()
        if (botBridge !== null && typeof botBridge === 'object') bridge = botBridge.name
      }
      return this.config.exclude.bridges.indexOf(bridge) !== -1
    }
  }
}

module.exports = mvlBotCMSUsersMiddleware
