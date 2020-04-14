module.exports = (Sequelize) => {
    return [
        {
            userId: Sequelize.INTEGER,
            userMasterId: Sequelize.INTEGER,
            username: Sequelize.STRING,
            fullname: Sequelize.STRING,
            firstName: Sequelize.STRING,
            lastName: Sequelize.STRING,
            bridge: Sequelize.STRING(20),
            driver: Sequelize.STRING,
        },
        {},
        {
            belongsTo: [
                {
                    model: 'mvlUser',
                },
            ]
        }
    ];
};