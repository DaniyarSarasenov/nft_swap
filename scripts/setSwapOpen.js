const hre = require("hardhat");
const contractAddress = process.env.SWAP_CONTRACT_ADDRESS;

const fun = async () => {
    const NFTSwap = await hre.ethers.getContractFactory('NFTSwap');
    const swapper = await NFTSwap.attach(contractAddress);
    
    const result = await swapper.setOpenOffer(true);
    console.log("Current Swap state --", await swapper.openSwap());
}
fun();