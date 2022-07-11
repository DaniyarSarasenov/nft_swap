#

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
