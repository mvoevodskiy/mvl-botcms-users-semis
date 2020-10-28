/**
 * @param {import('mvl-db-handler')} Sequelize
 * @returns {[{firstName: *, lastName: *, driver: *, accessHash: {defaultValue: string, type: *}, fullname: *, bridge: *, userId: *, userMasterId: *, username: *}, {indexes: [{unique: boolean, fields: [string, string]}, {fields: [string]}, {fields: [string]}]}, {belongsToMany: [{through: {model: string}, as: string, model: string}], belongsTo: [{model: string}], hasMany: [{as: string, model: string}]}]}
 */
module.exports = (Sequelize) => {
  return [
    {
      userId: Sequelize.STRING,
      userMasterId: Sequelize.INTEGER,
      username: Sequelize.STRING,
      fullname: Sequelize.STRING,
      firstName: Sequelize.STRING,
      lastName: Sequelize.STRING,
      accessHash: {
        type: Sequelize.STRING,
        defaultValue: ''
      },
      bridge: Sequelize.STRING(20),
      driver: Sequelize.STRING
    },
    {
      indexes: [
        {
          fields: ['bridge', 'userId'],
          unique: true
        },
        {
          fields: ['username']
        },
        {
          fields: ['driver']
        }
      ]
    },
    {
      belongsTo: [
        {
          model: 'mvlUser'
        }
      ],
      belongsToMany: [
        {
          model: 'mvlBotCMSChat',
          as: 'Chats',
          through: {
            model: 'mvlBotCMSChatMember'
          }
        }
      ],
      hasMany: [
        {
          model: 'mvlBotCMSChatMember',
          as: 'ChatMembers'
        }
      ]
    }
  ]
}
