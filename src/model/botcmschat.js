module.exports = (Sequelize) => {
    return [
        {
            chatId: Sequelize.STRING,
            username: Sequelize.STRING,
            title: Sequelize.STRING,
            fullname: Sequelize.STRING,
            firstName: Sequelize.STRING,
            lastName: Sequelize.STRING,
            description: Sequelize.STRING,
            inviteLink: Sequelize.STRING,
            type: {
                type: Sequelize.STRING,
                defaultValue: '',
            },
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
                    fields: ['chatId', 'bridge'],
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
            belongsToMany: [
                {
                    model: 'mvlBotCMSUser',
                    as: 'Users',
                    through: {
                        model: 'mvlBotCMSChatMember'
                    }
                }
            ]
        }
    ];
};