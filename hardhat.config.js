require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("prettier-dotenv").config();
require("hardhat-gas-reporter");
require("solidity-coverage");

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.9",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      rinkeby: process.env.ETHERSCAN_API_KEY,
    },
  },
  networks: {
    rinkeby: {
      url: process.env.ALCHEMY_TEST_URI,
      accounts: [process.env.PRIVATE_KEY],
    },
    mainnet: {
      url: process.env.ALCHEMY_MAIN_URI,
      accounts: [process.env.PRIVATE_KEY],
    }
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};
