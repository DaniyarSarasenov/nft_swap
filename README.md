This is ERC21 + ERC20 Swap contract

### Compile Swap Contract
npx hardhat compile

## Scripts

### Deploy on Rinkeby Testnet

```
npx hardhat run --network rinkeby scripts/deploy.js

npx hardhat run --network mainnet scripts/deploy.js

```

### Verify smart contract on Rinkeby Testnet
```
npx hardhat verify --network mainnet (address)
```

### Open Swap
```
npx hardhat run --network mainnet scripts/setOpen.js
```

### Test

```
npm run test
```
