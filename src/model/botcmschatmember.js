module.exports = (Sequelize) => {
  return {
    joined: Sequelize.DATE,
    permissions: Sequelize.STRING,
    state: Sequelize.STRING,
    banUntil: Sequelize.DATE,
  }
}