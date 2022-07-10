async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account: ", deployer.address);
  
    const NFTSwap = await ethers.getContractFactory(
      "NFTSwap"
    );

    const swapper = await NFTSwap.deploy(
      
    );
    await swapper.deployed();
  
    console.log(
      "NFTSwap is deployed to address: ",
      swapper.address
    );
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
    });
  