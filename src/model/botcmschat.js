module.exports = (Sequelize) => {
    return [
        {
            chatId: Sequelize.INTEGER,
            username: Sequelize.STRING,
            title: Sequelize.STRING,
            fullname: Sequelize.STRING,
            firstName: Sequelize.STRING,
            lastName: Sequelize.STRING,
            description: Sequelize.STRING,
            inviteLink: Sequelize.STRING,
            bridge: Sequelize.STRING(20),
            driver: Sequelize.STRING,
        },
        {},
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