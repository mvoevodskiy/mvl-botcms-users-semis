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
                defaultValue: '',
            },
            bridge: Sequelize.STRING(20),
            driver: Sequelize.STRING,
        },
        {
            indexes: [
                {
                    fields: ['userId', 'bridge'],
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
                    model: 'mvlUser',
                },
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
                    as: 'ChatMembers',
                }
            ]
        }
    ];
};